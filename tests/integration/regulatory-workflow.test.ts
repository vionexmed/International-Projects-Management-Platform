import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createDocumentRequest,
  listDocumentRequests,
  reviewDocumentRequest,
  submitDocumentRequest,
} from "@/server/services/documents";
import { requireDocumentRequestAccess } from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
import { listProjectTimeline } from "@/server/services/timeline";
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
 * The document cycle, start to finish.
 *
 * This is the workflow the platform exists for: Vionex asks a manufacturer for
 * a document, the manufacturer answers, Vionex reads it and decides. It used to
 * have no ending — a rejection was terminal, an approval left the mirror task
 * open forever, and each review overwrote the reason for the last one.
 *
 * One test walks the whole path rather than several testing pieces of it,
 * because the failures that mattered were all in the joins.
 */
let organizationId: string;
let admin: SessionUser;
let supplierUser: SessionUser;
let otherSupplierUser: SessionUser;
let projectId: string;
let requestId: string;

async function request() {
  return db.documentRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      status: true,
      reviewNote: true,
      submittedAt: true,
      reviewedAt: true,
      taskId: true,
      documentId: true,
    },
  });
}

async function mirrorTask() {
  const { taskId } = await request();
  if (!taskId) return null;
  return db.task.findUnique({
    where: { id: taskId },
    select: { status: true, completedAt: true },
  });
}

