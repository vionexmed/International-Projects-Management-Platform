import type { StageKey } from "@/generated/prisma";
import type { ProjectStageSummary } from "@/server/services/projects";
import { StageTrackSegments, type StageSegment } from "@/features/projects/stage-track-segments";
import { stageSegment } from "@/features/projects/stage-routes";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta, type StageProgress } from "@/lib/labels";

/** The fill of a stage segment: done is green, held up is red, work under way is the brand. */
const STAGE_FILL: Record<ProjectStageSummary["status"], string> = {
  NOT_STARTED: "bg-brand",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-ok-dot",
  BLOCKED: "bg-risk-dot",
};

/**
 * The row's "Etapas" cell: the four stages stretched across the column, each
 * filled as far as it has gone, and the project's overall progress beside
 * them. Hovering (or focusing) a segment names that stage and how it stands;
 * each segment opens its stage page.
 */
export function StageTrack({
  projectId,
  stages,
  current,
  progress,
  dict,
}: {
  projectId: string;
  stages: ProjectStageSummary[];
  current: StageKey;
  progress: number;
  dict: Dictionary;
}) {
  const segments: StageSegment[] = stages.map((stage) => ({
    key: stage.key,
    name: label.stageKey(stage.key, dict),
    status: meta.stage(stage.status as StageProgress, dict).label,
    progress: stage.progress,
    fill: stage.status === "COMPLETED" ? 100 : Math.max(0, Math.min(100, stage.progress)),
    tone: STAGE_FILL[stage.status],
    href: `/projects/${projectId}/${stageSegment(stage.key)}`,
    current: stage.key === current,
  }));

  return (
    <div className="flex min-w-0 items-center gap-3">
      <StageTrackSegments segments={segments} />
      {/* The stage names are in each segment's tooltip; the row keeps just the share done. */}
      <span className="w-9 shrink-0 text-right text-meta font-medium text-ink tabular-nums">{progress}%</span>
    </div>
  );
}
