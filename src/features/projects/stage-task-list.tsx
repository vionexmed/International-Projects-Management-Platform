import type { ProgressStatus, Task, TaskPriority } from "@/generated/prisma";
import { StatusBadge } from "@/components/ui/badge";
import { CanvasEmpty, CanvasList, CanvasRow } from "@/features/projects/canvas-list";
import { deriveTaskStatus } from "@/lib/status";
import { formatDateShort } from "@/lib/format";
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

/** Only the priorities worth reading get a word; normal work stays blank. */
const LOUD_PRIORITY: TaskPriority[] = ["HIGH", "URGENT"];

/** Compact task list reused by the stage pages, on the canvas under a section title. */
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
  if (tasks.length === 0) return <CanvasEmpty>{emptyTitle}</CanvasEmpty>;

  return (
    <CanvasList>
      {tasks.map((task) => {
        const status = meta.task(deriveTaskStatus(task.status as TaskStatus, task.dueDate), dict);
        const priority = LOUD_PRIORITY.includes(task.priority)
          ? meta.priority(task.priority, dict)
          : null;

        return (
          <CanvasRow
            key={task.id}
            href={`/tasks/${task.id}`}
            title={task.title}
            subtitle={[
              task.assignedTo?.name ?? "Sem responsável",
              task.supplier ? `aguardando ${task.supplier.name}` : null,
              task.dueDate ? formatDateShort(task.dueDate, locale) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            trailing={
              <>
                {priority ? (
                  <span className="text-meta font-medium whitespace-nowrap text-risk">
                    {priority.label}
                  </span>
                ) : null}
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </>
            }
          />
        );
      })}
    </CanvasList>
  );
}
