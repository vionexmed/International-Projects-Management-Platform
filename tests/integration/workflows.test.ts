import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createDocumentRequest,
  listDocumentRequests,
  reviewDocumentRequest,
  submitDocumentRequest,
  uploadDocument,
} from "@/server/services/documents";
import { addTaskComment, createTask, listTasks, updateTask } from "@/server/services/tasks";
import { createProject as createProjectService, recalculateProject } from "@/server/services/projects";
import { ensureProjectThread, listThreads, sendMessage } from "@/server/services/messages";
import { countUnread } from "@/server/services/notifications";
import { requireDocumentVersionAccess } from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
import { storage } from "@/lib/storage";
import {
  createSupplier,
  createTestOrg,
  createUser,
  destroyOrg,
  makeFile,
} from "../factories";
import type { SessionUser } from "@/types/auth";

/**
 * End-to-end behaviour of the flows the MVP is judged on (§67):
 * requesting a document, the supplier answering it, and Vionex seeing it.
 */
const DAY = 24 * 60 * 60 * 1000;

/**
 * Deadlines in these tests are relative to today, never literal dates.
 *
 * `new Date("2026-09-20")` was far in the future when this file was written
 * and three days away by the time it ran again — which is exactly the
 * "deadline approaching" window, so a second notification fired and an
 * assertion of "exactly one" started failing. The test had a shelf life and
 * nobody had noticed; CI would have gone red on a day when nothing changed.
 *
 * Far enough to be outside every window the product reacts to.
 */
const FAR_FUTURE = () => new Date(Date.now() + 60 * DAY);
const LONG_PAST = () => new Date(Date.now() - 180 * DAY);

