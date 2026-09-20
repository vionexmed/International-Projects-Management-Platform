"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, requirePermission, requireUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { STAGE_PERMISSION } from "@/server/authz/permissions";
import { ForbiddenError } from "@/server/authz/errors";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { recordTimelineEvent } from "@/server/services/timeline";
import { recalculateProject } from "@/server/services/projects";
import { notifyAboutDeadline } from "@/server/services/tasks";
import {
  optionalDate,
  optionalText,
  parseForm,
  toActionError,
  type ActionState,
} from "@/server/actions/utils";

const TASK_STATUS = ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED"] as const;

/**
 * `ownerName`/`owner` on the regulatory and GTM item forms have always been
 * free text, never a real account, and always labelled "Vionex" ownership.
 * Rather than add a user-picker to either form — a new field the plan's own
 * "sem escrever nada novo" explicitly argues against — a name that matches an
 * internal account in the same organisation resolves to it automatically,
 * exactly as the migration that folded existing rows into `Task` did.
 * `supplierId: null` matters here: matching into the organisation alone would
 * let a supplier contact who happens to share a name with the intended
 * person be assigned an internal task. A name with no matching internal
 * account is kept as a plain note instead of silently dropped.
 */
async function resolveOwnerByName(organizationId: string, name: string | null) {
  if (!name) return { assignedToId: null as string | null, unmatchedName: null as string | null };
  const match = await db.user.findFirst({
    where: { organizationId, supplierId: null, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return match
    ? { assignedToId: match.id, unmatchedName: null as string | null }
    : { assignedToId: null as string | null, unmatchedName: name };
}

function withOwnerNote(description: string | null, unmatchedName: string | null) {
  if (!unmatchedName) return description;
  return description ? `${description}\n\nResponsável: ${unmatchedName}` : `Responsável: ${unmatchedName}`;
}

/**
 * Stage-detail mutations (Clinical, Regulatory, Import, Go-to-Market).
 * Each one re-verifies project access before touching a child record, so a
 * guessed child id cannot be used to reach another organisation's data.
 */

const clinicalSchema = z.object({
  projectId: z.string().min(1),
  institution: optionalText,
  country: optionalText,
  protocol: optionalText,
  studyType: optionalText,
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "SUSPENDED"]),
  startDate: optionalDate,
  expectedCompletion: optionalDate,
  notes: optionalText,
});

export async function saveClinicalStudyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("clinical:manage");
    const { projectId, ...input } = parseForm(clinicalSchema, formData);
    await requireProjectAccess(user, projectId);

    await db.clinicalStudy.upsert({
      where: { projectId },
      create: { projectId, ...input },
      update: input,
    });

    await recordTimelineEvent({
      projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
      description: "Estudo clínico atualizado.",
      // The clinical study is Vionex's own work; the supplier follows the
      // documents it produces, not the study record itself.
      internal: true,
    });
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "project.update",
      entity: "ClinicalStudy",
      entityId: projectId,
    });

    revalidatePath(`/projects/${projectId}/clinical`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createRegulatoryItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("regulatory:manage");
    const input = parseForm(
      z.object({
        projectId: z.string().min(1),
        title: z.string().trim().min(2, "Informe o item.").max(160),
        authority: optionalText,
        requestedFrom: optionalText,
        ownerName: optionalText,
        dueDate: optionalDate,
        notes: optionalText,
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    const owner = await resolveOwnerByName(user.organizationId, input.ownerName);

    const task = await db.task.create({
      data: {
        organizationId: user.organizationId,
        projectId: input.projectId,
        createdById: user.id,
        assignedToId: owner.assignedToId,
        title: input.title,
        description: withOwnerNote(input.notes, owner.unmatchedName),
        category: "REGULATORY",
        priority: "MEDIUM",
        authority: input.authority,
        requestedFrom: input.requestedFrom,
        dueDate: input.dueDate,
      },
    });

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "TASK_CREATED",
      description: `Item regulatório "${task.title}" adicionado.`,
      // Vionex's submission tracking with the health authority.
      internal: true,
    });

    await notifyAboutDeadline({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      assignedToId: task.assignedToId,
      supplierId: task.supplierId,
    });

    // A new item can already be overdue (a back-dated deadline) or push the
    // project past its "on track" threshold — the same rule task creation
    // triggers, applied here for the first time.
    await recalculateProject(input.projectId, user.id);

    revalidatePath(`/projects/${input.projectId}/regulatory`);
    revalidatePath("/regulatory");
    return { ok: true, createdId: task.id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateRegulatoryItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("regulatory:manage");
    const input = parseForm(
      z.object({
        projectId: z.string().min(1),
        itemId: z.string().min(1),
        status: z.enum(TASK_STATUS),
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    // Scoped to this project *and* category, so `regulatory:manage` alone
    // can never be used to move a clinical or import task by guessing an id.
    const existing = await db.task.findFirst({
      where: { id: input.itemId, projectId: input.projectId, category: "REGULATORY" },
      select: { status: true, completedAt: true },
    });
    if (!existing) throw new Error("Item não encontrado.");

    await db.task.update({
      where: { id: input.itemId },
      data: {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
      },
    });

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "task.status_change",
      entity: "Task",
      entityId: input.itemId,
      metadata: { from: existing.status, to: input.status },
    });

    /**
     * The status change had no line in the project's history until now —
     * only its *creation* did. An item moving to done or back to waiting is
     * exactly the kind of change a project's story should not be silent
     * about, and it is also what may just have cleared (or created) an
     * overdue exception, which the recalculation below picks up.
     */
    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: input.status === "COMPLETED" ? "TASK_COMPLETED" : "TASK_UPDATED",
      description: `Item regulatório atualizado: ${input.status.replace(/_/g, " ").toLowerCase()}.`,
      internal: true,
    });

    await recalculateProject(input.projectId, user.id);

    revalidatePath(`/projects/${input.projectId}/regulatory`);
    revalidatePath("/regulatory");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

const shipmentSchema = z.object({
  projectId: z.string().min(1),
  shipmentId: optionalText,
  reference: optionalText,
  stage: z.enum([
    "PRODUCTION", "READY_FOR_SHIPMENT", "SHIPPED",
    "IN_TRANSIT", "ARRIVED", "CUSTOMS", "DELIVERED",
  ]),
  shippingMethod: optionalText,
  carrier: optionalText,
  trackingNumber: optionalText,
  portOfOrigin: optionalText,
  portOfArrival: optionalText,
  etd: optionalDate,
  eta: optionalDate,
  productionNote: optionalText,
  documentsNote: optionalText,
});

export async function saveShipmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("import:manage");
    const { projectId, shipmentId, ...input } = parseForm(shipmentSchema, formData);
    await requireProjectAccess(user, projectId);

    if (shipmentId) {
      const updated = await db.importShipment.updateMany({
        where: { id: shipmentId, projectId },
        data: input,
      });
      if (updated.count === 0) throw new Error("Embarque não encontrado.");
    } else {
      await db.importShipment.create({ data: { projectId, ...input } });
    }

    await recordTimelineEvent({
      projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
      description: `Embarque atualizado: ${input.stage.replace(/_/g, " ").toLowerCase()}.`,
      internal: true,
    });

    // A shipment sitting past its ETA is exactly the kind of exception the
    // dashboard exists to surface — this is what lets it.
    await recalculateProject(projectId, user.id);

    revalidatePath(`/projects/${projectId}/import`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

const GTM_CATEGORIES = [
  "MARKET_ANALYSIS", "COMMERCIAL_STRATEGY", "PRICING", "SALES_CHANNELS",
  "KOLS", "MARKETING", "TRAINING", "LAUNCH_PLAN",
] as const;

export async function createGtmItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("gtm:manage");
    const input = parseForm(
      z.object({
        projectId: z.string().min(1),
        category: z.enum(GTM_CATEGORIES),
        title: z.string().trim().min(2, "Informe o item.").max(160),
        detail: optionalText,
        owner: optionalText,
        dueDate: optionalDate,
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    const owner = await resolveOwnerByName(user.organizationId, input.owner);

    const task = await db.task.create({
      data: {
        organizationId: user.organizationId,
        projectId: input.projectId,
        createdById: user.id,
        assignedToId: owner.assignedToId,
        title: input.title,
        description: withOwnerNote(input.detail, owner.unmatchedName),
        category: "GO_TO_MARKET",
        priority: "MEDIUM",
        gtmCategory: input.category,
        dueDate: input.dueDate,
      },
    });

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "TASK_CREATED",
      description: `Item de Go-to-Market "${task.title}" adicionado.`,
      internal: true,
    });

    await notifyAboutDeadline({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      assignedToId: task.assignedToId,
      supplierId: task.supplierId,
    });

    await recalculateProject(input.projectId, user.id);

    revalidatePath(`/projects/${input.projectId}/go-to-market`);
    return { ok: true, createdId: task.id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateGtmItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("gtm:manage");
    const input = parseForm(
      z.object({
        projectId: z.string().min(1),
        itemId: z.string().min(1),
        status: z.enum(TASK_STATUS),
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    // Scoped to this project *and* category, so `gtm:manage` alone can never
    // be used to move a clinical or import task by guessing an id.
    const existing = await db.task.findFirst({
      where: { id: input.itemId, projectId: input.projectId, category: "GO_TO_MARKET" },
      select: { status: true, completedAt: true },
    });
    if (!existing) throw new Error("Item não encontrado.");

    await db.task.update({
      where: { id: input.itemId },
      data: {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
      },
    });

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "task.status_change",
      entity: "Task",
      entityId: input.itemId,
      metadata: { from: existing.status, to: input.status },
    });

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: input.status === "COMPLETED" ? "TASK_COMPLETED" : "TASK_UPDATED",
      description: `Item de Go-to-Market atualizado: ${input.status.replace(/_/g, " ").toLowerCase()}.`,
      internal: true,
    });

    await recalculateProject(input.projectId, user.id);

    revalidatePath(`/projects/${input.projectId}/go-to-market`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createMilestoneAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const input = parseForm(
      z.object({
        projectId: z.string().min(1),
        title: z.string().trim().min(2, "Informe o marco.").max(160),
        stage: z.enum(["CLINICAL", "REGULATORY", "IMPORT_LOGISTICS", "GO_TO_MARKET"]).optional(),
        dueDate: optionalDate,
      }),
      formData,
    );

    // A milestone belonging to a stage is governed by that stage's owner; one
    // that spans the project falls back to the general project capability.
    const needed = input.stage ? STAGE_PERMISSION[input.stage] : "project:update";
    if (!can(user, needed)) throw new ForbiddenError();

    await requireProjectAccess(user, input.projectId);

    const count = await db.milestone.count({ where: { projectId: input.projectId } });
    const milestone = await db.milestone.create({ data: { ...input, position: count } });

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "MILESTONE_REACHED",
      description: `Marco "${milestone.title}" adicionado.`,
    });

    await recalculateProject(input.projectId, user.id);
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true, createdId: milestone.id };
  } catch (error) {
    return toActionError(error);
  }
}
