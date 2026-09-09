import type {
  ClinicalStudyStatus,
  DocumentStatus,
  DocumentType,
  GtmCategory,
  GtmItemStatus,
  MilestoneStatus,
  ProjectStatus,
  RegulatoryItemStatus,
  RequestStatus,
  ShipmentStage,
  StageKey,
  StageStatus,
  SupplierStatus,
  TaskCategory,
  TaskPriority,
  UserRole,
} from "@/generated/prisma";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  CLINICAL_STATUS_TONE,
  DOCUMENT_STATUS_TONE,
  GTM_STATUS_TONE,
  MILESTONE_STATUS_TONE,
  PRIORITY_TONE,
  PROJECT_STATUS_TONE,
  REGULATORY_STATUS_TONE,
  REQUEST_STATUS_TONE,
  STAGE_STATUS_TONE,
  SUPPLIER_STATUS_TONE,
  TASK_STATUS_TONE,
  type DerivedTaskStatus,
  type Tone,
} from "@/lib/status";

export type StatusMeta = { label: string; tone: Tone };

/**
 * Pairs a stored enum value with its localised label and visual tone, so a
 * component never has to know both the dictionary path and the colour table.
 */
export const meta = {
  project: (s: ProjectStatus, d: Dictionary): StatusMeta => ({
    label: d.status.project[s],
    tone: PROJECT_STATUS_TONE[s],
  }),
  supplier: (s: SupplierStatus, d: Dictionary): StatusMeta => ({
    label: d.status.supplier[s],
    tone: SUPPLIER_STATUS_TONE[s],
  }),
  task: (s: DerivedTaskStatus, d: Dictionary): StatusMeta => ({
    label: d.status.task[s],
    tone: TASK_STATUS_TONE[s],
  }),
  priority: (s: TaskPriority, d: Dictionary): StatusMeta => ({
    label: d.status.priority[s],
    tone: PRIORITY_TONE[s],
  }),
  document: (s: DocumentStatus, d: Dictionary): StatusMeta => ({
    label: d.status.document[s],
    tone: DOCUMENT_STATUS_TONE[s],
  }),
  request: (s: RequestStatus, d: Dictionary): StatusMeta => ({
    label: d.status.request[s],
    tone: REQUEST_STATUS_TONE[s],
  }),
  regulatory: (s: RegulatoryItemStatus, d: Dictionary): StatusMeta => ({
    label: d.status.document[s],
    tone: REGULATORY_STATUS_TONE[s],
  }),
  stage: (s: StageStatus, d: Dictionary): StatusMeta => ({
    label: d.status.stage[s],
    tone: STAGE_STATUS_TONE[s],
  }),
  milestone: (s: MilestoneStatus, d: Dictionary): StatusMeta => ({
    label: d.status.milestone[s],
    tone: MILESTONE_STATUS_TONE[s],
  }),
  clinical: (s: ClinicalStudyStatus, d: Dictionary): StatusMeta => ({
    label: d.status.clinical[s],
    tone: CLINICAL_STATUS_TONE[s],
  }),
  gtm: (s: GtmItemStatus, d: Dictionary): StatusMeta => ({
    label: d.status.gtm[s],
    tone: GTM_STATUS_TONE[s],
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
  projectStatus: ["ON_TRACK", "AT_RISK", "BLOCKED", "COMPLETED"] as ProjectStatus[],
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
  ] as DocumentStatus[],
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
