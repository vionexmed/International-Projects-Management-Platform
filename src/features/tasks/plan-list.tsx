import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar";
import { StatusIcon } from "@/components/ui/badge";
import { TaskAssigneeCell, TaskDueCell, TaskStatusCell, type OwnerOption } from "@/features/tasks/task-cells";
import { FLAGGED_PRIORITY, type PlanGroup } from "@/features/tasks/plan-data";
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
  taskHref,
  dict,
}: {
  groups: PlanGroup[];
  owners: OwnerOption[];
  editable: boolean;
  /** Link that opens a task in the side sheet, keeping the current view. */
  taskHref: (taskId: string) => string;
  dict: Dictionary;
}) {
  return (
    <div className="bg-surface">
      <div
        className={cn(
          COLUMNS,
          "h-[38px] border-b border-line bg-subtle text-label font-semibold text-ink-soft",
        )}
        aria-hidden
      >
        <span className="flex items-center pl-4">Tarefa</span>
        <span className={SIDE_CELL}>Responsável</span>
        <span className={cn("flex items-center px-3", RULE)}>Prazo</span>
        <span className={SIDE_CELL}>Prioridade</span>
      </div>

      {groups.map((group) => {
        const stageStatus = group.stageStatus ? meta.stage(group.stageStatus, dict) : null;
        return (
          <details key={group.category} open className="group/phase">
            <summary
              className={cn(
                COLUMNS,
                "h-10 cursor-pointer list-none border-b border-line-faint hover:bg-subtle [&::-webkit-details-marker]:hidden",
              )}
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
              <span className={SIDE_CELL}>
                <AvatarStack people={group.people} size={20} max={4} />
              </span>
              <span className={cn("flex items-center px-3 text-meta text-muted tabular-nums", RULE)}>
                <span className="truncate">{group.span ?? ""}</span>
              </span>
              <span className={SIDE_CELL} />
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
                    className={cn(COLUMNS, "relative h-10 border-b border-line-faint hover:bg-subtle")}
                  >
                    <span className="flex min-w-0 items-center gap-2 pl-10 md:pl-14">
                      <TaskStatusCell
                        taskId={task.id}
                        status={task.status}
                        derived={task.derived}
                        title={task.title}
                        readOnly={!editable}
                      />
                      <Link
                        href={taskHref(task.id)}
                        scroll={false}
                        className="min-w-0 truncate text-body text-ink after:absolute after:inset-0 hover:underline"
                      >
                        {task.title}
                      </Link>
                      {task.supplierName ? (
                        <span className="hidden shrink-0 text-meta text-muted lg:inline">
                          · aguardando {task.supplierName}
                        </span>
                      ) : null}
                    </span>
                    <span className={cn(SIDE_CELL, "min-w-0")}>
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
                    <span className={SIDE_CELL}>
                      {FLAGGED_PRIORITY.includes(task.priority) ? (
                        <span className="text-body font-medium text-risk">
                          {meta.priority(task.priority, dict).label}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
    </div>
  );
}
