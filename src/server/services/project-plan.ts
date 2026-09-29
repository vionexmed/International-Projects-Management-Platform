import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PlanColumnType, Prisma } from "@/generated/prisma";
import { db } from "@/server/db";
import { projectScope } from "@/server/authz/scopes";
import { assertRoleCan } from "@/server/authz/permissions";
import { ForbiddenError, NotFoundError } from "@/server/authz/errors";
import { isSupplierRole, type SessionUser } from "@/types/auth";

export type { PlanColumnType } from "@/generated/prisma";

const types = ["TEXT", "SELECT", "DATE", "NUMBER", "PERSON"] as const;
const optionsSchema = z.array(z.string().trim().min(1).max(80)).max(50);
const definitionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(types),
  options: optionsSchema.default([]),
}).superRefine(({ type, options }, context) => {
  if (type === "SELECT" && options.length === 0) {
    context.addIssue({ code: "custom", path: ["options"], message: "Informe ao menos uma opção." });
  }
  if (type !== "SELECT" && options.length > 0) {
    context.addIssue({ code: "custom", path: ["options"], message: "Este tipo não aceita opções." });
  }
  if (new Set(options).size !== options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "As opções devem ser únicas." });
  }
});

/** Validate at the service boundary, including calls that bypass a server action. */
export function parsePlanColumnDefinition(input: unknown) {
  return definitionSchema.parse(input);
}

export function parsePlanValue(column: { type: PlanColumnType; options: unknown }, value: unknown) {
  const options = optionsSchema.parse(column.options);
  switch (column.type) {
    case "TEXT":
      return z.string().max(4000).parse(value);
    case "SELECT": {
      const selected = z.string().parse(value);
      if (!options.includes(selected)) throw new Error("Opção inválida.");
      return selected;
    }
    case "DATE": {
      const date = z.iso.date().parse(value);
      if (new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
        throw new Error("Data inválida.");
      }
      return date;
    }
    case "NUMBER":
      return z.number().finite().parse(value);
    case "PERSON":
      return z.string().min(1).parse(value);
  }
}

function assertInternal(user: SessionUser, permission: "project:read" | "task:update") {
  assertRoleCan(user.role, permission);
  if (isSupplierRole(user.role)) throw new ForbiddenError();
}

async function requirePlanProject(user: SessionUser, projectId: string) {
  const project = await db.project.findFirst({
    where: { AND: [projectScope(user), { id: projectId }] },
    select: { id: true },
  });
  if (!project) throw new NotFoundError();
  return project;
}

async function requirePlanColumn(user: SessionUser, columnId: string) {
  const column = await db.projectPlanColumn.findFirst({
    where: { id: columnId, project: projectScope(user) },
  });
  if (!column) throw new NotFoundError();
  return column;
}

