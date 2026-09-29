import "server-only";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { can } from "@/server/auth/current-user";
import { requireTaskAccess } from "@/server/authz/access";
import { listTaskComments } from "@/server/services/tasks";
import { UserAvatar } from "@/components/ui/avatar";
import { PropertyList } from "@/components/ui/card";
import { TaskAssigneeCell, TaskDueCell, TaskStatusCell, type OwnerOption } from "@/features/tasks/task-cells";
import { TaskCommentForm } from "@/features/tasks/task-comment-form";
import { EditTaskDialog } from "@/features/tasks/edit-task-dialog";
import { FLAGGED_PRIORITY } from "@/features/tasks/plan-data";
import { deriveTaskStatus } from "@/lib/status";
import { daysUntil, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";
import type { TaskStatus } from "@/server/services/tasks";
import type { SessionUser } from "@/types/auth";
import { cn } from "@/lib/utils";

/**
 * One task's record, rendered twice: in the plan's side sheet (`?task=`) and
 * on the full `/tasks/[taskId]` page. Loading goes through
 * `requireTaskAccess`, so both entry points share the one scoped lookup.
 */
export async function loadTaskDetail(user: SessionUser, taskId: string) {
  const task = await requireTaskAccess(user, taskId);
  const comments = await listTaskComments(task.id, true);
  return { task, comments, editable: can(user, "task:update") };
}

export type TaskDetailData = Awaited<ReturnType<typeof loadTaskDetail>>;

function FieldBlock({ label: fieldLabel, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-meta text-muted">{fieldLabel}</p>
      <div className="flex h-8 min-w-0 items-center">{children}</div>
    </div>
  );
}

/** Header actions: edit everything at once (the inline cells cover one field each). */
export function TaskDetailActions({
  data,
  owners,
}: {
  data: TaskDetailData;
  owners: OwnerOption[];
}) {
  const { task } = data;
  if (!data.editable) return null;
  return (
    <EditTaskDialog
      task={{
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        status: task.status,
        assignedToId: task.assignedToId,
        dueDate: task.dueDate?.toISOString().slice(0, 10) ?? "",
      }}
      owners={owners}
    />
  );
}

/** Left column: Responsável / Prazo / Status, then the other fields and the description. */
export function TaskDetailMain({
  data,
  owners,
  locale,
  dict,
}: {
  data: TaskDetailData;
  owners: OwnerOption[];
  locale: Locale;
  dict: Dictionary;
}) {
  const { task, editable } = data;
  const derived = deriveTaskStatus(task.status as TaskStatus, task.dueDate);
  const remaining = daysUntil(task.dueDate);
  const late = derived === "OVERDUE";
  const priority = meta.priority(task.priority, dict);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 border-b border-line pb-5 sm:grid-cols-3">
        <FieldBlock label="Responsável">
          <TaskAssigneeCell
            taskId={task.id}
            assignee={task.assignedTo}
            owners={owners}
            title={task.title}
            readOnly={!editable}
          />
        </FieldBlock>
        <FieldBlock label="Prazo">
          <TaskDueCell
            taskId={task.id}
            value={task.dueDate?.toISOString().slice(0, 10) ?? ""}
            label={
              task.dueDate
                ? `${formatDate(task.dueDate, locale)}${late && remaining !== null ? ` · ${Math.abs(remaining)}d de atraso` : ""}`
                : ""
            }
            late={late}
            title={task.title}
            readOnly={!editable}
            className="text-body"
          />
        </FieldBlock>
        <FieldBlock label="Status">
          <TaskStatusCell
            taskId={task.id}
            status={task.status}
            derived={derived}
            title={task.title}
            readOnly={!editable}
            showLabel
          />
        </FieldBlock>
      </div>

      <PropertyList
        layout="grid"
        className="lg:grid-cols-3"
        items={[
          { label: "Categoria", value: label.taskCategory(task.category, dict) },
          {
            label: "Prioridade",
            value: (
              <span className={cn(FLAGGED_PRIORITY.includes(task.priority) && "text-risk")}>
                {priority.label}
              </span>
            ),
          },
          { label: "Aguardando", value: task.supplier?.name ?? "Equipe interna" },
          {
            label: "Criada por",
            value: `${task.createdBy.name} · ${formatDateTime(task.createdAt, locale)}`,
          },
          {
            label: "Concluída em",
            value: task.completedAt ? formatDateTime(task.completedAt, locale) : null,
          },
        ]}
      />

      <section aria-labelledby={`desc-${task.id}`}>
        <h3 id={`desc-${task.id}`} className="mb-2 text-label font-semibold text-ink-soft">
          Descrição
        </h3>
        {task.description ? (
          <p className="text-body whitespace-pre-wrap text-ink">{task.description}</p>
        ) : (
          <p className="text-body text-faint">Nenhuma descrição informada.</p>
        )}
      </section>
    </div>
  );
}

/** Right column: the task's comments, newest at the bottom, the form under them. */
export function TaskComments({ data, locale }: { data: TaskDetailData; locale: Locale }) {
  const { comments, editable, task } = data;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-5 text-label font-semibold text-ink">
        Comentários
        {comments.length > 0 ? (
          <span className="font-normal text-faint tabular-nums">{comments.length}</span>
        ) : null}
      </h3>
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <MessageSquare className="size-5 text-faint" aria-hidden />
            <p className="mt-2 text-body font-medium text-ink">Nenhum comentário ainda.</p>
            <p className="mt-0.5 text-meta text-muted">Registre decisões e contexto para a equipe.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-2.5 px-5 py-3">
                <UserAvatar name={comment.author.name} size="xs" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-meta">
                    <span className="font-semibold text-ink">{comment.author.name}</span>
                    <span className="text-muted">{formatRelative(comment.createdAt, locale)}</span>
                  </p>
                  <p className="mt-0.5 text-body whitespace-pre-wrap text-ink-soft">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editable ? (
        <div className="shrink-0 border-t border-line bg-surface p-4">
          <TaskCommentForm taskId={task.id} />
        </div>
      ) : null}
    </div>
  );
}

/** The project link above the title. */
export function TaskEyebrow({ data }: { data: TaskDetailData }) {
  return (
    <Link href={`/projects/${data.task.project.id}`} className="hover:underline">
      {data.task.project.name}
    </Link>
  );
}
