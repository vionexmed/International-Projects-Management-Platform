import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { ProgressStatus, Task, TaskPriority } from "@/generated/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { deriveTaskStatus } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import type { TaskStatus } from "@/server/services/tasks";

export type StageTask = Pick<Task, "id" | "title" | "dueDate"> & {
  // The raw column type: every caller here queries `Task` directly.
  status: ProgressStatus;
  priority: TaskPriority;
  assignedTo: { name: string } | null;
  supplier: { name: string } | null;
};

/** Compact task list reused by every stage tab. */
export function StageTaskList({
  tasks,
  locale,
  dict,
  emptyTitle = "Nenhuma tarefa nesta etapa.",
}: {
  tasks: StageTask[];
  locale: Locale;
  dict: Dictionary;
  emptyTitle?: string;
}) {
  if (tasks.length === 0) {
    return <EmptyState icon={ListChecks} title={emptyTitle} compact />;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {tasks.map((task) => {
        const derived = deriveTaskStatus(task.status as TaskStatus, task.dueDate);
        const status = meta.task(derived, dict);
        const priority = meta.priority(task.priority, dict);

        return (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-subtle"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted">
                  {task.assignedTo?.name ?? "Sem responsável"}
                  {task.supplier ? ` · aguardando ${task.supplier.name}` : ""}
                  {task.dueDate ? ` · ${formatDate(task.dueDate, locale)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-5">
                <PriorityBadge tone={priority.tone}>{priority.label}</PriorityBadge>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