describe("core workflows", () => {
  let organizationId: string;
  let internal: SessionUser;
  let supplier: SessionUser;
  let otherSupplier: SessionUser;
  let supplierId: string;
  let projectId: string;

  beforeAll(async () => {
    const org = await createTestOrg("Workflows");
    organizationId = org.id;

    const company = await createSupplier(organizationId, "Manufacturer A");
    const other = await createSupplier(organizationId, "Manufacturer B", "Italy");
    supplierId = company.id;

    internal = await createUser({ organizationId, role: "REGULATORY", name: "Stefany" });
    supplier = await createUser({
      organizationId,
      role: "SUPPLIER_ADMIN",
      name: "John Smith",
      supplierId: company.id,
    });
    otherSupplier = await createUser({
      organizationId,
      role: "SUPPLIER_USER",
      name: "Marco",
      supplierId: other.id,
    });
  });

  afterAll(async () => {
    await destroyOrg(organizationId);
  });

  it("creates a project with its four stages and opens the timeline", async () => {
    const project = await createProjectService(internal, {
      name: "Product Omega",
      projectCode: "T-OMEGA",
      supplierId,
      ownerId: internal.id,
      country: "China",
    });
    projectId = project.id;

    const stages = await db.projectStage.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
    });
    expect(stages.map((stage) => stage.key)).toEqual([
      "CLINICAL",
      "REGULATORY",
      "IMPORT_LOGISTICS",
      "GO_TO_MARKET",
    ]);

    const events = await db.timelineEvent.findMany({ where: { projectId } });
    expect(events.some((event) => event.type === "PROJECT_CREATED")).toBe(true);

    const audit = await db.auditLog.findMany({ where: { entity: "Project", entityId: projectId } });
    expect(audit).toHaveLength(1);
  });

  it("creates a task waiting on the supplier and notifies the assignee", async () => {
    const assignee = await createUser({ organizationId, role: "MANAGER", name: "João" });

    const task = await createTask(internal, {
      projectId,
      title: "Certificate of Analysis",
      category: "REGULATORY",
      priority: "HIGH",
      assignedToId: assignee.id,
      waitingOnSupplier: true,
      dueDate: FAR_FUTURE(),
    });

    // The supplier comes from the project, never from the caller.
    expect(task.supplierId).toBe(supplierId);
    expect(await countUnread(assignee.id)).toBe(1);

    // Visible to the supplier it waits on, invisible to any other.
    const asSupplier = await listTasks(supplier);
    expect(asSupplier.items.map((row) => row.id)).toContain(task.id);
    const asOther = await listTasks(otherSupplier);
    expect(asOther.items).toHaveLength(0);
  });

  it("records a comment and its timeline event", async () => {
    const task = await db.task.findFirstOrThrow({ where: { projectId }, orderBy: { createdAt: "asc" } });
    await addTaskComment(internal, task.id, "Solicitação enviada ao fornecedor.");

    const comments = await db.taskComment.findMany({ where: { taskId: task.id } });
    expect(comments).toHaveLength(1);
    expect(comments[0].internal).toBe(true);

    const events = await db.timelineEvent.findMany({
      where: { projectId, type: "COMMENT_ADDED" },
    });
    expect(events).toHaveLength(1);
  });

  it("runs the full document request round-trip", async () => {
    // 1. Vionex requests a document.
    const request = await createDocumentRequest(internal, {
      projectId,
      title: "Certificate of Analysis",
      description: "Please provide the latest COA.",
      type: "CERTIFICATE",
      dueDate: FAR_FUTURE(),
      createTask: true,
    });
    expect(request.status).toBe("PENDING");
    expect(request.supplierId).toBe(supplierId);

    // 2. The supplier sees it; another supplier does not.
    const supplierQueue = await listDocumentRequests(supplier);
    expect(supplierQueue.map((row) => row.id)).toContain(request.id);
    expect((await listDocumentRequests(otherSupplier)).map((row) => row.id)).not.toContain(
      request.id,
    );
    expect(await countUnread(supplier.id)).toBeGreaterThan(0);

    // 3. The supplier answers with a file and a note.
    await submitDocumentRequest(supplier, request.id, {
      file: makeFile("COA_v1.pdf"),
      message: "Please find the COA attached.",
    });

    const submitted = await db.documentRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submittedAt).not.toBeNull();
    expect(submitted.documentId).not.toBeNull();

    const replies = await db.documentRequestReply.findMany({ where: { requestId: request.id } });
    expect(replies).toHaveLength(1);

    // The mirrored internal task moved forward.
    const mirrored = await db.task.findUniqueOrThrow({ where: { id: submitted.taskId! } });
    expect(mirrored.status).toBe("IN_PROGRESS");

    // 4. The document reaches Vionex, is linked to the project, and is stored.
    const document = await db.document.findUniqueOrThrow({
      where: { id: submitted.documentId! },
      include: { versions: true, currentVersion: true },
    });
    expect(document.projectId).toBe(projectId);
    expect(document.visibility).toBe("SHARED_WITH_SUPPLIER");
    expect(document.versions).toHaveLength(1);
    expect(document.currentVersionId).toBe(document.versions[0].id);

    const stored = await storage().get(document.versions[0].storageKey);
    expect(stored.body.byteLength).toBe(2048);

    // 5. Vionex reviews and approves it.
    await reviewDocumentRequest(internal, request.id, {
      status: "APPROVED",
      note: "Thank you, approved.",
    });

    const reviewed = await db.documentRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(reviewed.status).toBe("APPROVED");
    expect(
      (await db.document.findUniqueOrThrow({ where: { id: document.id } })).status,
    ).toBe("APPROVED");

    // 6. The whole exchange is on the project timeline.
    const types = (await db.timelineEvent.findMany({ where: { projectId } })).map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(["DOCUMENT_REQUESTED", "DOCUMENT_SUBMITTED", "DOCUMENT_REVIEWED"]),
    );
  });

  it("adds a second version instead of replacing the first", async () => {
    const document = await db.document.findFirstOrThrow({ where: { projectId }, orderBy: { createdAt: "asc" } });

    await uploadDocument(supplier, {
      projectId,
      documentId: document.id,
      file: makeFile("COA_v2.pdf"),
    });

    const updated = await db.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { versions: { orderBy: { version: "asc" } } },
    });

    expect(updated.versions).toHaveLength(2);
    expect(updated.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(updated.currentVersionId).toBe(updated.versions[1].id);
    // The earlier file is still retrievable.
    expect(updated.versions[0].fileName).toBe("COA_v1.pdf");
  });

  it("only lets the owning supplier download a stored file", async () => {
    const version = await db.documentVersion.findFirstOrThrow({
      where: { document: { projectId } },
      orderBy: { createdAt: "asc" },
    });

    await expect(requireDocumentVersionAccess(supplier, version.id)).resolves.toMatchObject({
      id: version.id,
    });
    await expect(requireDocumentVersionAccess(otherSupplier, version.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("rejects a disallowed file type", async () => {
    await expect(
      uploadDocument(internal, {
        projectId,
        file: makeFile("payload.exe", "application/x-msdownload"),
      }),
    ).rejects.toThrow(/não permitido/i);
  });

  it("rejects a file whose extension contradicts its type", async () => {
    await expect(
      uploadDocument(internal, {
        projectId,
        file: makeFile("invoice.exe", "application/pdf"),
      }),
    ).rejects.toThrow(/extensão/i);
  });

  it("carries messages both ways on the project thread", async () => {
    const threadId = await ensureProjectThread(projectId, "Product Omega");
    // Calling again reuses the same thread.
    expect(await ensureProjectThread(projectId, "Product Omega")).toBe(threadId);

    await sendMessage(internal, threadId, "Could you send the latest COA?");
    await sendMessage(supplier, threadId, "Sure, we will upload it today.");

    const messages = await db.message.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } });
    expect(messages).toHaveLength(2);

    const supplierThreads = await listThreads(supplier);
    expect(supplierThreads.map((thread) => thread.id)).toContain(threadId);
    expect((await listThreads(otherSupplier)).map((thread) => thread.id)).not.toContain(threadId);
  });

  it("re-derives project status from its tasks", async () => {
    await db.task.create({
      data: {
        organizationId,
        projectId,
        createdById: internal.id,
        title: "Overdue critical item",
        category: "REGULATORY",
        priority: "URGENT",
        status: "WAITING",
        dueDate: LONG_PAST(),
      },
    });

    await recalculateProject(projectId, internal.id);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status).toBe("AT_RISK");

    // An explicit blocker outranks the overdue task.
    await db.project.update({
      where: { id: projectId },
      data: { blockerNote: "Aguardando parecer do comitê." },
    });
    await recalculateProject(projectId, internal.id);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status).toBe("BLOCKED");
  });

  it("marks a task completed and stamps completedAt", async () => {
    const task = await db.task.findFirstOrThrow({
      where: { projectId, status: { not: "COMPLETED" } },
      orderBy: { createdAt: "asc" },
    });

    await updateTask(internal, task.id, { status: "COMPLETED" });
    const done = await db.task.findUniqueOrThrow({ where: { id: task.id } });

    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).not.toBeNull();
  });

  it("refuses to let a supplier upload into another supplier's project", async () => {
    await expect(
      uploadDocument(otherSupplier, { projectId, file: makeFile("sneaky.pdf") }),
    ).rejects.toThrow(/não encontrado/i);
  });
});
