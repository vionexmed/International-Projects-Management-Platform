import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  requireDocumentRequestAccess,
  requireDocumentVersionAccess,
  requireSharedProjectAccess,
  requireTaskAccess,
  requireThreadAccess,
} from "@/server/authz/access";
import { createDocumentRequest, listRequestReviews, reviewDocumentRequest, submitDocumentRequest, uploadDocument } from "@/server/services/documents";
import { ensureProjectThread, getThread, sendMessage } from "@/server/services/messages";
import { listNotifications } from "@/server/services/notifications";
import { listAttentionItems } from "@/server/services/attention";
import { getPortfolioBreakdown, getSupplierPerformance } from "@/server/services/analytics";
import { listSupplierQueue } from "@/server/services/supplier-queue";
import { listProjectTimeline } from "@/server/services/timeline";
import { createTask } from "@/server/services/tasks";
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
 * The tenant gate, swept with real identifiers.
 *
 * Every other isolation test proves that supplier A's *lists* do not contain
 * supplier B's rows. This one is the harder question: given B's actual primary
 * keys — the thing an attacker has, and the thing a bug leaks — can A reach
 * anything at all? Each accessor is called with an id that exists and belongs
 * to somebody else.
 *
 * Nothing here trusts a screen. Every call is a service or an authorization
 * guard, which is the layer that has to hold when the screen is bypassed.
 */
let organizationId: string;
let admin: SessionUser;
let alice: SessionUser; // supplier A
let bob: SessionUser; // supplier B
let projectB: string;

const ids = {
  request: "",
  version: "",
  task: "",
  thread: "",
  notification: "",
  supplier: "",
  user: "",
  review: "",
  attachment: "",
};

beforeAll(async () => {
  const org = await createTestOrg("Gate");
  organizationId = org.id;

  const supplierA = await createSupplier(organizationId, `A ${org.slug}`);
  const supplierB = await createSupplier(organizationId, `B ${org.slug}`, "Germany");
  ids.supplier = supplierB.id;

  admin = await createUser({ organizationId, role: "ADMIN" });
  alice = await createUser({ organizationId, role: "SUPPLIER_USER", supplierId: supplierA.id });
  bob = await createUser({ organizationId, role: "SUPPLIER_ADMIN", supplierId: supplierB.id });
  ids.user = bob.id;

  // A project of A's, so Alice is a legitimate portal user with data of her own.
  await createProject({
    organizationId,
    supplierId: supplierA.id,
    ownerId: admin.id,
    name: "Alice Project",
  });

  const project = await createProject({
    organizationId,
    supplierId: supplierB.id,
    ownerId: admin.id,
    name: "Bob Secret Project",
  });
  projectB = project.id;

  // A full set of B's rows: request, submitted file, review, task, thread,
  // message with an attachment, notification.
  const request = await createDocumentRequest(admin, {
    projectId: projectB,
    title: "Bob confidential certificate",
    type: "CERTIFICATE",
    createTask: true,
  });
  ids.request = request.id;

  await submitDocumentRequest(bob, request.id, { file: makeFile("bob-secret.pdf") });
  await reviewDocumentRequest(admin, request.id, {
    status: "REJECTED",
    note: "Bob must fix the batch number.",
  });

  const review = await db.documentRequestReview.findFirstOrThrow({
    where: { requestId: request.id },
    select: { id: true },
  });
  ids.review = review.id;

  const version = await db.documentVersion.findFirstOrThrow({
    where: { document: { projectId: projectB } },
    select: { id: true },
  });
  ids.version = version.id;

  const task = await createTask(admin, {
    projectId: projectB,
    title: "Bob shipment plan",
    category: "IMPORT",
    priority: "HIGH",
    waitingOnSupplier: true,
  });
  ids.task = task.id;

  ids.thread = await ensureProjectThread(projectB, "Bob Secret Project");
  await sendMessage(admin, ids.thread, "Confidential pricing for Bob.", makeFile("bob-terms.pdf"));

  const { messages } = await getThread(admin, ids.thread);
  ids.attachment = messages.find((message) => message.attachments.length > 0)!.attachments[0]!
    .documentVersion.id;

  const notification = await db.notification.findFirstOrThrow({
    where: { userId: bob.id },
    select: { id: true },
  });
  ids.notification = notification.id;

  // An internal-only document on B's project, for the payload sweep.
  await uploadDocument(admin, {
    projectId: projectB,
    name: "Bob internal margin",
    type: "COMMERCIAL",
    visibility: "INTERNAL_ONLY",
    file: makeFile("margin.pdf"),
  });
});

