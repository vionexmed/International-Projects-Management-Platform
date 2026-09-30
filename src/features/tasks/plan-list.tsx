"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Calendar, ChevronDown, ChevronRight, Flag, PanelRightOpen, Type, UserRound, type LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { TaskAssigneeCell, TaskDueCell, TaskStatusCell, type OwnerOption } from "@/features/tasks/task-cells";
import { type PlanColumn, type PlanGroup } from "@/features/tasks/plan-data";
import { planColumnKeys, readPlanWidths, resizePlanWidth, widthsForProject } from "@/features/tasks/plan-widths";
import { PlanValueCell } from "@/features/tasks/plan-value-cell";
import { InlineTaskTitleCell } from "@/features/tasks/inline-task-title-cell";
import { InlineTaskPriorityCell } from "@/features/tasks/inline-task-priority-cell";
import { InlineAddTaskRow } from "@/features/tasks/inline-add-task-row";
import { PlanAddColumnMenu, PlanColumnMenu, columnTypeIcon } from "@/features/tasks/plan-custom-column-controls";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import { cn } from "@/lib/utils";

/*
  A Notion-style database table: one header row with a type glyph per
  column, hairline rules between every cell, rows that grow with their
  content, and every value edited where it is shown.
*/
const RULE = "border-l border-line-soft";
/** Room for "+ Coluna" after the last column, even when the table scrolls sideways. */
const ADD_COLUMN_TRACK = 112;

const BUILT_IN: { label: string; icon: LucideIcon }[] = [
  { label: "Tarefa", icon: Type },
  { label: "Responsável", icon: UserRound },
  { label: "Prazo", icon: Calendar },
  { label: "Prioridade", icon: Flag },
];

/* v2: the first version stored the defaults on every visit, pinning them. */
const storageKey = (projectId: string) => `vionex-plan-widths:v2:${projectId}`;

/* Storage is read once per render; nothing else writes it while the plan is open. */
const subscribeNever = () => () => {};

function savedWidths(projectId: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(storageKey(projectId)); }
  catch { return null; }
}

function HeaderLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <Icon className="size-3.5 shrink-0 text-faint" aria-hidden />
      <span className="truncate">{label}</span>
    </>
  );
}

/**
 * The project plan, grouped by stage. `openHref` is the plan's current URL;
 * with it every row offers "Abrir", which opens the task sheet over the plan.
 */
