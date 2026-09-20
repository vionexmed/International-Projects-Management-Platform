import type {
  DocumentCycleStatus,
  DocumentType,
  GtmCategory,
  HealthStatus,
  ProgressStatus,
  ShipmentStage,
  StageKey,
  TaskCategory,
  TaskPriority,
  UserRole,
} from "@/generated/prisma";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  DOCUMENT_CYCLE_STATUS_TONE,
  HEALTH_STATUS_TONE,
  PRIORITY_TONE,
  PROGRESS_STATUS_TONE,
  type Tone,
} from "@/lib/status";

export type StatusMeta = { label: string; tone: Tone };

/**
 * Narrowed subsets of the three shared status enums, one per model.
 *
 * `HealthStatus`, `DocumentCycleStatus` and `ProgressStatus` are each a union
 * of every value the models that share them ever used (Fase 2 of the
 * architecture-simplification plan — see schema.prisma's doc comments on each
 * enum). No single model uses the full union: `Project.status` is never
 * `INACTIVE`, `Task.status` is never `PLANNED`. These aliases say exactly
 * which values each model's own column can hold, so the dictionary for that
 * model only has to translate the values it actually needs — the same
 * discipline the per-model translation tables already followed before the
 * merge, now enforced by the type instead of by convention.
 */
type ProjectHealth = Extract<HealthStatus, "ON_TRACK" | "AT_RISK" | "BLOCKED" | "COMPLETED">;
type SupplierHealth = Extract<HealthStatus, "ON_TRACK" | "AT_RISK" | "BLOCKED" | "INACTIVE">;
type DocumentCycle = Extract<
  DocumentCycleStatus,
  "PENDING" | "REQUESTED" | "RECEIVED" | "IN_REVIEW" | "APPROVED" | "REJECTED"
>;
type RequestCycle = Extract<
  DocumentCycleStatus,
  "PENDING" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED"
>;
type TaskStatus = Extract<ProgressStatus, "OPEN" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CANCELLED">;
export type StageProgress = Extract<
  ProgressStatus,
  "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"
>;
export type MilestoneProgress = Extract<
  ProgressStatus,
  "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED"
>;
export type ClinicalProgress = Extract<
  ProgressStatus,
  "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SUSPENDED"
>;
export type GtmProgress = Extract<ProgressStatus, "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED">;

/**
 * Pairs a stored enum value with its localised label and visual tone, so a
 * component never has to know both the dictionary path and the colour table.
 */
export const meta = {
  project: (s: ProjectHealth, d: Dictionary): StatusMeta => ({
    label: d.status.project[s],
    tone: HEALTH_STATUS_TONE[s],
  }),
  supplier: (s: SupplierHealth, d: Dictionary): StatusMeta => ({
    label: d.status.supplier[s],
    tone: HEALTH_STATUS_TONE[s],
  }),
  task: (s: TaskStatus | "OVERDUE", d: Dictionary): StatusMeta => ({
    label: d.status.task[s],
    tone: PROGRESS_STATUS_TONE[s],
  }),
  priority: (s: TaskPriority, d: Dictionary): StatusMeta => ({
    label: d.status.priority[s],
    tone: PRIORITY_TONE[s],
  }),
  document: (s: DocumentCycle, d: Dictionary): StatusMeta => ({
    label: d.status.document[s],
    tone: DOCUMENT_CYCLE_STATUS_TONE[s],
  }),
  request: (s: RequestCycle, d: Dictionary): StatusMeta => ({
    label: d.status.request[s],
    tone: DOCUMENT_CYCLE_STATUS_TONE[s],
  }),
  regulatory: (s: DocumentCycle, d: Dictionary): StatusMeta => ({
    label: d.status.document[s],
    tone: DOCUMENT_CYCLE_STATUS_TONE[s],
  }),
  stage: (s: StageProgress, d: Dictionary): StatusMeta => ({
    label: d.status.stage[s],
    tone: PROGRESS_STATUS_TONE[s],
  }),
  milestone: (s: MilestoneProgress, d: Dictionary): StatusMeta => ({
    label: d.status.milestone[s],
    tone: PROGRESS_STATUS_TONE[s],
  }),
  clinical: (s: ClinicalProgress, d: Dictionary): StatusMeta => ({
    label: d.status.clinical[s],
    tone: PROGRESS_STATUS_TONE[s],
  }),
  gtm: (s: GtmProgress, d: Dictionary): StatusMeta => ({
    label: d.status.gtm[s],
    tone: PROGRESS_STATUS_TONE[s],
  }),
};

export const label = {
  stageKey: (v: StageKey, d: Dictionary) => d.enums.stageKey[v],
  taskCategory: (v: TaskCategory, d: Dictionary) => d.enums.taskCategory[v],
  documentType: (v: DocumentType, d: Dictionary) => d.enums.documentType[v],
  gtmCategory: (v: GtmCategory, d: Dictionary) => d.enums.gtmCategory[v],
  role: (v: UserRole, d: Dictionary) => d.enums.role[v],
  shipmentStage: (v: ShipmentStage, d: Dictionary) => d.status.shipment[v],
};

/** Enum values in the order they should appear in filters and forms. */
export const OPTIONS = {
  projectStatus: ["ON_TRACK", "AT_RISK", "BLOCKED", "COMPLETED"] as ProjectHealth[],
  taskStatus: ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED"] as const,
  priority: ["LOW", "MEDIUM", "HIGH", "URGENT"] as TaskPriority[],
  taskCategory: ["CLINICAL", "REGULATORY", "IMPORT", "GO_TO_MARKET", "GENERAL"] as TaskCategory[],
  documentType: [
    "CONTRACT",
    "NDA",
    "CERTIFICATE",
    "IFU",
    "CLINICAL",
    "REGULATORY",
    "PRESENTATION",
    "IMPORT",
    "COMMERCIAL",
    "OTHER",
  ] as DocumentType[],
  documentStatus: [
    "PENDING",
    "REQUESTED",
    "RECEIVED",
    "IN_REVIEW",
    "APPROVED",
    "REJECTED",
  ] as DocumentCycle[],
  stageKey: ["CLINICAL", "REGULATORY", "IMPORT_LOGISTICS", "GO_TO_MARKET"] as StageKey[],
  gtmCategory: [
    "MARKET_ANALYSIS",
    "COMMERCIAL_STRATEGY",
    "PRICING",
    "SALES_CHANNELS",
    "KOLS",
    "MARKETING",
    "TRAINING",
    "LAUNCH_PLAN",
  ] as GtmCategory[],
  internalRoles: [
    "ADMIN",
    "MANAGER",
    "REGULATORY",
    "IMPORT",
    "MARKETING",
    "VIEWER",
  ] as UserRole[],
  supplierRoles: ["SUPPLIER_ADMIN", "SUPPLIER_USER"] as UserRole[],
};
