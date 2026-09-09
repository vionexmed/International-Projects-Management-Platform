import type {
  ClinicalStudyStatus,
  DocumentStatus,
  GtmItemStatus,
  MilestoneStatus,
  ProjectStatus,
  RegulatoryItemStatus,
  RequestStatus,
  ShipmentStage,
  StageStatus,
  SupplierStatus,
  TaskPriority,
  TaskStatus,
} from "@/generated/prisma";

/** Visual tone shared by every status indicator. Language-independent. */
export type Tone = "ok" | "warn" | "risk" | "info" | "neutral";

/**
 * A task is never stored as "overdue" — it is derived (§44), so that a due
 * date passing does not require a background job to stay truthful.
 */
export type DerivedTaskStatus = TaskStatus | "OVERDUE";

export function deriveTaskStatus(
  status: TaskStatus,
  dueDate: Date | null,
  now: Date = new Date(),
): DerivedTaskStatus {
  if (status === "COMPLETED" || status === "CANCELLED") return status;
  if (dueDate && dueDate.getTime() < now.getTime()) return "OVERDUE";
  return status;
}

export function isTaskOverdue(status: TaskStatus, dueDate: Date | null, now: Date = new Date()) {
  return deriveTaskStatus(status, dueDate, now) === "OVERDUE";
}

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  ON_TRACK: "ok",
  AT_RISK: "warn",
  BLOCKED: "risk",
  COMPLETED: "info",
};

export const SUPPLIER_STATUS_TONE: Record<SupplierStatus, Tone> = {
  ON_TRACK: "ok",
  AT_RISK: "warn",
  BLOCKED: "risk",
  INACTIVE: "neutral",
};

export const TASK_STATUS_TONE: Record<DerivedTaskStatus, Tone> = {
  OPEN: "neutral",
  IN_PROGRESS: "info",
  WAITING: "warn",
  COMPLETED: "ok",
  CANCELLED: "neutral",
  OVERDUE: "risk",
};

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warn",
  URGENT: "risk",
};

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, Tone> = {
  PENDING: "neutral",
  REQUESTED: "warn",
  RECEIVED: "info",
  IN_REVIEW: "info",
  APPROVED: "ok",
  REJECTED: "risk",
};

export const REQUEST_STATUS_TONE: Record<RequestStatus, Tone> = {
  PENDING: "warn",
  SUBMITTED: "info",
  IN_REVIEW: "info",
  APPROVED: "ok",
  REJECTED: "risk",
  CANCELLED: "neutral",
};

export const REGULATORY_STATUS_TONE: Record<RegulatoryItemStatus, Tone> = {
  PENDING: "neutral",
  REQUESTED: "warn",
  RECEIVED: "info",
  IN_REVIEW: "info",
  APPROVED: "ok",
  REJECTED: "risk",
};

export const STAGE_STATUS_TONE: Record<StageStatus, Tone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
  BLOCKED: "risk",
};

export const MILESTONE_STATUS_TONE: Record<MilestoneStatus, Tone> = {
  PLANNED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
  DELAYED: "warn",
};

export const CLINICAL_STATUS_TONE: Record<ClinicalStudyStatus, Tone> = {
  PLANNED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
  SUSPENDED: "warn",
};

export const GTM_STATUS_TONE: Record<GtmItemStatus, Tone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
  BLOCKED: "risk",
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
