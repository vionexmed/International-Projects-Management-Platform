import type { StageKey } from "@/generated/prisma";

/**
 * The four stage pages keep their own URLs (notifications and bookmarks point
 * at them); what changed is how they are reached. One "Etapas" tab in the
 * project bar, then the `StageSwitcher` to move between the stages.
 */
export const STAGE_ROUTES: { key: StageKey; segment: string; label: string }[] = [
  { key: "CLINICAL", segment: "clinical", label: "Clínico" },
  { key: "REGULATORY", segment: "regulatory", label: "Regulatório" },
  { key: "IMPORT_LOGISTICS", segment: "import", label: "Importação" },
  { key: "GO_TO_MARKET", segment: "go-to-market", label: "Go-to-Market" },
];

export const STAGE_SEGMENTS = STAGE_ROUTES.map((stage) => stage.segment);

export function stageSegment(key: StageKey) {
  return STAGE_ROUTES.find((stage) => stage.key === key)?.segment ?? "clinical";
}