/** Keep column-schema changes and value writes in the same PostgreSQL row-lock queue. */
async function lockPlanColumn(tx: Prisma.TransactionClient, columnId: string, projectId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "ProjectPlanColumn"
    WHERE "id" = ${columnId} AND "projectId" = ${projectId}
    FOR UPDATE
  `;
  if (rows.length !== 1) throw new NotFoundError();
}

export async function listProjectPlanColumns(user: SessionUser, projectId: string) {
  assertInternal(user, "project:read");
  await requirePlanProject(user, projectId);
  try {
    return await db.projectPlanColumn.findMany({
      where: { projectId },
      include: { values: { select: { taskId: true, value: true } } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  } catch (error) {
    // A deploy can receive the application before its additive migration. The
    // established plan still works without custom fields, so keep it usable
    // instead of turning a missing optional table into a full-page failure.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2021") return [];
    throw error;
  }
}

export async function createProjectPlanColumn(
  user: SessionUser,
  input: { projectId: string; name: string; type: PlanColumnType; options?: string[] },
) {
  assertInternal(user, "task:update");
  const definition = parsePlanColumnDefinition(input);
  await requirePlanProject(user, input.projectId);
  const last = await db.projectPlanColumn.aggregate({
    where: { projectId: input.projectId },
    _max: { position: true },
  });
  return db.projectPlanColumn.create({
    data: {
      projectId: input.projectId,
      key: randomUUID(),
      name: definition.name,
      type: definition.type,
      options: definition.options,
      position: (last._max.position ?? -1) + 1,
    },
  });
}

export async function updateProjectPlanColumn(
  user: SessionUser,
  columnId: string,
  input: { name?: string; visible?: boolean; options?: string[] },
) {
  assertInternal(user, "task:update");
  const accessible = await requirePlanColumn(user, columnId);
  return db.$transaction(async (tx) => {
    await lockPlanColumn(tx, columnId, accessible.projectId);
    const column = await tx.projectPlanColumn.findFirst({
      where: { id: columnId, project: projectScope(user) },
    });
    if (!column) throw new NotFoundError();

    const data: Prisma.ProjectPlanColumnUpdateInput = {};
    if (input.name !== undefined) data.name = z.string().trim().min(1).max(80).parse(input.name);
    if (input.visible !== undefined) data.visible = z.boolean().parse(input.visible);
    if (input.options !== undefined) {
      const definition = parsePlanColumnDefinition({
        name: input.name ?? column.name,
        type: column.type,
        options: input.options,
      });
      if (column.type === "SELECT") {
        const used = await tx.taskPlanValue.findMany({
          where: { columnId: column.id },
          select: { value: true },
        });
        if (used.some(({ value }) => typeof value !== "string" || !definition.options.includes(value))) {
          throw new Error("Uma opção removida ainda está em uso.");
        }
      }
      data.options = definition.options;
    }
    if (Object.keys(data).length === 0) return column;
    return tx.projectPlanColumn.update({ where: { id: column.id }, data });
  }, { timeout: 10_000 });
}

export async function reorderProjectPlanColumns(user: SessionUser, projectId: string, columnIds: string[]) {
  assertInternal(user, "task:update");
  await requirePlanProject(user, projectId);
  const ids = z.array(z.string().min(1)).parse(columnIds);
  const existing = await db.projectPlanColumn.findMany({ where: { projectId }, select: { id: true } });
  if (ids.length !== existing.length || new Set(ids).size !== ids.length ||
      existing.some((column) => !ids.includes(column.id))) {
    throw new NotFoundError();
  }
  await db.$transaction(ids.map((id, position) =>
    db.projectPlanColumn.update({ where: { id }, data: { position } }),
  ));
}

export async function deleteProjectPlanColumn(user: SessionUser, columnId: string) {
  assertInternal(user, "task:update");
  const column = await requirePlanColumn(user, columnId);
  await db.projectPlanColumn.delete({ where: { id: column.id } });
}

export async function setTaskPlanValue(
  user: SessionUser,
  input: { projectId: string; taskId: string; columnId: string; value: unknown },
) {
  assertInternal(user, "task:update");
  await requirePlanProject(user, input.projectId);
  return db.$transaction(async (tx) => {
    await lockPlanColumn(tx, input.columnId, input.projectId);
    const task = await tx.task.findFirst({
      where: { id: input.taskId, projectId: input.projectId, organizationId: user.organizationId },
      select: { id: true },
    });
    const column = await tx.projectPlanColumn.findFirst({
      where: { id: input.columnId, projectId: input.projectId, project: projectScope(user) },
    });
    if (!task || !column) throw new NotFoundError();
    if (input.value === null) {
      await tx.taskPlanValue.deleteMany({ where: { taskId: task.id, columnId: column.id } });
      return null;
    }
    const value = parsePlanValue(column, input.value);
    if (column.type === "PERSON") {
      const person = await tx.user.findFirst({
        where: { id: value as string, organizationId: user.organizationId, status: "ACTIVE", supplierId: null },
        select: { id: true },
      });
      if (!person) throw new NotFoundError();
    }
    return tx.taskPlanValue.upsert({
      where: { taskId_columnId: { taskId: task.id, columnId: column.id } },
      create: { taskId: task.id, columnId: column.id, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }, { timeout: 10_000 });
}
