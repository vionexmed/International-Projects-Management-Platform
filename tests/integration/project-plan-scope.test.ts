import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/authz/errors";
import {
  createProjectPlanColumn,
  deleteProjectPlanColumn,
  listProjectPlanColumns,
  reorderProjectPlanColumns,
  setTaskPlanValue,
  updateProjectPlanColumn,
} from "@/server/services/project-plan";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

let orgId: string;
let otherOrgId: string;
let admin: SessionUser;
let foreignAdmin: SessionUser;
let viewer: SessionUser;
let supplierUser: SessionUser;
let projectId: string;
let secondProjectId: string;
let otherProjectId: string;
let taskId: string;
let secondTaskId: string;

beforeAll(async () => {
  const org = await createTestOrg("Plan");
  const otherOrg = await createTestOrg("PlanOther");
  orgId = org.id;
  otherOrgId = otherOrg.id;
  const supplier = await createSupplier(orgId, "Plan supplier");
  const otherSupplier = await createSupplier(otherOrgId, "Other supplier");
  admin = await createUser({ organizationId: orgId, role: "ADMIN" });
  viewer = await createUser({ organizationId: orgId, role: "VIEWER" });
  supplierUser = await createUser({ organizationId: orgId, role: "SUPPLIER_USER", supplierId: supplier.id });
  const otherAdmin = await createUser({ organizationId: otherOrgId, role: "ADMIN" });
  foreignAdmin = otherAdmin;
  projectId = (await createProject({ organizationId: orgId, supplierId: supplier.id, ownerId: admin.id, name: "Plan A" })).id;
  secondProjectId = (await createProject({ organizationId: orgId, supplierId: supplier.id, ownerId: admin.id, name: "Plan B" })).id;
  otherProjectId = (await createProject({ organizationId: otherOrgId, supplierId: otherSupplier.id, ownerId: otherAdmin.id, name: "Foreign plan" })).id;
  taskId = (await db.task.create({ data: { organizationId: orgId, projectId, createdById: admin.id, title: "Task A" } })).id;
  secondTaskId = (await db.task.create({ data: { organizationId: orgId, projectId: secondProjectId, createdById: admin.id, title: "Task B" } })).id;
});

/** Wait for a query to reach PostgreSQL's row lock, rather than guessing with a sleep. */
async function waitForLockWaiters(expected: number) {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const [row] = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND pid <> pg_backend_pid()
    `;
    if (Number(row.count) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${expected} PostgreSQL lock waiter(s).`);
}

afterAll(async () => {
  if (orgId) await destroyOrg(orgId);
  if (otherOrgId) await destroyOrg(otherOrgId);
});

