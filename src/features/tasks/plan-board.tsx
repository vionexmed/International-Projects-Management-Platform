import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusIcon } from "@/components/ui/badge";
import { TaskAssigneeCell, TaskStatusCell, type OwnerOption } from "@/features/tasks/task-cells";
import { FLAGGED_PRIORITY, type PlanGroup } from "@/features/tasks/plan-data";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * The same groups as the list, as 276-px stage columns on the tinted
 * surface with white cards. No drag and drop: status changes from the glyph
 * on each card, through the same action as the list.
 */
export function PlanBoard({
  groups,
  owners,
  editable,
  taskHref,
  dict,
}: {
  groups: PlanGroup[];
  owners: OwnerOption[];
  editable: boolean;
  taskHref: (taskId: string) => string;
  dict: Dictionary;
}) {
  return (
    <div className="scroll-slim overflow-x-auto">
      <ol className="flex min-w-max items-start gap-3 px-4 py-4 sm:px-6">
        {groups.map((group) => {
          const stageStatus = group.stageStatus ? meta.stage(group.stageStatus, dict) : null;
          return (
            <li
              key={group.category}
              className="flex w-[276px] shrink-0 flex-col rounded-sm border border-line-soft bg-subtle"
            >
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <StatusIcon
                    status={group.stageStatus ?? "NOT_STARTED"}
                    label={stageStatus ? `Etapa: ${stageStatus.label}` : undefined}
                  />
                  <h3 className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
                    {group.name}
                  </h3>
                  <span className="text-meta text-muted tabular-nums">
                    {group.done}/{group.tasks.length}
                  </span>
                </div>
                <div className="mt-1 flex h-4 items-center justify-between gap-2 pl-6 text-meta text-muted">
                  <span className="truncate tabular-nums">{group.span ?? "Sem prazos"}</span>
                  {group.stageHref ? (
                    <Link
                      href={group.stageHref}
                      className="inline-flex shrink-0 items-center gap-0.5 font-medium text-brand-strong hover:underline"
                    >
                      Etapa
                      <ChevronRight className="size-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </div>

              {group.tasks.length === 0 ? (
                <p className="mx-2 mb-2 rounded-sm border border-dashed border-line px-3 py-4 text-center text-meta text-faint">
                  Nenhuma tarefa.
                </p>
              ) : (
                <ul className="space-y-2 px-2 pb-2">
                  {group.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="relative rounded-xs border border-line-soft bg-surface p-3 transition-colors hover:border-line-strong"
                    >
                      <Link
                        href={taskHref(task.id)}
                        scroll={false}
                        className="line-clamp-2 text-body font-medium text-ink after:absolute after:inset-0"
                      >
                        {task.title}
                      </Link>
                      {task.supplierName ? (
                        <p className="mt-0.5 truncate text-meta text-muted">
                          Aguardando {task.supplierName}
                        </p>
                      ) : null}
                      <div className="mt-2.5 flex items-center gap-2">
                        <TaskStatusCell
                          taskId={task.id}
                          status={task.status}
                          derived={task.derived}
                          title={task.title}
                          readOnly={!editable}
                        />
                        <span
                          className={cn(
                            "text-meta tabular-nums",
                            task.late ? "font-medium text-risk" : "text-muted",
                          )}
                        >
                          {task.dueValue ? task.dueLabel : "Sem prazo"}
                        </span>
                        {FLAGGED_PRIORITY.includes(task.priority) ? (
                          <span className="text-meta font-medium text-risk">
                            {meta.priority(task.priority, dict).label}
                          </span>
                        ) : null}
                        <span className="ml-auto">
                          <TaskAssigneeCell
                            taskId={task.id}
                            assignee={task.assignee}
                            owners={owners}
                            title={task.title}
                            readOnly={!editable}
                            avatarOnly
                          />
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