afterAll(async () => {
  await db.messageAttachment.deleteMany({
    where: { documentVersion: { document: { organizationId } } },
  });
  await destroyOrg(organizationId);
});

describe("supplier A holding supplier B's identifiers", () => {
  it("cannot reach the project", async () => {
    await expect(requireSharedProjectAccess(alice, projectB)).rejects.toThrow();
  });

  it("cannot reach the document request", async () => {
    await expect(requireDocumentRequestAccess(alice, ids.request)).rejects.toThrow();
  });

  it("cannot reach the submitted file", async () => {
    await expect(requireDocumentVersionAccess(alice, ids.version)).rejects.toThrow();
  });

  it("cannot reach the message attachment", async () => {
    await expect(requireDocumentVersionAccess(alice, ids.attachment)).rejects.toThrow();
  });

  it("cannot reach the task", async () => {
    await expect(requireTaskAccess(alice, ids.task)).rejects.toThrow();
  });

  it("cannot reach the thread", async () => {
    await expect(requireThreadAccess(alice, ids.thread)).rejects.toThrow();
    await expect(getThread(alice, ids.thread)).rejects.toThrow();
  });

  it("cannot reach the review history", async () => {
    await expect(listRequestReviews(alice, ids.request)).rejects.toThrow();
  });

  it("gets nothing from the timeline of a project that is not hers", async () => {
    // The scope answers with an empty history rather than an error: either is
    // safe, and this one says nothing about whether the project exists.
    expect(await listProjectTimeline(alice, projectB)).toHaveLength(0);
  });

  it("cannot read the other company's notifications", async () => {
    const mine = await listNotifications(alice.id, 100);
    expect(mine.map((row) => row.id)).not.toContain(ids.notification);
  });

  it("cannot read the other company's user record through the portal", async () => {
    const { listPortalUsers } = await import("@/server/services/users");
    const users = await listPortalUsers(alice);
    expect(users.map((row) => row.id)).not.toContain(ids.user);
  });

  it("cannot write to the other company's request", async () => {
    await expect(
      submitDocumentRequest(alice, ids.request, { file: makeFile("hijack.pdf") }),
    ).rejects.toThrow();

    await expect(sendMessage(alice, ids.thread, "Hello?")).rejects.toThrow();

    // And nothing moved.
    const request = await db.documentRequest.findUniqueOrThrow({
      where: { id: ids.request },
      select: { status: true },
    });
    expect(request.status).toBe("REJECTED");
  });
});

describe("nothing internal reaches the portal payload", () => {
  const FORBIDDEN = [
    "Bob must fix the batch number",
    "Confidential pricing for Bob",
    "Bob internal margin",
    "Bob confidential certificate",
    "Bob Secret Project",
    "bob-secret.pdf",
    "bob-terms.pdf",
  ];

  it("keeps all of it out of the queue, the exceptions and the aggregates", async () => {
    const payload = JSON.stringify([
      await listSupplierQueue(alice),
      await listAttentionItems(alice, 100),
      await getPortfolioBreakdown(alice),
      await listNotifications(alice.id, 100),
    ]);

    for (const secret of FORBIDDEN) {
      expect(payload).not.toContain(secret);
    }
  });

  it("does not hand a supplier the cross-company analytics at all", async () => {
    /**
     * Supplier performance is a comparison between companies, which is a
     * question only Vionex is entitled to ask. The scope answers it with the
     * caller's own row at most — never a league table.
     */
    const rows = await getSupplierPerformance(alice);
    expect(rows.map((row) => row.id)).not.toContain(ids.supplier);
  });

  it("gives the internal side everything, so the test is proving scope and not emptiness", async () => {
    const payload = JSON.stringify([
      await listAttentionItems(admin, 100),
      await listProjectTimeline(admin, projectB),
    ]);

    expect(payload).toContain("Bob");
  });
});
