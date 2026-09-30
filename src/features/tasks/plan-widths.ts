import type { PlanColumn } from "@/features/tasks/plan-data";

export type PlanWidthMap = Record<string, number>;

/** Widths are pixels. Text cells can wrap, but controls need these usable floors. */
const DEFAULT_WIDTHS: PlanWidthMap = { task: 288, assignee: 208, due: 136, priority: 104 };
const MIN_WIDTHS: PlanWidthMap = { task: 240, assignee: 144, due: 112, priority: 104 };
const CUSTOM_DEFAULT = 160;
const CUSTOM_MIN = 120;

const minimum = (key: string) => MIN_WIDTHS[key] ?? CUSTOM_MIN;
const fallback = (key: string) => DEFAULT_WIDTHS[key] ?? CUSTOM_DEFAULT;

export function planColumnKeys(columns: PlanColumn[]): string[] {
  return ["task", "assignee", "due", "priority", ...columns.map((column) => column.id)];
}

/** Read the project-specific storage entry, retaining hidden custom IDs. */
export function readPlanWidths(projectId: string, keys: string[], raw: string | null): PlanWidthMap {
  let saved: unknown = null;
  if (projectId && raw) {
    try { saved = JSON.parse(raw); } catch { /* Use defaults for corrupt preferences. */ }
  }
  const entries = saved && typeof saved === "object" && !Array.isArray(saved)
    ? Object.entries(saved)
    : [];
  const result: PlanWidthMap = {};
  for (const [key, value] of entries) {
    if (typeof value === "number" && Number.isFinite(value) && value >= minimum(key)) result[key] = value;
  }
  for (const key of keys) result[key] ??= fallback(key);
  return result;
}

/** Pick only this project's in-memory widths, or load its own saved preference. */
export function widthsForProject(
  projectId: string,
  keys: string[],
  cached: Record<string, PlanWidthMap>,
  raw: string | null,
): PlanWidthMap {
  return cached[projectId] ?? readPlanWidths(projectId, keys, raw);
}

export function resizePlanWidth(widths: PlanWidthMap, key: string, delta: number): PlanWidthMap {
  if (!Number.isFinite(delta)) return widths;
  return { ...widths, [key]: Math.max(minimum(key), (widths[key] ?? fallback(key)) + delta) };
}
