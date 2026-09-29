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
  projectId = (await createProject({ organizationId: orgId, supplierId: supplier.id, ownerId: admin.id, name: "Plan A" })).id;
  secondProjectId = (await createProject({ organizationId: orgId, supplierId: supplier.id, ownerId: admin.id, name: "Plan B" })).id;
  otherProjectId = (await createProject({ organizationId: otherOrgId, supplierId: otherSupplier.id, ownerId: otherAdmin.id, name: "Foreign plan" })).id;
  taskId = (await db.task.create({ data: { organizationId: orgId, projectId, createdById: admin.id, title: "Task A" } })).id;
  secondTaskId = (await db.task.create({ data: { organizationId: orgId, projectId: secondProjectId, createdById: admin.id, title: "Task B" } })).id;
});

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
});
