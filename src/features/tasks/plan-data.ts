import type { PlanColumnType, StageKey, TaskCategory, TaskPriority } from "@/generated/prisma";
import { STAGE_ROUTES } from "@/features/projects/stage-routes";
import { daysUntil, formatDateShort } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, type StageProgress } from "@/lib/labels";
import type { DerivedTaskStatus } from "@/lib/status";
import type { TaskRow } from "@/features/tasks/tasks-table";

/**
 * The project plan: tasks grouped under the stage their category belongs to.
 * Shared by the list and the board so both views always show the same groups
 * in the same order. Dates are formatted here, on the server, so the client
 * cells never format in the browser's time zone.
 */

export type PlanTask = {
  id: string;
  title: string;
  status: string;
  derived: DerivedTaskStatus;
  priority: TaskPriority;
  /** `yyyy-mm-dd`, what the date input edits; "" when unset. */
  dueValue: string;
  dueLabel: string;
  late: boolean;
  lateDays: number | null;
  assignee: { id: string; name: string } | null;
  supplierName: string | null;
};

/** The internal plan's serializable custom schema, including values for visible tasks. */
export type PlanColumn = {
  id: string;
  name: string;
  type: PlanColumnType;
  visible: boolean;
  options: string[];
  values: { taskId: string; value: unknown }[];
};

export function toPlanColumns(columns: {
  id: string;
  name: string;
  type: PlanColumnType;
  visible: boolean;
  options: unknown;
  values: { taskId: string; value: unknown }[];
}[]): PlanColumn[] {
  return columns.map((column) => ({
    id: column.id,
    name: column.name,
    type: column.type,
    visible: column.visible,
    options: Array.isArray(column.options)
      ? column.options.filter((option): option is string => typeof option === "string")
      : [],
    values: column.values,
  }));
}

export type PlanGroup = {
  category: TaskCategory;
  name: string;
  stageKey: StageKey | null;
  stageStatus: StageProgress | null;
  /** The stage page, when the group is a stage. */
  stageHref: string | null;
  tasks: PlanTask[];
  done: number;
  /** "12 set – 30 out" across the group's deadlines, or null. */
  span: string | null;
  people: { id: string; name: string }[];
};

/** Stage key for each task category; GENERAL has no stage of its own. */
const CATEGORY_STAGE: Partial<Record<TaskCategory, StageKey>> = {
  CLINICAL: "CLINICAL",
  REGULATORY: "REGULATORY",
  IMPORT: "IMPORT_LOGISTICS",
  GO_TO_MARKET: "GO_TO_MARKET",
};

export const PLAN_CATEGORIES: TaskCategory[] = [
  "CLINICAL",
  "REGULATORY",
  "IMPORT",
  "GO_TO_MARKET",
  "GENERAL",
];

/** Only these carry the priority word; normal work stays blank. */
export const FLAGGED_PRIORITY: TaskPriority[] = ["HIGH", "URGENT"];

export function toPlanTask(task: TaskRow & { status: string }, locale: Locale): PlanTask {
  const remaining = daysUntil(task.dueDate);
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    derived: task.derivedStatus,
    priority: task.priority,
    dueValue: task.dueDate?.toISOString().slice(0, 10) ?? "",
    dueLabel: task.dueDate ? formatDateShort(task.dueDate, locale) : "",
    late: task.derivedStatus === "OVERDUE",
    lateDays: task.derivedStatus === "OVERDUE" && remaining !== null ? Math.abs(remaining) : null,
    assignee: task.assignedTo,
    supplierName: task.supplier?.name ?? null,
  };
}

export function buildPlanGroups({
  tasks,
  stages,
  projectId,
  categories,
  locale,
  dict,
}: {
  tasks: (TaskRow & { status: string })[];
  stages: { key: StageKey; status: string }[];
  projectId: string;
  /** Which groups to show (a "Visão" filter narrows it to one). */
  categories: TaskCategory[];
  locale: Locale;
  dict: Dictionary;
}): PlanGroup[] {
  return categories
    .map((category) => {
      const stageKey = CATEGORY_STAGE[category] ?? null;
      const stage = stageKey ? stages.find((candidate) => candidate.key === stageKey) : undefined;
      const rows = tasks.filter((task) => task.category === category);

      const dated = rows
        .map((task) => task.dueDate)
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      const first = dated[0];
      const last = dated.at(-1);
      const span =
        first && last
          ? first.getTime() === last.getTime()
            ? formatDateShort(first, locale)
            : `${formatDateShort(first, locale)} – ${formatDateShort(last, locale)}`
          : null;

      const people = new Map<string, { id: string; name: string }>();
      for (const task of rows) if (task.assignedTo) people.set(task.assignedTo.id, task.assignedTo);

      const segment = STAGE_ROUTES.find((route) => route.key === stageKey)?.segment;

      return {
        category,
        name: stageKey ? label.stageKey(stageKey, dict) : label.taskCategory(category, dict),
        stageKey,
        stageStatus: (stage?.status as StageProgress | undefined) ?? null,
        stageHref: segment ? `/projects/${projectId}/${segment}` : null,
        tasks: rows.map((task) => toPlanTask(task, locale)),
        done: rows.filter((task) => task.status === "COMPLETED").length,
        span,
        people: [...people.values()],
      };
    })
    // "Geral" only appears when something is filed there; the four stages always do.
    .filter((group) => group.stageKey !== null || group.tasks.length > 0);
}

/** Rebuilds the plan URL with some params changed; `null` drops one. */
export function planHref(
  base: string,
  current: Record<string, string | undefined>,
  changes: Record<string, string | null>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
