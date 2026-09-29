"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { requireProjectAccess, requireTaskAccess } from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
import {
  createProjectPlanColumn,
  deleteProjectPlanColumn,
  listProjectPlanColumns,
  reorderProjectPlanColumns,
  setTaskPlanValue,
  updateProjectPlanColumn,
} from "@/server/services/project-plan";
import { parseForm, toActionError, type ActionState } from "@/server/actions/utils";
import type { SessionUser } from "@/types/auth";

const projectIdSchema = z.string().min(1);
const columnIdSchema = z.string().min(1);
const types = ["TEXT", "SELECT", "DATE", "NUMBER", "PERSON"] as const;

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Valor inválido.");
  }
}

function parseOptions(value: string | undefined) {
  return value === undefined ? undefined : z.array(z.string()).parse(parseJson(value));
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}`);
}

async function requireColumnInProject(user: SessionUser, projectId: string, columnId: string) {
  const columns = await listProjectPlanColumns(user, projectId);
  if (!columns.some((column) => column.id === columnId)) throw new NotFoundError();
}

export async function createProjectPlanColumnAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const input = parseForm(z.object({
      projectId: projectIdSchema,
      name: z.string().min(1),
      type: z.enum(types),
      options: z.string().optional(),
    }), formData);
    await requireProjectAccess(user, input.projectId);
    const column = await createProjectPlanColumn(user, { ...input, options: parseOptions(input.options) });
    refresh(input.projectId);
    return { ok: true, createdId: column.id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProjectPlanColumnAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const input = parseForm(z.object({
      projectId: projectIdSchema,
      columnId: columnIdSchema,
      name: z.string().optional(),
      visible: z.enum(["true", "false"]).optional(),
      options: z.string().optional(),
    }), formData);
    await requireProjectAccess(user, input.projectId);
    await requireColumnInProject(user, input.projectId, input.columnId);
    await updateProjectPlanColumn(user, input.columnId, {
      name: input.name,
      visible: input.visible === undefined ? undefined : input.visible === "true",
      options: parseOptions(input.options),
    });
    refresh(input.projectId);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reorderProjectPlanColumnsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const input = parseForm(z.object({ projectId: projectIdSchema, columnIds: z.string() }), formData);
    await requireProjectAccess(user, input.projectId);
    const ids = z.array(columnIdSchema).parse(parseJson(input.columnIds));
    await reorderProjectPlanColumns(user, input.projectId, ids);
    refresh(input.projectId);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProjectPlanColumnAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const input = parseForm(z.object({ projectId: projectIdSchema, columnId: columnIdSchema }), formData);
    await requireProjectAccess(user, input.projectId);
    await requireColumnInProject(user, input.projectId, input.columnId);
    await deleteProjectPlanColumn(user, input.columnId);
    refresh(input.projectId);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setTaskPlanValueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const input = parseForm(z.object({
      projectId: projectIdSchema,
      taskId: z.string().min(1),
      columnId: columnIdSchema,
      valueJson: z.string(),
    }), formData);
    await requireProjectAccess(user, input.projectId);
    const task = await requireTaskAccess(user, input.taskId);
    if (task.projectId !== input.projectId) throw new NotFoundError();
    await requireColumnInProject(user, input.projectId, input.columnId);
    await setTaskPlanValue(user, {
      projectId: input.projectId,
      taskId: input.taskId,
      columnId: input.columnId,
      value: parseJson(input.valueJson),
    });
    refresh(input.projectId);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
