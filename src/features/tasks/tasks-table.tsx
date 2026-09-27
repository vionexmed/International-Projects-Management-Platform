import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { TaskCategory, TaskPriority } from "@/generated/prisma";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { formatDateShort, daysUntil } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/server/services/tasks";

export type TaskRow = {
  id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: Date | null;
  derivedStatus: TaskStatus | "OVERDUE";
  project: { id: string; name: string; projectCode: string };
  assignedTo: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
};

/** Only these carry the "Alta"/"Urgente" flag — everything else stays blank. */
const FLAGGED_PRIORITY: TaskPriority[] = ["HIGH", "URGENT"];

export function TasksTable({
  tasks,
  locale,
  dict,
  /** Drops the project name from the primary cell's secondary line: the page already scopes to one project. */
  scope,
  emptyTitle,
  emptyDescription,
}: {
  tasks: TaskRow[];
  locale: Locale;
  dict: Dictionary;
  scope?: "project";
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (tasks.length === 0) {
    return <EmptyState icon={ListChecks} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <TableScroll>
      <Table>
        <THead>
          <TR>
            <TH>Tarefa</TH>
            <TH>Responsável</TH>
            <TH>Prazo</TH>
            <TH>Status</TH>
            <TH>Prioridade</TH>
          </TR>
        </THead>
        <TBody>
          {tasks.map((task) => {
            const status = meta.task(task.derivedStatus, dict);
            const priority = meta.priority(task.priority, dict);
            const overdue = task.derivedStatus === "OVERDUE";
            const remaining = daysUntil(task.dueDate);
            const category = label.taskCategory(task.category, dict);
            const taskSubtitle =
              scope === "project" ? category : `${task.project.name} · ${category}`;

            return (
              <TR key={task.id} interactive>
                <TD>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="block after:absolute after:inset-0 after:content-['']"
                  >
                    <CellStack title={task.title} subtitle={taskSubtitle} />
                  </Link>
                </TD>
                <TD label="Responsável">
                  <CellStack
                    title={task.assignedTo?.name ?? ""}
                    subtitle={task.supplier ? `Aguardando ${task.supplier.name}` : undefined}
                  />
                </TD>
                <TD
                  label="Prazo"
                  className={cn(overdue ? "font-medium text-risk" : undefined)}
                >
                  {task.dueDate ? formatDateShort(task.dueDate, locale) : ""}
                  {overdue && remaining !== null ? (
                    <span className="ml-1.5 text-meta">({Math.abs(remaining)}d)</span>
                  ) : null}
                </TD>
                <TD label="Status">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </TD>
                <TD label="Prioridade">
                  {FLAGGED_PRIORITY.includes(task.priority) ? (
                    <span className="font-medium text-risk">{priority.label}</span>
                  ) : null}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
