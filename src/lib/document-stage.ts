import type { DocumentType, TaskCategory } from "@/generated/prisma";

/**
 * Which project stage a requested document belongs to, from the category
 * picked when it was requested. One rule for both places that need it: the
 * stage of the task mirroring the request (so a clinical request sits under
 * "Clínico" in the plan) and the stage page that lists the request.
 *
 * Contracts, NDAs and "other" stay with Regulatório, where every request used
 * to live, so nothing that was visible there disappears.
 */
export const DOCUMENT_STAGE_CATEGORY: Record<DocumentType, TaskCategory> = {
  CLINICAL: "CLINICAL",
  IMPORT: "IMPORT",
  COMMERCIAL: "GO_TO_MARKET",
  PRESENTATION: "GO_TO_MARKET",
  REGULATORY: "REGULATORY",
  CERTIFICATE: "REGULATORY",
  IFU: "REGULATORY",
  CONTRACT: "REGULATORY",
  NDA: "REGULATORY",
  OTHER: "REGULATORY",
};

/** The document categories whose requests a stage page lists. */
export function documentTypesForStage(category: TaskCategory): DocumentType[] {
  return (Object.keys(DOCUMENT_STAGE_CATEGORY) as DocumentType[]).filter(
    (type) => DOCUMENT_STAGE_CATEGORY[type] === category,
  );
}
