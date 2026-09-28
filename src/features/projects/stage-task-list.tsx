import type { ProgressStatus, Task, TaskPriority } from "@/generated/prisma";
import { StatusIcon } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { DenseEmpty, DenseList, DenseRow } from "@/features/projects/work-block";
import { deriveTaskStatus } from "@/lib/status";
import { formatDateShort } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/server/services/tasks";

export type StageTask = Pick<Task, "id" | "title" | "dueDate"> & {
  // The raw column type: every caller here queries `Task` directly.
  status: ProgressStatus;
  priority: TaskPriority;
  assignedTo: { name: string } | null;
  supplier: { name: string } | null;
};

/** Only the priorities worth reading get a word; normal work stays blank. */
const LOUD_PRIORITY: TaskPriority[] = ["HIGH", "URGENT"];

/** A stage's tasks as 40-px rows: status glyph, title, assignee, deadline. */
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
  if (tasks.length === 0) return <DenseEmpty>{emptyTitle}</DenseEmpty>;

  return (
    <DenseList>
      {tasks.map((task) => {
        const derived = deriveTaskStatus(task.status as TaskStatus, task.dueDate);
        const status = meta.task(derived, dict);
        const late = derived === "OVERDUE";
        const priority = LOUD_PRIORITY.includes(task.priority) ? meta.priority(task.priority, dict) : null;

        return (
          <DenseRow
            key={task.id}
            href={`/tasks/${task.id}`}
            leading={<StatusIcon status={derived} label={status.label} />}
            title={task.title}
            meta={task.supplier ? `aguardando ${task.supplier.name}` : null}
            trailing={
              <>
                {priority ? <span className="font-medium text-risk">{priority.label}</span> : null}
                {task.assignedTo ? (
                  <span title={task.assignedTo.name}>
                    <UserAvatar name={task.assignedTo.name} size="xs" />
                  </span>
                ) : null}
                <span className={cn("w-12 text-right tabular-nums", late ? "font-medium text-risk" : "text-ink-soft")}>
                  {task.dueDate ? formatDateShort(task.dueDate, locale) : ""}
                </span>
              </>
            }
          />
        );
      })}
    </DenseList>
  );
}