beforeAll(async () => {
  const org = await createTestOrg("Workflow");
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
    name: "Workflow Project",
  });
  projectId = project.id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("the document cycle, end to end", () => {
  it("1 · Vionex asks for a document, and a mirror task opens", async () => {
    const created = await createDocumentRequest(admin, {
      projectId,
      title: "Certificate of Analysis",
      description: "Batch 2026-A.",
      type: "CERTIFICATE",
      createTask: true,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    requestId = created.id;

    const state = await request();
    expect(state.status).toBe("PENDING");
    expect(state.taskId).toBeTruthy();
    expect((await mirrorTask())?.status).toBe("WAITING");
  });

  it("2 · the supplier sees it, and nobody else does", async () => {
    const mine = await listDocumentRequests(supplierUser);
    expect(mine.map((row) => row.id)).toContain(requestId);

    const theirs = await listDocumentRequests(otherSupplierUser);
    expect(theirs.map((row) => row.id)).not.toContain(requestId);

    await expect(requireDocumentRequestAccess(otherSupplierUser, requestId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("3 · the supplier submits a file", async () => {
    await submitDocumentRequest(supplierUser, requestId, {
      file: makeFile("coa-v1.pdf"),
      message: "First version attached.",
    });

    const state = await request();
    expect(state.status).toBe("SUBMITTED");
    expect(state.documentId).toBeTruthy();
    expect((await mirrorTask())?.status).toBe("IN_PROGRESS");
  });

  it("4 · and cannot quietly replace it while Vionex is reading", async () => {
    // This used to be allowed, which let a supplier swap the file underneath a
    // reviewer mid-decision.
    await expect(
      submitDocumentRequest(supplierUser, requestId, { file: makeFile("sneaky.pdf") }),
    ).rejects.toThrow(/análise/i);
  });

  it("5 · the reviewer can open the exact file being judged", async () => {
    const [row] = await listDocumentRequests(admin, { projectId });
    expect(row.document?.currentVersion?.id).toBeTruthy();
    expect(row.document?.currentVersion?.fileName).toBe("coa-v1.pdf");
    expect(row.document?.currentVersion?.version).toBe(1);
  });

  it("6 · Vionex asks for changes, and the ball goes back to the supplier", async () => {
    await reviewDocumentRequest(admin, requestId, {
      status: "REJECTED",
      note: "Batch number does not match the shipment.",
    });

    const state = await request();
    expect(state.status).toBe("REJECTED");
    expect(state.reviewNote).toContain("Batch number");
    // Waiting on the supplier again — not closed, not in progress.
    expect((await mirrorTask())?.status).toBe("WAITING");
  });

  it("7 · the supplier sends a corrected version, keeping the first one", async () => {
    await submitDocumentRequest(supplierUser, requestId, {
      file: makeFile("coa-v2.pdf"),
      message: "Corrected batch number.",
    });

    const state = await request();
    expect(state.status).toBe("SUBMITTED");

    // Both versions survive: evidence is never replaced, only added to.
    const versions = await db.documentVersion.findMany({
      where: { documentId: state.documentId! },
      orderBy: { version: "asc" },
      select: { version: true, fileName: true },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.fileName).toBe("coa-v1.pdf");
    expect(versions[1]?.fileName).toBe("coa-v2.pdf");
  });

  it("8 · and the reason for the earlier rejection is still readable", async () => {
    // `reviewNote` holds the current verdict and was cleared by the new
    // submission. The reason itself lives on in the conversation.
    const state = await request();
    expect(state.reviewNote).toBeNull();

    const detail = await requireDocumentRequestAccess(supplierUser, requestId);
    const bodies = detail.replies.map((reply) => reply.body);
    expect(bodies).toContain("Batch number does not match the shipment.");
    expect(bodies).toContain("First version attached.");
    expect(bodies).toContain("Corrected batch number.");
  });

  it("9 · the conversation says who wrote each line", async () => {
    // Now a real relation, joined by the database rather than resolved by hand.
    const detail = await requireDocumentRequestAccess(supplierUser, requestId);

    const rejection = detail.replies.find((reply) => reply.body.startsWith("Batch number"));
    expect(rejection?.author.supplierId).toBeNull();
    expect(rejection?.author.name).toBeTruthy();

    const answer = detail.replies.find((reply) => reply.body === "Corrected batch number.");
    expect(answer?.author.supplierId).toBeTruthy();
  });

  it("10 · Vionex approves, and the mirror task finally closes", async () => {
    await reviewDocumentRequest(admin, requestId, { status: "APPROVED", note: "Approved." });

    const state = await request();
    expect(state.status).toBe("APPROVED");

    const task = await mirrorTask();
    expect(task?.status).toBe("COMPLETED");
    expect(task?.completedAt).toBeInstanceOf(Date);
  });

  it("11 · and the supplier cannot reopen a closed request on their own", async () => {
    await expect(
      submitDocumentRequest(supplierUser, requestId, { file: makeFile("late.pdf") }),
    ).rejects.toThrow(/aprovada/i);
  });

  it("12 · the timeline tells the story, and only the shareable half", async () => {
    const supplierView = JSON.stringify(await listProjectTimeline(supplierUser, projectId));

    // The document conversation is shared work: the supplier sees it.
    expect(supplierView).toContain("Certificate of Analysis");

    // Every event the supplier can see is marked shareable.
    const leaked = await db.timelineEvent.findMany({
      where: { projectId, internal: true },
      select: { description: true },
    });
    for (const event of leaked) {
      expect(supplierView).not.toContain(event.description);
    }
  });

  it("13 · both sides were notified at the right moments", async () => {
    const supplierNotices = await db.notification.findMany({
      where: { userId: supplierUser.id },
      select: { type: true, description: true },
    });
    const internalNotices = await db.notification.findMany({
      where: { userId: admin.id },
      select: { type: true },
    });

    expect(supplierNotices.some((row) => row.type === "DOCUMENT_REQUESTED")).toBe(true);
    expect(supplierNotices.some((row) => row.type === "DOCUMENT_REVIEWED")).toBe(true);
    // The verdict is in the notification, not hidden behind a click.
    expect(supplierNotices.some((row) => row.description?.includes("Changes requested"))).toBe(true);
    expect(supplierNotices.some((row) => row.description === "Approved.")).toBe(true);

    expect(internalNotices.some((row) => row.type === "SUPPLIER_REPLIED")).toBe(true);

    // And the other supplier heard nothing about any of it.
    const outsider = await db.notification.count({ where: { userId: otherSupplierUser.id } });
    expect(outsider).toBe(0);
  });
});
