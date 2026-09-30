import type { HealthStatus, ShipmentStage, StageKey, TaskCategory } from "@/generated/prisma";

/** The four values `Project.status` actually holds — never `INACTIVE`, which only `Supplier.status` uses. */
type ProjectHealth = Extract<HealthStatus, "ON_TRACK" | "AT_RISK" | "BLOCKED" | "COMPLETED">;
import { toPercent } from "@/lib/utils";

/**
 * Progress and status rules (§44). Kept deliberately simple and pure so they
 * are unit-testable and produce the same answer wherever they run.
 */

export const STAGE_TASK_CATEGORY: Record<StageKey, TaskCategory> = {
  CLINICAL: "CLINICAL",
  REGULATORY: "REGULATORY",
  IMPORT_LOGISTICS: "IMPORT",
  GO_TO_MARKET: "GO_TO_MARKET",
};

export const STAGE_ORDER: StageKey[] = [
  "CLINICAL",
  "REGULATORY",
  "IMPORT_LOGISTICS",
  "GO_TO_MARKET",
];

export type TaskSnapshot = {
  category: TaskCategory;
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: Date | null;
};

export type StageSnapshot = {
  key: StageKey;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
  /** Manual override; when set it always wins over the derived value. */
  progress: number | null;
};

/**
 * A stage's progress is the share of its tasks that are done. A manual
 * override always wins; with no tasks at all only a completed stage counts
 * (100%). A stage "em andamento" with nothing in it yet is 0% — its status
 * already says it started, and a made-up 10% showed progress nobody had made.
 */
export function stageProgress(stage: StageSnapshot, tasks: TaskSnapshot[]): number {
  if (stage.progress !== null) return toPercent(stage.progress);

  const category = STAGE_TASK_CATEGORY[stage.key];
  const relevant = tasks.filter((task) => task.category === category && task.status !== "CANCELLED");

  if (relevant.length === 0) {
    if (stage.status === "COMPLETED") return 100;
    return 0;
  }

  const done = relevant.filter((task) => task.status === "COMPLETED").length;
  return toPercent((done / relevant.length) * 100);
}

/**
 * A task write can invalidate a stage's terminal status or 100% override.
 * Leave empty stages and intermediate manual progress alone; the stage editor
 * still owns those choices. Count cancelled work the same way as progress.
 */
export function reconcileStageWithTasks(
  stage: StageSnapshot,
  tasks: TaskSnapshot[],
): Pick<StageSnapshot, "status" | "progress"> {
  const relevant = tasks.filter(
    (task) => task.category === STAGE_TASK_CATEGORY[stage.key] && task.status !== "CANCELLED",
  );
  if (relevant.length === 0) {
    return { status: stage.status, progress: stage.progress };
  }

  if (stage.status === "BLOCKED") {
    return {
      status: "BLOCKED",
      progress: relevant.some((task) => task.status !== "COMPLETED") && stage.progress === 100
        ? null
        : stage.progress,
    };
  }

  if (relevant.every((task) => task.status === "COMPLETED")) {
    return { status: "COMPLETED", progress: stage.progress === 100 ? 100 : null };
  }

  return {
    status: stage.status === "COMPLETED" ? "IN_PROGRESS" : stage.status,
    progress: stage.progress === 100 ? null : stage.progress,
  };
}

/**
 * A shipment that should have arrived and has not.
 *
 * Unlike a task this is not countable work — it is one record moving through
 * a fixed route — so it never dilutes progress. It only answers the question
 * a person actually has: is anything stuck in transit?
 */
export const SHIPMENT_ARRIVED: readonly ShipmentStage[] = ["ARRIVED", "CUSTOMS", "DELIVERED"];

export function isShipmentLate(
  shipment: { stage: ShipmentStage; eta: Date | null; arrivedAt: Date | null },
  now: Date,
): boolean {
  if (shipment.arrivedAt) return false;
  if (SHIPMENT_ARRIVED.includes(shipment.stage)) return false;
  return shipment.eta !== null && shipment.eta.getTime() < now.getTime();
}

/** Overall progress is the unweighted mean of the four stages. */
export function projectProgress(stages: StageSnapshot[], tasks: TaskSnapshot[]): number {
  if (stages.length === 0) return 0;
  const total = stages.reduce((sum, stage) => sum + stageProgress(stage, tasks), 0);
  return toPercent(total / stages.length);
}

export function isOverdue(task: TaskSnapshot, now: Date): boolean {
  if (task.status === "COMPLETED" || task.status === "CANCELLED") return false;
  return task.dueDate !== null && task.dueDate.getTime() < now.getTime();
}

/**
 * Status precedence: an explicit blocker beats everything, then a critical
 * overdue task, then completion of every stage. A project a person marked
 * COMPLETED is never silently reopened by this rule.
 */
export function deriveProjectStatus(input: {
  currentStatus: ProjectHealth;
  hasExplicitBlocker: boolean;
  stages: StageSnapshot[];
  tasks: TaskSnapshot[];
  now?: Date;
}): ProjectHealth {
  const now = input.now ?? new Date();

  if (input.currentStatus === "COMPLETED") return "COMPLETED";
  if (input.hasExplicitBlocker) return "BLOCKED";

  const hasBlockedStage = input.stages.some((stage) => stage.status === "BLOCKED");
  if (hasBlockedStage) return "BLOCKED";

  const hasCriticalOverdue = input.tasks.some(
    (task) => isOverdue(task, now) && (task.priority === "HIGH" || task.priority === "URGENT"),
  );
  if (hasCriticalOverdue) return "AT_RISK";

  const overdueCount = input.tasks.filter((task) => isOverdue(task, now)).length;
  if (overdueCount >= 3) return "AT_RISK";

  const allStagesComplete =
    input.stages.length > 0 && input.stages.every((stage) => stage.status === "COMPLETED");
  if (allStagesComplete) return "COMPLETED";

  return "ON_TRACK";
}

/** The first stage that is not finished — what the project is working on now. */
export function deriveCurrentStage(stages: StageSnapshot[]): StageKey {
  const ordered = STAGE_ORDER.filter((key) => stages.some((stage) => stage.key === key));
  for (const key of ordered) {
    const stage = stages.find((candidate) => candidate.key === key);
    if (stage && stage.status !== "COMPLETED") return key;
  }
  return ordered.at(-1) ?? "CLINICAL";
}
