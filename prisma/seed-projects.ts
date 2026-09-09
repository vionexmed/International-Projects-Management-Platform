import type { DocumentType, StageKey } from "../src/generated/prisma";
import { date } from "./seed-helpers";

/** Per-stage completion used to derive each seeded project's progress. */
export type StageProgress = Record<StageKey, number>;

export type ProjectBlueprint = {
  name: string;
  projectCode: string;
  supplierKey: "A" | "B" | "C" | "D";
  ownerKey: "lucas" | "stefany" | "joao" | "maria";
  country: string;
  category: string;
  productType: string;
  status: "ON_TRACK" | "AT_RISK" | "BLOCKED" | "COMPLETED";
  currentStage: StageKey;
  description: string;
  startDate: Date;
  targetLaunchDate: Date;
  blockerNote?: string;
  progress: StageProgress;
};

/**
 * The demonstration portfolio. Kept apart from the seed script so the data is
 * easy to review and adjust without touching the insertion logic.
 */
export const PROJECT_BLUEPRINTS: ProjectBlueprint[] = [

  {
    name: "Product Alpha", projectCode: "VX-001", supplierKey: "A", ownerKey: "stefany",
    country: "China", category: "Medical Device", productType: "Class II Device",
    status: "AT_RISK", currentStage: "REGULATORY",
    description: "Registro e importação do Product Alpha junto à ANVISA, em parceria com o Manufacturer A.",
    startDate: date(2026, 2, 10), targetLaunchDate: date(2026, 11, 14),
    progress: { CLINICAL: 100, REGULATORY: 72, IMPORT_LOGISTICS: 20, GO_TO_MARKET: 10 },
  },
  {
    name: "Product Beta", projectCode: "VX-002", supplierKey: "B", ownerKey: "lucas",
    country: "Germany", category: "Medical Device", productType: "Class III Device",
    status: "BLOCKED", currentStage: "CLINICAL",
    description: "Estudo clínico e submissão regulatória do Product Beta.",
    startDate: date(2026, 4, 5), targetLaunchDate: date(2027, 1, 20),
    blockerNote: "Protocolo clínico aguardando aprovação do comitê de ética.",
    progress: { CLINICAL: 41, REGULATORY: 8, IMPORT_LOGISTICS: 0, GO_TO_MARKET: 0 },
  },
  {
    name: "Product Gamma", projectCode: "VX-003", supplierKey: "C", ownerKey: "joao",
    country: "United States", category: "Diagnostics", productType: "IVD Reagent",
    status: "ON_TRACK", currentStage: "IMPORT_LOGISTICS",
    description: "Importação e distribuição do Product Gamma no mercado brasileiro.",
    startDate: date(2026, 1, 15), targetLaunchDate: date(2026, 12, 10),
    progress: { CLINICAL: 100, REGULATORY: 100, IMPORT_LOGISTICS: 55, GO_TO_MARKET: 25 },
  },
  {
    name: "Product Delta", projectCode: "VX-004", supplierKey: "A", ownerKey: "stefany",
    country: "China", category: "Medical Device", productType: "Class I Device",
    status: "ON_TRACK", currentStage: "REGULATORY",
    description: "Notificação regulatória do Product Delta.",
    startDate: date(2026, 5, 20), targetLaunchDate: date(2027, 3, 30),
    progress: { CLINICAL: 100, REGULATORY: 45, IMPORT_LOGISTICS: 5, GO_TO_MARKET: 0 },
  },
  {
    name: "Product Epsilon", projectCode: "VX-005", supplierKey: "D", ownerKey: "maria",
    country: "Italy", category: "Aesthetics", productType: "Dermal Filler",
    status: "ON_TRACK", currentStage: "GO_TO_MARKET",
    description: "Lançamento comercial do Product Epsilon.",
    startDate: date(2025, 11, 3), targetLaunchDate: date(2026, 10, 1),
    progress: { CLINICAL: 100, REGULATORY: 100, IMPORT_LOGISTICS: 100, GO_TO_MARKET: 62 },
  },
  {
    name: "Product Zeta", projectCode: "VX-006", supplierKey: "A", ownerKey: "stefany",
    country: "China", category: "Medical Device", productType: "Class II Device",
    status: "AT_RISK", currentStage: "CLINICAL",
    description: "Avaliação clínica do Product Zeta.",
    startDate: date(2026, 6, 12), targetLaunchDate: date(2027, 6, 15),
    progress: { CLINICAL: 28, REGULATORY: 0, IMPORT_LOGISTICS: 0, GO_TO_MARKET: 0 },
  },
];


export type DocumentBlueprint = {
  projectKey: string;
  name: string;
  type: DocumentType;
  status: "APPROVED" | "IN_REVIEW" | "RECEIVED";
  shared: boolean;
  authorKey: "lucas" | "stefany" | "joao" | "maria" | "johnSmith";
  supplierKey: "A" | "B" | "C" | "D" | null;
  versions: string[];
};

/** Demonstration documents, including one with two versions (IFU v1 / v2). */
export const DOCUMENT_BLUEPRINTS: DocumentBlueprint[] = [

  { projectKey: "VX-001", name: "IFU", type: "IFU", status: "IN_REVIEW", shared: true, authorKey: "johnSmith", supplierKey: "A", versions: ["IFU_v1.pdf", "IFU_v2.pdf"] },
  { projectKey: "VX-001", name: "ISO 13485 Certificate", type: "CERTIFICATE", status: "APPROVED", shared: true, authorKey: "johnSmith", supplierKey: "A", versions: ["ISO13485.pdf"] },
  { projectKey: "VX-001", name: "Clinical Evaluation Report", type: "CLINICAL", status: "APPROVED", shared: false, authorKey: "stefany", supplierKey: null, versions: ["CER_v1.pdf"] },
  { projectKey: "VX-001", name: "Risk Management File", type: "REGULATORY", status: "IN_REVIEW", shared: false, authorKey: "stefany", supplierKey: null, versions: ["RMF_v1.pdf"] },
  { projectKey: "VX-001", name: "Supply Agreement", type: "CONTRACT", status: "APPROVED", shared: false, authorKey: "lucas", supplierKey: "A", versions: ["Supply_Agreement.pdf"] },
  { projectKey: "VX-002", name: "Clinical Protocol Draft", type: "CLINICAL", status: "IN_REVIEW", shared: true, authorKey: "lucas", supplierKey: "B", versions: ["Protocol_v1.pdf"] },
  { projectKey: "VX-002", name: "Non-Disclosure Agreement", type: "NDA", status: "APPROVED", shared: true, authorKey: "lucas", supplierKey: "B", versions: ["NDA_ManufacturerB.pdf"] },
  { projectKey: "VX-003", name: "Commercial Invoice", type: "IMPORT", status: "RECEIVED", shared: true, authorKey: "joao", supplierKey: "C", versions: ["Invoice_SHP01.pdf"] },
  { projectKey: "VX-003", name: "Packing List", type: "IMPORT", status: "APPROVED", shared: true, authorKey: "joao", supplierKey: "C", versions: ["PackingList_SHP01.pdf"] },
  { projectKey: "VX-005", name: "Launch Presentation", type: "PRESENTATION", status: "RECEIVED", shared: false, authorKey: "maria", supplierKey: null, versions: ["Launch_Deck.pdf"] },
];
