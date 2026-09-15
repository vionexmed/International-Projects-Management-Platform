import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createTask, addTaskComment } from "@/server/services/tasks";
import { uploadDocument } from "@/server/services/documents";
import { notifyOnce } from "@/server/services/notifications";
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
 * Who gets told what.
 *
 * Four notification types were declared in the schema and never emitted, and
 * one was emitted to the wrong audience. The interesting assertions here are
 * the negative ones: a notification that reaches the wrong person is worse
 * than one that never fires, because it leaks and it is trusted.
 */
let organizationId: string;
let admin: SessionUser;
let supplierAUser: SessionUser;
let supplierBUser: SessionUser;
let projectAId: string;

async function notificationsFor(userId: string) {
  return db.notification.findMany({
    where: { userId },
    select: { type: true, title: true, description: true, href: true },
  });
}

beforeAll(async () => {
  const org = await createTestOrg("Notify");
  organizationId = org.id;

  const supplierA = await createSupplier(organizationId, `A ${org.slug}`);
  const supplierB = await createSupplier(organizationId, `B ${org.slug}`, "Germany");

  admin = await createUser({ organizationId, role: "ADMIN" });
  supplierAUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplierA.id,
  });
  supplierBUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplierB.id,
  });

  const project = await createProject({
    organizationId,
    supplierId: supplierA.id,
    ownerId: admin.id,
    name: "Notify Project",
  });
  projectAId = project.id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("tasks waiting on a supplier", () => {
  it("tells the supplier that work is waiting on them", async () => {
    await createTask(admin, {
      projectId: projectAId,
      title: "Send the certificate",
      category: "REGULATORY",
      priority: "HIGH",
      waitingOnSupplier: true,
    });

    const received = await notificationsFor(supplierAUser.id);
    expect(received.some((row) => row.type === "TASK_ASSIGNED")).toBe(true);
  });

  it("never tells a different supplier", async () => {
    const received = await notificationsFor(supplierBUser.id);
    expect(received).toHaveLength(0);
  });

  it("warns about a deadline that is already past", async () => {
    const task = await createTask(admin, {
      projectId: projectAId,
      title: "Late already",
      category: "REGULATORY",
      priority: "HIGH",
      waitingOnSupplier: true,
      dueDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });

    const received = await notificationsFor(supplierAUser.id);
    const overdue = received.filter((row) => row.type === "TASK_OVERDUE");
    expect(overdue.length).toBeGreaterThan(0);
    expect(overdue[0]?.href).toBe(`/tasks/${task.id}`);
  });

  it("does not repeat the same warning", async () => {
    // `notifyOnce` exists because these paths run again on every edit and
    // retry; a bell full of the same line is a bell nobody reads.
    const before = (await notificationsFor(supplierAUser.id)).filter(
      (row) => row.type === "TASK_OVERDUE",
    ).length;

    await notifyOnce({
      userIds: [supplierAUser.id],
      type: "TASK_OVERDUE",
      title: "Late already",
      href: (await notificationsFor(supplierAUser.id)).find((row) => row.type === "TASK_OVERDUE")!
        .href!,
    });

    const after = (await notificationsFor(supplierAUser.id)).filter(
      (row) => row.type === "TASK_OVERDUE",
    ).length;
    expect(after).toBe(before);
  });
});

describe("documents", () => {
  it("tells the project owner when a supplier uploads on their own initiative", async () => {
    await uploadDocument(supplierAUser, {
      projectId: projectAId,
      name: "Renewed certificate",
      type: "CERTIFICATE",
      file: makeFile("certificate.pdf"),
    });

    const received = await notificationsFor(admin.id);
    expect(received.some((row) => row.type === "DOCUMENT_RECEIVED")).toBe(true);
  });

  it("tells the supplier when Vionex shares a document with them", async () => {
    await uploadDocument(admin, {
      projectId: projectAId,
      name: "Shared spec",
      type: "OTHER",
      visibility: "SHARED_WITH_SUPPLIER",
      file: makeFile("spec.pdf"),
    });

    const received = await notificationsFor(supplierAUser.id);
    expect(received.some((row) => row.title === "Shared spec")).toBe(true);
  });

  it("says nothing to the supplier about an internal-only document", async () => {
    await uploadDocument(admin, {
      projectId: projectAId,
      name: "Internal margin analysis",
      type: "COMMERCIAL",
      visibility: "INTERNAL_ONLY",
      file: makeFile("internal.pdf"),
    });

    const received = await notificationsFor(supplierAUser.id);
    expect(received.some((row) => row.title === "Internal margin analysis")).toBe(false);

    // …and the timeline entry for it is internal too, so the file name does
    // not leak through the back door.
    const events = await db.timelineEvent.findMany({
      where: { projectId: projectAId, description: { contains: "Internal margin analysis" } },
      select: { internal: true },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.internal)).toBe(true);
  });
});

describe("internal task comments", () => {
  it("does not notify a supplier member about an internal comment", async () => {
    const task = await createTask(admin, {
      projectId: projectAId,
      title: "Internal review",
      category: "REGULATORY",
      priority: "MEDIUM",
      waitingOnSupplier: true,
      assignedToId: supplierAUser.id,
    });

    const before = (await notificationsFor(supplierAUser.id)).filter(
      (row) => row.type === "COMMENT_ADDED",
    ).length;

    await addTaskComment(admin, task.id, "Discussão interna sobre o fornecedor.", true);

    const after = (await notificationsFor(supplierAUser.id)).filter(
      (row) => row.type === "COMMENT_ADDED",
    ).length;
    expect(after).toBe(before);
  });
});

describe("cross-supplier isolation of notifications", () => {
  it("supplier B never receives anything about supplier A's project", async () => {
    const received = await notificationsFor(supplierBUser.id);
    expect(received).toHaveLength(0);
  });
});
