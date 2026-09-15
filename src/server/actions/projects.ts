"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, requirePermission, requireUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { STAGE_PERMISSION } from "@/server/authz/permissions";
import { ForbiddenError } from "@/server/authz/errors";
import {
  createProject,
  recalculateProject,
  setProjectArchived,
} from "@/server/services/projects";
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

/**
 * Archive or reopen. One action for both directions so the pair can never
 * drift apart — an archive with no way back is a delete in disguise.
 */
export async function setProjectArchivedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("project:archive");
    const input = parseForm(
      z.object({
        projectId: z.string().min(1),
        archived: z
          .string()
          .optional()
          .transform((value) => value === "true" || value === "on"),
      }),
      formData,
    );

    await setProjectArchived(user, input.projectId, input.archived);

    revalidatePath("/projects");
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return { ok: true, createdId: input.projectId };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateStageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const input = parseForm(stageSchema, formData);
    await requireProjectAccess(user, input.projectId);

    const stage = await db.projectStage.findFirst({
      where: { id: input.stageId, projectId: input.projectId },
      select: { id: true, name: true, key: true },
    });
    if (!stage) throw new Error("Etapa não encontrada.");

    /**
     * The stage decides who may edit it. Checked after the lookup because the
     * permission depends on which stage this is — and before any write, so an
     * unauthorised caller changes nothing.
     */
    if (!can(user, STAGE_PERMISSION[stage.key])) throw new ForbiddenError();

    await db.projectStage.update({
      where: { id: stage.id },
      data: { status: input.status, progress: input.progress, notes: input.notes },
    });

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
      description: `Etapa ${stage.name} atualizada.`,
      // Stage status, progress and notes are how Vionex tracks its own work.
      internal: true,
    });

    await recalculateProject(input.projectId, user.id);
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
