import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { TaskCategory, TaskPriority } from "@/generated/prisma";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
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
import { formatDate, daysUntil } from "@/lib/format";
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

export function TasksTable({
  tasks,
  locale,
  dict,
  emptyTitle,
  emptyDescription,
}: {
  tasks: TaskRow[];
  locale: Locale;
  dict: Dictionary;
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
            <TH>Projeto</TH>
            <TH>Categoria</TH>
            <TH>Responsável</TH>
            <TH>Aguardando</TH>
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

            return (
              <TR key={task.id} interactive>
                <TD>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="block after:absolute after:inset-0 after:content-['']"
                  >
                    <CellStack title={task.title} />
                  </Link>
                </TD>
                <TD label="Projeto" className="text-[13px] text-ink-soft">
                  <CellStack
                    title={<span className="font-normal">{task.project.name}</span>}
                    subtitle={task.project.projectCode}
                  />
                </TD>
                <TD label="Categoria" className="text-[13px] text-ink-soft">
                  {label.taskCategory(task.category, dict)}
                </TD>
                <TD label="Responsável" className="text-[13px] text-ink-soft">{task.assignedTo?.name ?? "—"}</TD>
                <TD label="Aguardando" className="text-[13px] text-ink-soft">{task.supplier?.name ?? "—"}</TD>
                <TD label="Prazo"
                  className={cn(
                    "text-[13px] whitespace-nowrap",
                    overdue ? "font-medium text-risk" : "text-ink-soft",
                  )}
                >
                  {formatDate(task.dueDate, locale)}
                  {overdue && remaining !== null ? (
                    <span className="ml-1.5 text-[12px]">({Math.abs(remaining)}d)</span>
                  ) : null}
                </TD>
                <TD label="Status">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </TD>
                <TD label="Prioridade">
                  <PriorityBadge tone={priority.tone}>{priority.label}</PriorityBadge>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
