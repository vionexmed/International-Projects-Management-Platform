import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar";
import { StatusIcon } from "@/components/ui/badge";
import { TaskAssigneeCell, TaskDueCell, TaskStatusCell, type OwnerOption } from "@/features/tasks/task-cells";
import { type PlanColumn, type PlanGroup } from "@/features/tasks/plan-data";
import { PlanValueCell } from "@/features/tasks/plan-value-cell";
import { InlineTaskTitleCell } from "@/features/tasks/inline-task-title-cell";
import { InlineTaskPriorityCell } from "@/features/tasks/inline-task-priority-cell";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import { cn } from "@/lib/utils";

/*
  Task | Responsável | Prazo | Prioridade. On a phone only the task and its
  deadline remain; the other two are one tap away in the task sheet.
*/
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_13rem_8.5rem_6.5rem]";
const RULE = "md:border-l md:border-line-soft";
const SIDE_CELL = cn("hidden items-center px-3 md:flex", RULE);

/**
 * The plan as a flush grid: one 40-px phase row per stage (chevron, stage
 * status glyph, name, done count, the group's people and deadline span), and
 * its tasks underneath, indented 24 px. Groups fold with a native
 * `<details>`, so collapsing needs no client state.
 */
export function PlanList({
  groups,
  owners,
  editable,
  projectId,
  columns,
  taskHref,
  dict,
}: {
  groups: PlanGroup[];
  owners: OwnerOption[];
  editable: boolean;
  projectId: string;
  columns: PlanColumn[];
  taskHref: (taskId: string) => string;
  dict: Dictionary;
}) {
  void taskHref;
  const visibleColumns = columns.filter((column) => column.visible);
  const expanded = visibleColumns.length > 0;
  const gridClass = expanded ? "grid" : COLUMNS;
  const gridStyle = expanded
    ? { gridTemplateColumns: `minmax(16rem, 1fr) 13rem 8.5rem 6.5rem repeat(${visibleColumns.length}, minmax(10rem, 1fr))` }
    : undefined;
  const sideCell = expanded ? cn("flex items-center px-3", RULE) : SIDE_CELL;
  return (
    <div className={cn("bg-surface", expanded && "overflow-x-auto")}>
      <div style={expanded ? { minWidth: `${620 + visibleColumns.length * 160}px` } : undefined}>
      <div
        className={cn(
          gridClass,
          "h-[38px] border-b border-line bg-subtle text-label font-semibold text-ink-soft",
        )}
        style={gridStyle}
        aria-hidden={expanded ? undefined : true}
      >
        <span className="flex items-center pl-4">Tarefa</span>
        <span className={sideCell}>Responsável</span>
        <span className={cn("flex items-center px-3", RULE)}>Prazo</span>
        <span className={sideCell}>Prioridade</span>
        {visibleColumns.map((column) => (
          <span key={column.id} className={cn("flex min-w-0 items-center truncate px-3", RULE)}>
            {column.name}
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
                "h-12 cursor-pointer list-none border-y border-line bg-subtle/70 hover:bg-subtle [&::-webkit-details-marker]:hidden",
              )}
              style={gridStyle}
            >
              <span className="flex min-w-0 items-center gap-2 pl-4">
                <ChevronDown
                  className="size-4 shrink-0 -rotate-90 text-faint transition-transform group-open/phase:rotate-0"
                  aria-hidden
                />
                <StatusIcon
                  status={group.stageStatus ?? "NOT_STARTED"}
                  label={stageStatus ? `Etapa: ${stageStatus.label}` : undefined}
                />
                <span className="truncate text-body font-semibold text-ink">{group.name}</span>
                <span className="hidden rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted sm:inline">Categoria</span>
                <span className="shrink-0 text-meta text-muted tabular-nums">
                  {group.done}/{group.tasks.length}
                </span>
                {group.stageHref ? (
                  <Link
                    href={group.stageHref}
                    className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-sm text-meta font-medium text-brand-strong hover:underline"
                  >
                    Etapa
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </span>
              <span className={sideCell}>
                <AvatarStack people={group.people} size={20} max={4} />
              </span>
              <span className={cn("flex items-center px-3 text-meta text-muted tabular-nums", RULE)}>
                <span className="truncate">{group.span ?? ""}</span>
              </span>
              <span className={sideCell} />
              {visibleColumns.map((column) => <span key={column.id} className={RULE} />)}
            </summary>

            {group.tasks.length === 0 ? (
              <p className="flex h-10 items-center border-b border-line-faint pl-16 text-body text-faint">
                Nenhuma tarefa nesta etapa.
              </p>
            ) : (
              <ul>
                {group.tasks.map((task) => (
                  <li
                    key={task.id}
                    className={cn(gridClass, "relative h-10 border-b border-line-faint bg-surface hover:bg-brand-soft/30")}
                    style={gridStyle}
                  >
                    <span className="flex min-w-0 items-center gap-2 pl-10 md:pl-14">
                      <TaskStatusCell
                        taskId={task.id}
                        status={task.status}
                        derived={task.derived}
                        title={task.title}
                        readOnly={!editable}
                      />
                      <InlineTaskTitleCell taskId={task.id} title={task.title} editable={editable} />
                      {task.supplierName ? (
                        <span className="hidden shrink-0 text-meta text-muted lg:inline">
                          · aguardando {task.supplierName}
                        </span>
                      ) : null}
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
              </ul>
            )}
          </details>
        );
      })}
      </div>
    </div>
  );
}
