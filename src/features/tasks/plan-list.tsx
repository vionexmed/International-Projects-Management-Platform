"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StatusIcon } from "@/components/ui/badge";
import { TaskAssigneeCell, TaskDueCell, TaskStatusCell, type OwnerOption } from "@/features/tasks/task-cells";
import { type PlanColumn, type PlanGroup } from "@/features/tasks/plan-data";
import { PlanValueCell } from "@/features/tasks/plan-value-cell";
import { InlineTaskTitleCell } from "@/features/tasks/inline-task-title-cell";
import { InlineTaskPriorityCell } from "@/features/tasks/inline-task-priority-cell";
import { InlineAddTaskRow } from "@/features/tasks/inline-add-task-row";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import { cn } from "@/lib/utils";

/*
  Task | Responsável | Prazo | Prioridade. On a phone only the task and its
  deadline remain; the other two are one tap away in the task sheet.
*/
const RULE = "md:border-l md:border-line-faint";
const BASE_WIDTHS = [208, 136, 104];

/**
 * An editable table grouped by stage. Group rows are full-width and task
 * rows keep their resizable property columns.
 */
export function PlanList({
  groups,
  owners,
  editable,
  canCreate = false,
  projectId,
  columns,
  dict,
}: {
  groups: PlanGroup[];
  owners: OwnerOption[];
  editable: boolean;
  canCreate?: boolean;
  projectId: string;
  columns: PlanColumn[];
  dict: Dictionary;
}) {
  const visibleColumns = columns.filter((column) => column.visible);
  const [widths, setWidths] = React.useState(() => {
    if (typeof window === "undefined") return [...BASE_WIDTHS, ...visibleColumns.map(() => 160)];
    try {
      const saved = window.localStorage.getItem(`vionex-plan-widths:${projectId}`);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length === 3 + visibleColumns.length && parsed.every((width) => typeof width === "number" && Number.isFinite(width) && width >= 96)) return parsed;
    } catch { /* Browser storage may be unavailable or contain an older value. */ }
    return [...BASE_WIDTHS, ...visibleColumns.map(() => 160)];
  });
  React.useEffect(() => {
    try { window.localStorage.setItem(`vionex-plan-widths:${projectId}`, JSON.stringify(widths)); } catch { /* Keep resizing available in memory. */ }
  }, [projectId, widths]);
  const effectiveWidths = widths.length === 3 + visibleColumns.length
    ? widths
    : [...BASE_WIDTHS, ...visibleColumns.map(() => 160)];
  const resize = (index: number, startX: number) => {
    const start = effectiveWidths[index];
    const move = (event: PointerEvent) => setWidths(effectiveWidths.map((width, item) => item === index ? Math.max(96, start + event.clientX - startX) : width));
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop);
  };
  const gridClass = "grid";
  const gridStyle = { gridTemplateColumns: `minmax(18rem, 1fr) ${effectiveWidths.map((width) => `${width}px`).join(" ")}` };
  const sideCell = cn("flex items-center px-3", RULE);
  const headers = ["Responsável", "Prazo", "Prioridade", ...visibleColumns.map((column) => column.name)];
  return (
    <div role="region" aria-label="Plano de trabalho" className="min-w-0 bg-surface">
      <div className="scroll-slim overflow-x-auto">
      <div style={{ minWidth: `${720 + visibleColumns.length * 160}px` }}>
      <div
        className={cn(
          gridClass,
          "h-10 border-b border-line-faint bg-surface text-xs font-medium text-muted",
        )}
        style={gridStyle}
      >
        <span className="flex items-center pl-5">Tarefa</span>
        {headers.map((header, index) => (
          <span key={header} className={cn("relative flex min-w-0 items-center truncate px-3", RULE)}>
            {header}
            <button type="button" aria-label={`Redimensionar coluna ${header}`} onPointerDown={(event) => { event.preventDefault(); resize(index, event.clientX); }} className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none" />
          </span>
        ))}
      </div>

      {groups.map((group) => {
        const stageStatus = group.stageStatus ? meta.stage(group.stageStatus, dict) : null;
        return (
          <details key={group.category} open className="group/phase">
            <summary
              className={cn(
                gridClass,
                "h-12 cursor-pointer list-none border-t border-line bg-surface hover:bg-raised/70 [&::-webkit-details-marker]:hidden",
              )}
              style={gridStyle}
            >
              <span className="flex min-w-0 items-center gap-2.5 pl-5">
                <ChevronDown
                  className="size-4 shrink-0 -rotate-90 text-faint transition-transform group-open/phase:rotate-0"
                  aria-hidden
                />
                <StatusIcon
                  status={group.stageStatus ?? "NOT_STARTED"}
                  label={stageStatus ? `Etapa: ${stageStatus.label}` : undefined}
                />
                <span className="truncate text-body font-semibold text-ink">{group.name}</span>
                <span className="shrink-0 text-meta text-muted tabular-nums">
                  {group.done} de {group.tasks.length}
                </span>
                {group.stageHref ? (
                  <Link
                    href={group.stageHref}
                    className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-meta font-medium text-brand-strong hover:bg-brand-soft"
                  >
                    Etapa
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </span>
              <span />
              <span />
              <span className="flex items-center px-3" />
              {visibleColumns.map((column) => <span key={column.id} />)}
            </summary>

            <ul>
              {group.tasks.length === 0 && !canCreate ? (
                <li className="flex h-11 items-center border-b border-line-faint pl-16 text-body text-faint">Nenhuma tarefa nesta etapa.</li>
              ) : null}
                {group.tasks.map((task) => (
                  <li
                    key={task.id}
                    className={cn(gridClass, "relative min-h-12 border-b border-line-faint bg-surface transition-colors hover:bg-brand-soft/20")}
                    style={gridStyle}
                  >
                    <span className="flex min-w-0 items-center gap-2 pl-10 pr-3 md:pl-14">
                      <TaskStatusCell
                        taskId={task.id}
                        status={task.status}
                        derived={task.derived}
                        title={task.title}
                        readOnly={!editable}
                      />
                      <span className="flex min-w-0 flex-1 flex-col justify-center py-1.5">
                        <InlineTaskTitleCell taskId={task.id} title={task.title} editable={editable} />
                        {task.supplierName && task.status !== "COMPLETED" && task.status !== "CANCELLED" ? (
                          <span title={`Aguardando ${task.supplierName}`} className="mt-0.5 self-start rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-amber-800">
                            Aguardando fornecedor
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className={cn(sideCell, "min-w-0")}>
                      <TaskAssigneeCell
                        taskId={task.id}
                        assignee={task.assignee}
                        owners={owners}
                        title={task.title}
                        readOnly={!editable}
                      />
                    </span>
                    <span className={cn("flex min-w-0 items-center px-3 text-body", RULE)}>
                      <TaskDueCell
                        taskId={task.id}
                        value={task.dueValue}
                        label={
                          task.lateDays !== null ? `${task.dueLabel} (${task.lateDays}d)` : task.dueLabel
                        }
                        late={task.late}
                        title={task.title}
                        readOnly={!editable}
                      />
                    </span>
                    <span className={sideCell}>
                      <InlineTaskPriorityCell taskId={task.id} priority={task.priority} editable={editable} />
                    </span>
                    {visibleColumns.map((column) => {
                      const value = column.values.find((entry) => entry.taskId === task.id)?.value ?? null;
                      return <span key={column.id} className={cn("flex min-w-0 items-center px-1", RULE)}>
                        <PlanValueCell
                          key={`${column.id}:${JSON.stringify(value)}`}
                          projectId={projectId}
                          taskId={task.id}
                          taskTitle={task.title}
                          column={column}
                          value={value}
                          owners={owners}
                          editable={editable}
                        />
                      </span>;
                    })}
                  </li>
                ))}
              {canCreate ? <InlineAddTaskRow projectId={projectId} category={group.category} categoryName={group.name} gridStyle={gridStyle} /> : null}
            </ul>
          </details>
        );
      })}
      </div>
      </div>
    </div>
  );
}