describe("project plan scope", () => {
  it("stores ordered columns and unique task values, and removes values with their column", async () => {
    const first = await createProjectPlanColumn(admin, { projectId, name: "Note", type: "TEXT" });
    const second = await createProjectPlanColumn(admin, { projectId, name: "Score", type: "NUMBER" });
    expect(first.key).toBeTruthy();
    expect(first.key).not.toBe(second.key);
    await setTaskPlanValue(admin, { projectId, taskId, columnId: first.id, value: "Draft" });
    await setTaskPlanValue(admin, { projectId, taskId, columnId: first.id, value: "Final" });
    expect(await db.taskPlanValue.count({ where: { taskId, columnId: first.id } })).toBe(1);
    await reorderProjectPlanColumns(admin, projectId, [second.id, first.id]);
    expect((await listProjectPlanColumns(admin, projectId)).map((column) => column.id)).toEqual([second.id, first.id]);
    await updateProjectPlanColumn(admin, first.id, { name: "Comment", visible: false });
    expect((await listProjectPlanColumns(admin, projectId)).find((column) => column.id === first.id)).toMatchObject({ name: "Comment", visible: false });
    await deleteProjectPlanColumn(admin, first.id);
    expect(await db.taskPlanValue.count({ where: { taskId, columnId: first.id } })).toBe(0);
  });

  it("rejects cross-project and cross-organization identifiers", async () => {
    const column = await createProjectPlanColumn(admin, { projectId, name: "Scope", type: "TEXT" });
    await expect(setTaskPlanValue(admin, { projectId, taskId: secondTaskId, columnId: column.id, value: "wrong" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setTaskPlanValue(admin, { projectId: secondProjectId, taskId: secondTaskId, columnId: column.id, value: "wrong" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createProjectPlanColumn(admin, { projectId: otherProjectId, name: "Wrong", type: "TEXT" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(listProjectPlanColumns(admin, otherProjectId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(reorderProjectPlanColumns(admin, projectId, [column.id, "foreign"])).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies supplier and viewer mutations and supplier reads", async () => {
    await expect(createProjectPlanColumn(viewer, { projectId, name: "Denied", type: "TEXT" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createProjectPlanColumn(supplierUser, { projectId, name: "Denied", type: "TEXT" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listProjectPlanColumns(supplierUser, projectId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps a select option while a task value uses it", async () => {
    const column = await createProjectPlanColumn(admin, {
      projectId,
      name: "Phase",
      type: "SELECT",
      options: ["Draft", "Final"],
    });
    await setTaskPlanValue(admin, { projectId, taskId, columnId: column.id, value: "Draft" });

    await expect(updateProjectPlanColumn(admin, column.id, { options: ["Final"] })).rejects.toThrow();
    expect((await db.projectPlanColumn.findUnique({ where: { id: column.id } }))?.options).toEqual(["Draft", "Final"]);
    expect((await db.taskPlanValue.findUnique({ where: { taskId_columnId: { taskId, columnId: column.id } } }))?.value).toBe("Draft");
  });

  it("preserves a newer options change when renaming a column", async () => {
    const column = await createProjectPlanColumn(admin, {
      projectId, name: "Phase", type: "SELECT", options: ["Draft", "Final"],
    });
    let release!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProjectPlanColumn" WHERE id = ${column.id} FOR UPDATE`;
      locked();
      await hold;
      await tx.projectPlanColumn.update({ where: { id: column.id }, data: { options: ["Final"] } });
    }, { timeout: 10_000 });
    await ready;
    const rename = updateProjectPlanColumn(admin, column.id, { name: "Delivery phase" });
    try {
      await waitForLockWaiters(1);
    } finally {
      release();
      await blocker;
    }
    await rename;
    expect(await db.projectPlanColumn.findUnique({ where: { id: column.id } })).toMatchObject({
      name: "Delivery phase", options: ["Final"],
    });
  });

  it("serializes SELECT value writes with option changes", async () => {
    const column = await createProjectPlanColumn(admin, {
      projectId, name: "Status", type: "SELECT", options: ["Draft", "Final"],
    });
    let release!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProjectPlanColumn" WHERE id = ${column.id} FOR UPDATE`;
      locked();
      await hold;
    }, { timeout: 10_000 });
    await ready;
    const save = setTaskPlanValue(admin, { projectId, taskId, columnId: column.id, value: "Draft" });
    const change = updateProjectPlanColumn(admin, column.id, { options: ["Final"] });
    try {
      await waitForLockWaiters(2);
    } finally {
      release();
      await blocker;
    }
    const outcomes = await Promise.allSettled([save, change]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const stored = await db.taskPlanValue.findUnique({ where: { taskId_columnId: { taskId, columnId: column.id } } });
    const current = await db.projectPlanColumn.findUniqueOrThrow({ where: { id: column.id } });
    if (stored) expect(current.options).toContain(stored.value);
  });

  it("rejects foreign and supplier PERSON values and clears a value with null", async () => {
    const column = await createProjectPlanColumn(admin, { projectId, name: "Owner", type: "PERSON" });
    await expect(setTaskPlanValue(admin, { projectId, taskId, columnId: column.id, value: foreignAdmin.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setTaskPlanValue(admin, { projectId, taskId, columnId: column.id, value: supplierUser.id })).rejects.toBeInstanceOf(NotFoundError);
    await setTaskPlanValue(admin, { projectId, taskId, columnId: column.id, value: admin.id });
    expect((await db.taskPlanValue.findUnique({ where: { taskId_columnId: { taskId, columnId: column.id } } }))?.value).toBe(admin.id);
    await setTaskPlanValue(admin, { projectId, taskId, columnId: column.id, value: null });
    expect(await db.taskPlanValue.count({ where: { taskId, columnId: column.id } })).toBe(0);
  });
});
