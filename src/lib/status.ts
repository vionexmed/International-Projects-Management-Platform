import type {
  DocumentCycleStatus,
  HealthStatus,
  ProgressStatus,
  ShipmentStage,
  TaskPriority,
} from "@/generated/prisma";

/** Visual tone shared by every status indicator. Language-independent. */
export type Tone = "ok" | "warn" | "risk" | "info" | "neutral";

/**
 * A task is never stored as "overdue" — it is derived (§44), so that a due
 * date passing does not require a background job to stay truthful.
 */
export type DerivedTaskStatus = ProgressStatus | "OVERDUE";

/**
 * Generic in the caller's own status type, so a model that only ever holds a
 * subset of `ProgressStatus` (a `Task`, never `PLANNED`) gets that same subset
 * back out — `meta.task` and friends can stay typed to what they actually
 * receive instead of the full shared enum.
 */
export function deriveTaskStatus<S extends ProgressStatus>(
  status: S,
  dueDate: Date | null,
  now: Date = new Date(),
): S | "OVERDUE" {
  if (status === "COMPLETED" || status === "CANCELLED") return status;
  if (dueDate && dueDate.getTime() < now.getTime()) return "OVERDUE";
  return status;
}

export function isTaskOverdue(status: ProgressStatus, dueDate: Date | null, now: Date = new Date()) {
  return deriveTaskStatus(status, dueDate, now) === "OVERDUE";
}

/**
 * Health of a project or a supplier relationship — one shared tone table
 * where there used to be two (`PROJECT_STATUS_TONE`, `SUPPLIER_STATUS_TONE`),
 * kept apart only because they were two different Prisma types even though
 * every colour agreed already. `INACTIVE` and `COMPLETED` never both apply to
 * the same model, but the table covers both since `HealthStatus` is shared.
 */
export const HEALTH_STATUS_TONE: Record<HealthStatus, Tone> = {
  ON_TRACK: "ok",
  AT_RISK: "warn",
  BLOCKED: "risk",
  COMPLETED: "info",
  INACTIVE: "neutral",
};

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warn",
  URGENT: "risk",
};

/**
 * Where a document, a regulatory item or a document request stands — one
 * shared tone table replacing three (`DOCUMENT_STATUS_TONE`,
 * `REQUEST_STATUS_TONE`, `REGULATORY_STATUS_TONE`), which had disagreed on
 * one colour: `RequestStatus.PENDING` used to read `warn` (a request pending
 * is something waiting on the supplier) while `DocumentStatus.PENDING` read
 * `neutral` (a value that, in practice, no code ever wrote — see
 * `src/server/services/documents.ts`). `warn` wins here, matching the value
 * that is actually live.
 */
export const DOCUMENT_CYCLE_STATUS_TONE: Record<DocumentCycleStatus, Tone> = {
  PENDING: "warn",
  REQUESTED: "warn",
  RECEIVED: "info",
  SUBMITTED: "info",
  IN_REVIEW: "info",
  APPROVED: "ok",
  REJECTED: "risk",
  CANCELLED: "neutral",
};

/**
 * How a piece of work is coming along — one shared tone table replacing five
 * (`StageStatus`, `GtmItemStatus`, `MilestoneStatus`, `ClinicalStudyStatus`,
 * `TaskStatus`'s own tone tables), which agreed on every colour they had in
 * common.
 */
export const PROGRESS_STATUS_TONE: Record<DerivedTaskStatus, Tone> = {
  NOT_STARTED: "neutral",
  PLANNED: "neutral",
  OPEN: "neutral",
  IN_PROGRESS: "info",
  WAITING: "warn",
  BLOCKED: "risk",
  DELAYED: "warn",
  SUSPENDED: "warn",
  COMPLETED: "ok",
  CANCELLED: "neutral",
  OVERDUE: "risk",
};

export const SHIPMENT_STAGE_ORDER: ShipmentStage[] = [
  "PRODUCTION",
  "READY_FOR_SHIPMENT",
  "SHIPPED",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS",
  "DELIVERED",
];
