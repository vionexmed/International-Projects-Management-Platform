"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { createProject, recalculateProject } from "@/server/services/projects";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { recordTimelineEvent } from "@/server/services/timeline";
import { ensureProjectThread } from "@/server/services/messages";
import {
  optionalDate,
  optionalText,
  parseForm,
  toActionError,
  type ActionState,
} from "@/server/actions/utils";

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do projeto.").max(120),
  projectCode: z
    .string()
    .trim()
    .min(2, "Informe o código do projeto.")
    .max(24)
    .regex(/^[A-Za-z0-9-]+$/, "Use apenas letras, números e hífen."),
  supplierId: z.string().min(1, "Selecione um fornecedor."),
  ownerId: z.string().min(1, "Selecione um responsável."),
  country: z.string().trim().min(2, "Informe o país."),
  productType: optionalText,
  category: optionalText,
  description: optionalText,
  startDate: optionalDate,
  targetLaunchDate: optionalDate,
});

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("project:create");
    const input = parseForm(createSchema, formData);

    const project = await createProject(user, {
      ...input,
      projectCode: input.projectCode.toUpperCase(),
    });

    await ensureProjectThread(project.id, project.name);

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { ok: true, createdId: project.id };
  } catch (error) {
    return toActionError(error);
  }
}

const updateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  ownerId: z.string().min(1),
  country: z.string().trim().min(2),
  productType: optionalText,
  category: optionalText,
  description: optionalText,
  blockerNote: optionalText,
  status: z.enum(["ON_TRACK", "AT_RISK", "BLOCKED", "COMPLETED"]),
  startDate: optionalDate,
  targetLaunchDate: optionalDate,
});

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("project:update");
    const { projectId, ...input } = parseForm(updateSchema, formData);
    const existing = await requireProjectAccess(user, projectId);

    await db.project.update({ where: { id: projectId }, data: input });

    await recordTimelineEvent({
      projectId,
      actorId: user.id,
      type: input.status !== existing.status ? "STATUS_CHANGED" : "PROJECT_UPDATED",
      description:
        input.status !== existing.status
          ? `Status do projeto alterado para ${input.status.replace("_", " ").toLowerCase()}.`
          : "Dados do projeto atualizados.",
    });

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "project.update",
      entity: "Project",
      entityId: projectId,
    });

    // A manual status choice is respected; derivation only fills the gaps.
    if (input.status === existing.status) {
      await recalculateProject(projectId, user.id);
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

const stageSchema = z.object({
  projectId: z.string().min(1),
  stageId: z.string().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"]),
  progress: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null;
    }),
  notes: optionalText,
});

export async function updateStageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("project:update");
    const input = parseForm(stageSchema, formData);
    await requireProjectAccess(user, input.projectId);

    const stage = await db.projectStage.findFirst({
      where: { id: input.stageId, projectId: input.projectId },
      select: { id: true, name: true },
    });
    if (!stage) throw new Error("Etapa não encontrada.");

    await db.projectStage.update({
      where: { id: stage.id },
      data: { status: input.status, progress: input.progress, notes: input.notes },
    });

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
      description: `Etapa ${stage.name} atualizada.`,
    });

    await recalculateProject(input.projectId, user.id);
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
