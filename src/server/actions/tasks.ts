"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { addTaskComment, createTask, updateTask } from "@/server/services/tasks";
import {
  optionalDate,
  optionalText,
  parseForm,
  toActionError,
  type ActionState,
} from "@/server/actions/utils";

const CATEGORIES = ["CLINICAL", "REGULATORY", "IMPORT", "GO_TO_MARKET", "GENERAL"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED"] as const;

const createSchema = z.object({
  projectId: z.string().min(1, "Selecione um projeto."),
  title: z.string().trim().min(2, "Informe o título da tarefa.").max(160),
  description: optionalText,
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  assignedToId: optionalText,
  waitingOnSupplier: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  dueDate: optionalDate,
});

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:create");
    const input = parseForm(createSchema, formData);

    const task = await createTask(user, {
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate,
      waitingOnSupplier: input.waitingOnSupplier,
    });

    revalidatePath("/tasks");
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true, createdId: task.id };
  } catch (error) {
    return toActionError(error);
  }
}

const updateSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(2).max(160).optional(),
  description: optionalText,
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(STATUSES).optional(),
  assignedToId: optionalText,
  dueDate: optionalDate,
});

export async function updateTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const { taskId, ...input } = parseForm(updateSchema, formData);

    await updateTask(user, taskId, input);

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Single-field status change used by the row and detail quick actions. */
export async function setTaskStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const input = parseForm(
      z.object({ taskId: z.string().min(1), status: z.enum(STATUSES) }),
      formData,
    );

    await updateTask(user, input.taskId, { status: input.status });

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${input.taskId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function addTaskCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("task:update");
    const input = parseForm(
      z.object({
        taskId: z.string().min(1),
        body: z.string().trim().min(1, "Escreva um comentário.").max(4000),
      }),
      formData,
    );

    await addTaskComment(user, input.taskId, input.body, true);

    revalidatePath(`/tasks/${input.taskId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
