import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createDocumentRequest,
  listRequestReviews,
  reviewDocumentRequest,
  submitDocumentRequest,
} from "@/server/services/documents";
import { ensureProjectThread, getThread, sendMessage } from "@/server/services/messages";
import { requireDocumentVersionAccess } from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
import type { SessionUser } from "@/types/auth";
import {
  createProject,
  createSupplier,
  createTestOrg,
  createUser,
  destroyOrg,
  makeFile,
} from "../factories";

/**
 * What the new tables are for.
 *
 * Two things the product could not do before this round, both of which needed
 * storage rather than cleverness: remember every verdict instead of only the
 * last one, and let a file travel with a message. The tests that matter are
 * the ones about the second supplier — an attachment is a file with a new door
 * in front of it, and a new door is how files leak.
 */
let organizationId: string;
let admin: SessionUser;
let supplierUser: SessionUser;
let otherSupplierUser: SessionUser;
let projectId: string;
let requestId: string;

beforeAll(async () => {
  const org = await createTestOrg("History");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `Maker ${org.slug}`);
  const other = await createSupplier(organizationId, `Other ${org.slug}`, "Germany");

  admin = await createUser({ organizationId, role: "ADMIN" });
  supplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplier.id,
  });
  otherSupplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: other.id,
  });

  const project = await createProject({
    organizationId,
    supplierId: supplier.id,
    ownerId: admin.id,
    name: "History Project",
  });
  projectId = project.id;

  const created = await createDocumentRequest(admin, {
    projectId,
    title: "Stability study",
    type: "CERTIFICATE",
    createTask: true,
  });
  requestId = created.id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("every round is kept", () => {
  it("records a rejection against the version it judged", async () => {
    await submitDocumentRequest(supplierUser, requestId, { file: makeFile("study-v1.pdf") });
    await reviewDocumentRequest(admin, requestId, {
      status: "REJECTED",
      note: "Missing the accelerated condition.",
    });

    const rounds = await listRequestReviews(admin, requestId);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.decision).toBe("CHANGES_REQUESTED");
    expect(rounds[0]?.note).toContain("accelerated");
    expect(rounds[0]?.reviewer?.id).toBe(admin.id);
    expect(rounds[0]?.documentVersion?.version).toBe(1);
  });

  it("keeps the earlier round when a second decision is made", async () => {
    await submitDocumentRequest(supplierUser, requestId, { file: makeFile("study-v2.pdf") });
    await reviewDocumentRequest(admin, requestId, { status: "APPROVED", note: "Complete." });

    const rounds = await listRequestReviews(admin, requestId);
    expect(rounds).toHaveLength(2);
    // Oldest first: the story reads top to bottom.
    expect(rounds[0]?.decision).toBe("CHANGES_REQUESTED");
    expect(rounds[1]?.decision).toBe("APPROVED");
    expect(rounds[1]?.documentVersion?.version).toBe(2);
    expect(rounds[0]?.createdAt.getTime()).toBeLessThanOrEqual(rounds[1]!.createdAt.getTime());

    // `reviewNote` still holds only the current verdict — the history is what
    // makes the earlier reason survive it.
    const row = await db.documentRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { reviewNote: true },
    });
    expect(row.reviewNote).toBe("Complete.");
  });

  it("does not invent a round for a request nobody has decided", async () => {
    const untouched = await createDocumentRequest(admin, {
      projectId,
      title: "Not yet reviewed",
      type: "OTHER",
    });
    expect(await listRequestReviews(admin, untouched.id)).toHaveLength(0);
  });
});

describe("what each side may read of the history", () => {
  it("shows the supplier the decision and the reason, never the reviewer", async () => {
    const rounds = await listRequestReviews(supplierUser, requestId);
    expect(rounds).toHaveLength(2);
    expect(rounds[0]?.note).toContain("accelerated");
    // Withheld by the query, not by the screen.
    expect("reviewer" in rounds[0]!).toBe(false);
    expect(JSON.stringify(rounds)).not.toContain(admin.name);
  });

  it("refuses the history of another supplier's request", async () => {
    await expect(listRequestReviews(otherSupplierUser, requestId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("a file travelling with a message", () => {
  let threadId: string;
  let attachedVersionId: string;

  it("arrives attached to the message that carried it", async () => {
    threadId = await ensureProjectThread(projectId, "History Project");

    await sendMessage(supplierUser, threadId, "Here is the shipping list.", makeFile("list.pdf"));

    const { messages } = await getThread(admin, threadId);
    const withFile = messages.find((message) => message.attachments.length > 0);
    expect(withFile?.body).toBe("Here is the shipping list.");
    expect(withFile?.attachments[0]?.documentVersion.fileName).toBe("list.pdf");

    attachedVersionId = withFile!.attachments[0]!.documentVersion.id;
  });

  it("is downloadable by both sides of the conversation", async () => {
    await expect(requireDocumentVersionAccess(admin, attachedVersionId)).resolves.toMatchObject({
      id: attachedVersionId,
    });
    await expect(
      requireDocumentVersionAccess(supplierUser, attachedVersionId),
    ).resolves.toMatchObject({ id: attachedVersionId });
  });

  it("is not downloadable by a different supplier, even with the id in hand", async () => {
    // The id is the only thing an attacker would have, and it is not enough:
    // the scope is applied inside the lookup.
    await expect(
      requireDocumentVersionAccess(otherSupplierUser, attachedVersionId),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a message with neither text nor file", async () => {
    await expect(sendMessage(supplierUser, threadId, "   ")).rejects.toThrow();
  });

  it("keeps an internal thread's attachment internal", async () => {
    const internalThread = await db.messageThread.create({
      data: { projectId, subject: "Internal notes", withSupplier: false },
      select: { id: true },
    });

    await sendMessage(admin, internalThread.id, "Cost breakdown.", makeFile("costs.pdf"));

    const { messages } = await getThread(admin, internalThread.id);
    const versionId = messages[0]!.attachments[0]!.documentVersion.id;

    const document = await db.documentVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: { document: { select: { visibility: true } } },
    });
    expect(document.document.visibility).toBe("INTERNAL_ONLY");

    // The thread is invisible to the supplier, and so is the file — neither
    // depends on the other being right.
    await expect(getThread(supplierUser, internalThread.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(requireDocumentVersionAccess(supplierUser, versionId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
