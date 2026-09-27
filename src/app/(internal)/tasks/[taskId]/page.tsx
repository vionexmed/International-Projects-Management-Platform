import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireTaskAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { listTaskComments } from "@/server/services/tasks";
import { listInternalUserOptions } from "@/server/services/users";
import { db } from "@/server/db";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/ui/section";
import { Panel, PanelHeader, PropertyList, type PropertyItem } from "@/components/ui/card";
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
import { daysUntil, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  const late = derived === "OVERDUE";
  const remaining = daysUntil(task.dueDate);

  const waiting = task.supplier
    ? task.supplier.name
    : project?.supplier.name
      ? "Equipe interna"
      : undefined;

  const properties: PropertyItem[] = [
    {
      label: "Projeto",
      value: (
        <Link href={`/projects/${task.project.id}`} className="text-brand-strong hover:underline">
          {task.project.name}
        </Link>
      ),
    },
    { label: "Categoria", value: label.taskCategory(task.category, dict) },
    { label: "Responsável", value: task.assignedTo?.name },
    { label: "Aguardando", value: waiting },
    { label: "Prazo", value: formatDate(task.dueDate, locale) },
    {
      label: "Prioridade",
      value: <PriorityBadge tone={priority.tone}>{priority.label}</PriorityBadge>,
    },
    {
      label: "Criada por",
      value: `${task.createdBy.name} · ${formatDateTime(task.createdAt, locale)}`,
    },
    {
      label: "Concluída em",
      value: task.completedAt ? formatDateTime(task.completedAt, locale) : undefined,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Tarefas", href: "/tasks" }]}
        title={task.title}
        status={<SolidBadge tone={status.tone}>{status.label}</SolidBadge>}
        meta={
          task.dueDate ? (
            <span className={cn(late && "font-medium text-risk")}>
              Prazo: {formatDate(task.dueDate, locale)}
              {late && remaining !== null ? ` · ${Math.abs(remaining)}d de atraso` : ""}
            </span>
          ) : undefined
        }
        actions={
          editable ? (
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
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {editable ? (
            <Panel variant="focal">
              <PanelHeader title="Atualizar tarefa" />
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="text-meta text-muted">Status</span>
                  <TaskStatusControl taskId={task.id} status={task.status} />
                </div>
                <TaskCommentForm taskId={task.id} />
              </div>
            </Panel>
          ) : null}

          <Section title="Comentários" count={comments.length}>
            {comments.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Nenhum comentário ainda."
                description="Registre decisões e contexto para a equipe."
                compact
              />
            ) : (
              <ul className="divide-y divide-line-soft rounded-lg border border-line bg-surface">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex gap-3 px-5 py-4">
                    <UserAvatar name={comment.author.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-meta">
                        <span className="font-medium text-ink">{comment.author.name}</span>
                        <span className="text-muted">{formatRelative(comment.createdAt, locale)}</span>
                      </p>
                      <p className="mt-1 text-body whitespace-pre-wrap text-ink-soft">
                        {comment.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <PropertyList layout="stacked" items={properties} />

          <div>
            <p className="mb-2 text-meta text-muted">Descrição</p>
            <div className="rounded-lg bg-raised/70 px-4 py-3">
              {task.description ? (
                <p className="text-body whitespace-pre-wrap text-ink">{task.description}</p>
              ) : (
                <p className="text-body text-muted">Nenhuma descrição informada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