export function PlanList({
  groups,
  owners,
  editable,
  canCreate = false,
  projectId,
  columns,
  dict,
  openHref,
}: {
  groups: PlanGroup[];
  owners: OwnerOption[];
  editable: boolean;
  canCreate?: boolean;
  projectId: string;
  columns: PlanColumn[];
  dict: Dictionary;
  openHref?: string;
}) {
  const visibleColumns = columns.filter((column) => column.visible);
  const keys = planColumnKeys(columns);
  const visibleKeys = planColumnKeys(visibleColumns);
  /*
    The server has no browser storage, so the first render uses the defaults
    and a saved preference is applied right after hydration — reading it
    during render made the server and client markup disagree.
  */
  const [widthsByProject, setWidthsByProject] = React.useState<Record<string, ReturnType<typeof readPlanWidths>>>({});
  const saved = React.useSyncExternalStore(subscribeNever, () => savedWidths(projectId), () => null);
  const widths = widthsForProject(projectId, keys, widthsByProject, saved);
  // Only a width somebody chose is stored; untouched columns follow the defaults.
  const resized = React.useRef(false);
  const setWidths = (update: (current: typeof widths) => typeof widths) => {
    resized.current = true;
    setWidthsByProject((current) => ({
      ...current,
      [projectId]: update(widthsForProject(projectId, keys, current, saved)),
    }));
  };
  React.useEffect(() => {
    if (!resized.current) return;
    try { window.localStorage.setItem(storageKey(projectId), JSON.stringify(widths)); } catch { /* Keep resizing available in memory. */ }
  }, [projectId, widths]);
  const effectiveWidths = visibleKeys.map((key) => widths[key] ?? readPlanWidths(projectId, [key], null)[key]);
  const drag = React.useRef<{ key: string; lastX: number } | null>(null);

  /* Invisible until the pointer or focus reaches the boundary, then a brand rule. */
  const resizeHandle = (key: string, label: string) => (
    <button
      type="button"
      aria-label={`Redimensionar coluna ${label}`}
      aria-keyshortcuts="ArrowLeft ArrowRight"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setWidths((current) => resizePlanWidth(current, key, event.key === "ArrowRight" ? 8 : -8));
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        drag.current = { key, lastX: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.key !== key) return;
        const delta = event.clientX - drag.current.lastX;
        drag.current.lastX = event.clientX;
        setWidths((current) => resizePlanWidth(current, key, delta));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => { drag.current = null; }}
      className="group/handle absolute -right-[5px] top-0 z-20 flex h-full w-[9px] cursor-col-resize touch-none justify-center outline-none"
    >
      <span aria-hidden="true" className="h-full w-0.5 rounded-full transition-colors group-hover/handle:bg-brand group-focus-visible/handle:bg-brand group-active/handle:bg-brand" />
    </button>
  );

  const gridClass = "grid";
  const gridStyle = { gridTemplateColumns: `${effectiveWidths.map((width) => `${width}px`).join(" ")} minmax(${ADD_COLUMN_TRACK}px, 1fr)` };
  const tableWidth = effectiveWidths.reduce((total, width) => total + width, ADD_COLUMN_TRACK);
  const taskLink = (taskId: string) =>
    openHref ? `${openHref}${openHref.includes("?") ? "&" : "?"}task=${encodeURIComponent(taskId)}` : null;

  return (
    <div role="region" aria-label="Plano de trabalho" className="-mb-px min-w-0 bg-surface">
      <div className="scroll-slim overflow-x-auto">
      <div style={{ width: `${tableWidth}px`, minWidth: "100%" }}>
      <div
        className={cn(gridClass, "h-9 border-b border-line-soft bg-surface text-label font-medium text-muted")}
        style={gridStyle}
      >
        {visibleKeys.map((key, index) => {
          const column = index >= BUILT_IN.length ? visibleColumns[index - BUILT_IN.length] : null;
          const label = column ? column.name : BUILT_IN[index].label;
          const icon = column ? columnTypeIcon(column.type) : BUILT_IN[index].icon;
          return (
            <span key={key} className={cn("relative flex min-w-0 items-stretch", index > 0 && RULE)}>
              {column && editable ? (
                <PlanColumnMenu projectId={projectId} column={column} columns={columns}>
                  <HeaderLabel icon={icon} label={label} />
                </PlanColumnMenu>
              ) : (
                <span className={cn("flex min-w-0 flex-1 items-center gap-1.5", index === 0 ? "pl-4 pr-3" : "px-3")}>
                  <HeaderLabel icon={icon} label={label} />
                </span>
              )}
              {resizeHandle(key, label)}
            </span>
          );
        })}
        <span className={cn("flex min-w-0 items-center px-1.5", RULE)}>
          {editable ? <PlanAddColumnMenu projectId={projectId} columns={columns} /> : null}
        </span>
      </div>

      {groups.map((group) => {
        const stageStatus = group.stageStatus ? meta.stage(group.stageStatus, dict) : null;
        const share = group.tasks.length > 0 ? Math.round((group.done / group.tasks.length) * 100) : 0;
        return (
          <details key={group.category} open className="group/phase">
            <summary
              className={cn(
                gridClass,
                "min-h-11 cursor-pointer list-none border-b border-line-soft bg-subtle transition-colors hover:bg-raised/60 [&::-webkit-details-marker]:hidden",
              )}
              style={gridStyle}
            >
              <span className="col-[1/-1] flex min-w-0 items-center gap-2 px-3 py-2">
                <ChevronDown
                  className="size-4 shrink-0 -rotate-90 text-faint transition-transform group-open/phase:rotate-0"
                  aria-hidden
                />
                {/* Status glyphs belong to tasks; the count and bar say how the stage is going. */}
                <span className="truncate text-body font-semibold text-ink">{group.name}</span>
                {stageStatus ? <span className="sr-only">Etapa: {stageStatus.label}</span> : null}
                <span className="shrink-0 text-meta text-muted tabular-nums" title={`${group.done} de ${group.tasks.length} concluídas`}>
                  {group.done}/{group.tasks.length}
                </span>
                {group.tasks.length > 0 ? (
                  <span className="hidden h-1 w-14 shrink-0 overflow-hidden rounded-full bg-line-soft sm:block" aria-hidden>
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                  </span>
                ) : null}
                {group.stageHref ? (
                  <Link
                    href={group.stageHref}
                    className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-meta font-medium text-muted transition-colors hover:bg-raised hover:text-brand-strong"
                  >
                    Ver etapa
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </span>
            </summary>

            <ul>
              {group.tasks.length === 0 && !canCreate ? (
                <li className="flex h-10 items-center border-b border-line-soft pl-12 text-body text-faint">Nenhuma tarefa nesta etapa.</li>
              ) : null}
              {group.tasks.map((task) => {
                const href = taskLink(task.id);
                return (
                  <li
                    key={task.id}
                    className={cn(gridClass, "group/row relative min-h-10 border-b border-line-soft bg-surface transition-colors hover:bg-subtle")}
                    style={gridStyle}
                  >
                    <span className="flex min-w-0 items-start gap-1 py-1 pr-2 pl-3">
                      <span className="flex h-8 shrink-0 items-center">
                        <TaskStatusCell
                          taskId={task.id}
                          status={task.status}
                          derived={task.derived}
                          title={task.title}
                          readOnly={!editable}
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <InlineTaskTitleCell key={task.title} taskId={task.id} title={task.title} editable={editable} />
                      </span>
                      {/* One line: the reason waits behind a glyph and shows on hover or focus. */}
                      {task.supplierName && task.status !== "COMPLETED" && task.status !== "CANCELLED" ? (
                        <Tooltip content={`Aguardando ${task.supplierName}`}>
                          <button
                            type="button"
                            aria-label={`Aguardando ${task.supplierName}`}
                            className="relative z-10 mt-1 inline-flex size-6 shrink-0 cursor-default items-center justify-center rounded-sm text-warn transition-colors hover:bg-warn-soft focus-visible:outline-2 focus-visible:outline-brand"
                          >
                            <AlertCircle className="size-4" aria-hidden />
                          </button>
                        </Tooltip>
                      ) : null}
                      {href ? (
                        <Link
                          href={href}
                          scroll={false}
                          aria-label={`Abrir ${task.title}`}
                          className="relative z-10 mt-1.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border border-line bg-surface px-1.5 text-meta font-medium text-muted opacity-0 shadow-sm transition-opacity group-hover/row:opacity-100 hover:text-ink focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                        >
                          <PanelRightOpen className="size-3.5" aria-hidden />
                          Abrir
                        </Link>
                      ) : null}
                    </span>
                    <span className={cn("flex min-w-0 items-start px-3 py-1", RULE)}>
                      <TaskAssigneeCell
                        taskId={task.id}
                        assignee={task.assignee}
                        owners={owners}
                        title={task.title}
                        readOnly={!editable}
                        quietEmpty
                      />
                    </span>
                    <span className={cn("flex min-w-0 items-start px-3 py-1 text-body", RULE)}>
                      <span className="flex h-8 min-w-0 items-center">
                        <TaskDueCell
                          taskId={task.id}
                          value={task.dueValue}
                          label={task.lateDays !== null ? `${task.dueLabel} · ${task.lateDays}d` : task.dueLabel}
                          late={task.late}
                          title={task.title}
                          readOnly={!editable}
                          quietEmpty
                        />
                      </span>
                    </span>
                    <span className={cn("flex min-w-0 items-start px-1 py-1", RULE)}>
                      <InlineTaskPriorityCell taskId={task.id} priority={task.priority} editable={editable} title={task.title} />
                    </span>
                    {visibleColumns.map((column) => {
                      const value = column.values.find((entry) => entry.taskId === task.id)?.value ?? null;
                      return <span key={column.id} className={cn("flex min-w-0 flex-col justify-start px-1 py-1", RULE)}>
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
                    <span className={RULE} />
                  </li>
                );
              })}
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
