import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireTaskAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { listTaskComments } from "@/server/services/tasks";
import { listInternalUserOptions } from "@/server/services/users";
import { db } from "@/server/db";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
import { PriorityBadge, SolidBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/avatar";
import { TaskStatusControl } from "@/features/tasks/task-status-control";
import { EditTaskDialog } from "@/features/tasks/edit-task-dialog";
import { TaskCommentForm } from "@/features/tasks/task-comment-form";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { deriveTaskStatus } from "@/lib/status";
import { label, meta } from "@/lib/labels";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { TaskStatus } from "@/server/services/tasks";

export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  try {
    const user = await requireInternalUser();
    const task = await requireTaskAccess(user, taskId);
    return { title: task.title };
  } catch {
    return { title: "Tarefa" };
  }
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const user = await requireInternalUser();

  const task = await orNotFound(requireTaskAccess(user, taskId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [comments, owners, project] = await Promise.all([
    listTaskComments(task.id, true),
    listInternalUserOptions(user),
    db.project.findUnique({
      where: { id: task.projectId },
      select: { supplier: { select: { name: true } } },
    }),
  ]);

  const derived = deriveTaskStatus(task.status as TaskStatus, task.dueDate);
  const status = meta.task(derived, dict);
  const priority = meta.priority(task.priority, dict);
  const editable = can(user, "task:update");

  return (
    <>
      <Link
        href="/tasks"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Tarefas
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] text-ink">
              {task.title}
            </h1>
            <SolidBadge tone={status.tone}>{status.label}</SolidBadge>
          </div>
          <p className="mt-1.5 text-[14px] text-muted">
            <Link href={`/projects/${task.project.id}`} className="hover:text-brand-strong hover:underline">
              {task.project.name}
            </Link>{" "}
            · {task.project.projectCode} · {label.taskCategory(task.category, dict)}
          </p>
        </div>

        {editable ? (
          <div className="flex shrink-0 items-center gap-2">
            <TaskStatusControl taskId={task.id} status={task.status} />
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
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel>
            <PanelHeader title="Descrição" />
            <div className="p-5">
              {task.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
                  {task.description}
                </p>
              ) : (
                <p className="text-[13px] text-muted">Nenhuma descrição informada.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Comentários"
              description="Visíveis apenas para a equipe Vionex."
            />

            {comments.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Nenhum comentário ainda."
                description="Registre decisões e contexto para a equipe."
                compact
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex gap-3 px-5 py-4">
                    <UserAvatar name={comment.author.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                        <span className="font-medium text-ink">{comment.author.name}</span>
                        <span className="text-muted">{formatRelative(comment.createdAt, locale)}</span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                        {comment.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {editable ? (
              <div className="border-t border-line p-5">
                <TaskCommentForm taskId={task.id} />
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Detalhes" />
            <dl className="space-y-5 p-5">
              <Field label="Projeto">
                <Link
                  href={`/projects/${task.project.id}`}
                  className="text-brand-strong hover:underline"
                >
                  {task.project.name}
                </Link>
              </Field>
              <Field label="Categoria">{label.taskCategory(task.category, dict)}</Field>
              <Field label="Responsável">{task.assignedTo?.name ?? "—"}</Field>
              <Field label="Aguardando">
                {task.supplier?.name ?? project?.supplier.name ? (
                  task.supplier ? (
                    <span>{task.supplier.name}</span>
                  ) : (
                    <span className="text-muted">Equipe interna</span>
                  )
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Prazo">{formatDate(task.dueDate, locale)}</Field>
              <Field label="Prioridade">
                <PriorityBadge tone={priority.tone}>{priority.label}</PriorityBadge>
              </Field>
              <Field label="Criada por">
                {task.createdBy.name} · {formatDateTime(task.createdAt, locale)}
              </Field>
              {task.completedAt ? (
                <Field label="Concluída em">{formatDateTime(task.completedAt, locale)}</Field>
              ) : null}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
