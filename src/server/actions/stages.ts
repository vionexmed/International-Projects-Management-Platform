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
import {
  optionalDate,
  optionalText,
  parseForm,
  toActionError,
  type ActionState,
} from "@/server/actions/utils";

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

const REGULATORY_STATUS = [
  "PENDING", "REQUESTED", "RECEIVED", "IN_REVIEW", "APPROVED", "REJECTED",
] as const;

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
        status: z.enum(REGULATORY_STATUS).default("PENDING"),
        dueDate: optionalDate,
        notes: optionalText,
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    const item = await db.regulatoryItem.create({ data: input });

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
      description: `Item regulatório "${item.title}" adicionado.`,
      // Vionex's submission tracking with the health authority.
      internal: true,
    });

    // A new item can already be overdue (a back-dated deadline) or push the
    // project past its "on track" threshold — the same rule task creation
    // triggers, applied here for the first time.
    await recalculateProject(input.projectId, user.id);

    revalidatePath(`/projects/${input.projectId}/regulatory`);
    return { ok: true, createdId: item.id };
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
        status: z.enum(REGULATORY_STATUS),
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    const updated = await db.regulatoryItem.updateMany({
      where: { id: input.itemId, projectId: input.projectId },
      data: { status: input.status },
    });
    if (updated.count === 0) throw new Error("Item não encontrado.");

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "document.review",
      entity: "RegulatoryItem",
      entityId: input.itemId,
      metadata: { status: input.status },
    });

    /**
     * The status change had no line in the project's history until now —
     * only its *creation* did. An item moving to APPROVED or REJECTED is
     * exactly the kind of change a project's story should not be silent
     * about, and it is also what may just have cleared (or created) an
     * overdue exception, which the recalculation below picks up.
     */
    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
      description: `Item regulatório atualizado: ${input.status.replace(/_/g, " ").toLowerCase()}.`,
      internal: true,
    });

    await recalculateProject(input.projectId, user.id);

    revalidatePath(`/projects/${input.projectId}/regulatory`);
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
const GTM_STATUS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"] as const;

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
        status: z.enum(GTM_STATUS).default("NOT_STARTED"),
        dueDate: optionalDate,
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    const item = await db.gtmItem.create({ data: input });

    /**
     * Regulatory items and shipments already wrote to the project's history
     * on every change; GTM items wrote to none of it. A go-to-market item is
     * exactly as much "what happened on this project" as the other two, and
     * silence here was an omission, not a decision.
     */
    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
      description: `Item de Go-to-Market "${item.title}" adicionado.`,
      internal: true,
    });

    await recalculateProject(input.projectId, user.id);

    revalidatePath(`/projects/${input.projectId}/go-to-market`);
    return { ok: true, createdId: item.id };
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
        status: z.enum(GTM_STATUS),
      }),
      formData,
    );
    await requireProjectAccess(user, input.projectId);

    const updated = await db.gtmItem.updateMany({
      where: { id: input.itemId, projectId: input.projectId },
      data: { status: input.status },
    });
    if (updated.count === 0) throw new Error("Item não encontrado.");

    await recordTimelineEvent({
      projectId: input.projectId,
      actorId: user.id,
      type: "STAGE_UPDATED",
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
