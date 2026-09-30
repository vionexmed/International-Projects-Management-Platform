import "server-only";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Download, FileText, Maximize2, MessageSquare, Paperclip } from "lucide-react";
import { can } from "@/server/auth/current-user";
import { requireTaskAccess } from "@/server/authz/access";
import { documentRequestScope } from "@/server/authz/scopes";
import { db } from "@/server/db";
import { listTaskComments } from "@/server/services/tasks";
import { UserAvatar } from "@/components/ui/avatar";
import { SheetBody, SheetHeader } from "@/components/ui/dialog";
import { TaskAssigneeCell, TaskDueCell, TaskStatusCell, type OwnerOption } from "@/features/tasks/task-cells";
import { TaskCommentForm } from "@/features/tasks/task-comment-form";
import { EditTaskDialog } from "@/features/tasks/edit-task-dialog";
import { TaskSheet } from "@/features/tasks/task-sheet";
import { deriveTaskStatus } from "@/lib/status";
import { daysUntil, formatDate, formatDateTime, formatFileSize, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label } from "@/lib/labels";
import type { TaskStatus } from "@/server/services/tasks";
import type { SessionUser } from "@/types/auth";
import { cn } from "@/lib/utils";

/**
 * One task's record, shown in a centred window (from the plan, and from any
 * list through the intercepted `/tasks/[taskId]` route) and on the full page.
 * Loading goes through `requireTaskAccess` and the request scope, so every
 * entry point shares the same scoped lookups.
 */
export async function loadTaskDetail(user: SessionUser, taskId: string) {
  const task = await requireTaskAccess(user, taskId);
  const [comments, requests] = await Promise.all([
    listTaskComments(task.id, true),
    // The document requests this task mirrors: what was asked, what came back.
    db.documentRequest.findMany({
      where: { AND: [documentRequestScope(user), { taskId: task.id }] },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNote: true,
        supplier: { select: { name: true } },
        document: {
          select: { currentVersion: { select: { id: true, fileName: true, version: true, fileSize: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { task, comments, requests, editable: can(user, "task:update") };
}

export type TaskDetailData = Awaited<ReturnType<typeof loadTaskDetail>>;
type RequestRow = TaskDetailData["requests"][number];

const PRIORITY_TAG: Record<string, { label: string; tone: string }> = {
  LOW: { label: "Baixa", tone: "bg-raised text-muted" },
  MEDIUM: { label: "Média", tone: "bg-info-soft text-info" },
  HIGH: { label: "Alta", tone: "bg-warn-soft text-warn" },
  URGENT: { label: "Urgente", tone: "bg-risk-soft text-risk" },
};

const STEPS = ["Solicitado", "Enviado", "Em análise", "Aprovado"];
const STEP_OF: Record<string, number> = { PENDING: 0, REJECTED: 0, SUBMITTED: 1, IN_REVIEW: 2, APPROVED: 3, CANCELLED: -1 };

/** In words: where the request stands and who has the next move. */
function requestHeadline(request: RequestRow, locale: Locale): { text: string; tone: string } {
  const supplier = request.supplier.name;
  switch (request.status) {
    case "PENDING":
      return { text: `Aguardando o envio de ${supplier}.`, tone: "text-warn" };
    case "REJECTED":
      return { text: `Correção pedida — aguardando novo envio de ${supplier}.`, tone: "text-risk" };
    case "SUBMITTED":
      return { text: `${supplier} enviou${request.submittedAt ? ` em ${formatDate(request.submittedAt, locale)}` : ""}. Falta a análise da Vionex.`, tone: "text-info" };
    case "IN_REVIEW":
      return { text: "Em análise pela equipe Vionex.", tone: "text-info" };
    case "APPROVED":
      return { text: `Aprovado${request.reviewedAt ? ` em ${formatDate(request.reviewedAt, locale)}` : ""}. Nada pendente.`, tone: "text-ok" };
    default:
      return { text: "Solicitação cancelada.", tone: "text-muted" };
  }
}

function Field({ label: fieldLabel, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-meta text-muted">{fieldLabel}</p>
      <div className="flex min-h-8 min-w-0 items-center text-body text-ink">{children}</div>
    </div>
  );
}

/** The document this task is about: the request, its progress, the file and the next step. */
function RequestCard({ request, projectId, locale }: { request: RequestRow; projectId: string; locale: Locale }) {
  const step = STEP_OF[request.status] ?? 0;
  const headline = requestHeadline(request, locale);
  const file = request.document?.currentVersion ?? null;
  const toReview = request.status === "SUBMITTED" || request.status === "IN_REVIEW";
  const remaining = daysUntil(request.dueDate);
  const owed = request.status === "PENDING" || request.status === "REJECTED";

  return (
    <section className="overflow-hidden rounded-xl border border-line-soft">
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
          <FileText className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-meta text-muted">Documento solicitado a {request.supplier.name}</p>
          <p className="mt-0.5 text-title text-ink">{request.title}</p>
          <p className={cn("mt-1 text-body font-medium", headline.tone)}>{headline.text}</p>
          {owed && request.dueDate ? (
            <p className={cn("mt-0.5 text-meta", remaining !== null && remaining < 0 ? "font-medium text-risk" : "text-muted")}>
              Prazo {formatDate(request.dueDate, locale)}
              {remaining !== null ? (remaining < 0 ? ` · ${Math.abs(remaining)} dias de atraso` : remaining === 0 ? " · hoje" : ` · em ${remaining} dias`) : ""}
            </p>
          ) : null}
        </div>
      </div>

      {step >= 0 ? (
        <ol className="grid grid-cols-4 gap-2 border-t border-line-faint px-4 py-3" aria-label="Andamento do documento">
          {STEPS.map((name, index) => (
            <li key={name} className="min-w-0" aria-current={index === step ? "step" : undefined}>
              <span
                className={cn(
                  "block h-1 rounded-full",
                  index < step || (index === step && request.status === "APPROVED")
                    ? "bg-ok-dot"
                    : index === step
                      ? request.status === "REJECTED" ? "bg-risk-dot" : "bg-brand"
                      : "bg-line-soft",
                )}
              />
              <span className={cn("mt-1.5 block truncate text-meta", index <= step ? "font-medium text-ink-soft" : "text-faint")}>
                {name}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {request.status === "REJECTED" && request.reviewNote ? (
        <p className="border-t border-line-faint bg-risk-soft/60 px-4 py-3 text-body text-ink">
          <span className="font-medium text-risk">O que corrigir: </span>
          {request.reviewNote}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-faint bg-subtle px-4 py-3">
        {file ? (
          <a
            href={`/api/files/${file.id}`}
            className="inline-flex min-w-0 items-center gap-2 text-body text-ink-soft hover:text-ink"
            aria-label={`Baixar ${file.fileName}`}
          >
            <Paperclip className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{file.fileName}</span>
            <span className="shrink-0 text-meta text-muted">v{file.version} · {formatFileSize(file.fileSize)}</span>
            <Download className="size-3.5 shrink-0 text-brand-strong" aria-hidden />
          </a>
        ) : (
          <span className="text-body text-muted">Nenhum arquivo recebido ainda.</span>
        )}
        <Link
          href={`/projects/${projectId}/regulatory`}
          className="ml-auto inline-flex items-center gap-1 text-label font-medium text-brand-strong hover:underline"
        >
          {toReview ? "Analisar documento" : "Ver solicitação"}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/** A short notice when the task's state needs saying: late, waiting on the supplier, done. */
function Situation({ data, locale }: { data: TaskDetailData; locale: Locale }) {
  const { task } = data;
  const derived = deriveTaskStatus(task.status as TaskStatus, task.dueDate);
  const remaining = daysUntil(task.dueDate);
  const base = "flex items-start gap-3 rounded-xl px-4 py-3 text-body";

  // A document request tells its own story in the card below; only lateness is added.
  const told = data.requests.length > 0;

  if (task.status === "COMPLETED" && !told) {
    return (
      <p className={cn(base, "bg-ok-soft text-ok")}>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>Concluída{task.completedAt ? ` em ${formatDate(task.completedAt, locale)}` : ""}.</span>
      </p>
    );
  }
  if (derived === "OVERDUE") {
    return (
      <p className={cn(base, "bg-risk-soft text-risk")}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Atrasada{remaining !== null ? ` há ${Math.abs(remaining)} ${Math.abs(remaining) === 1 ? "dia" : "dias"}` : ""}.
          {task.assignedTo ? ` Responsável: ${task.assignedTo.name}.` : " Sem responsável definido."}
        </span>
      </p>
    );
  }
  if (task.supplier && !told) {
    return (
      <p className={cn(base, "bg-warn-soft text-warn")}>
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>Aguardando {task.supplier.name}: esta tarefa depende de uma resposta do fornecedor.</span>
      </p>
    );
  }
  return null;
}

/** The record: what it asks for, then its fields, the description and who created it. */
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
  const { task, editable, requests } = data;
  const derived = deriveTaskStatus(task.status as TaskStatus, task.dueDate);
  const late = derived === "OVERDUE";
  const priority = PRIORITY_TAG[task.priority] ?? PRIORITY_TAG.MEDIUM;

  return (
    <div className="space-y-6">
      <Situation data={data} locale={locale} />
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} projectId={task.project.id} locale={locale} />
      ))}

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line-soft px-5 py-4 sm:grid-cols-3">
        <Field label="Status">
          <TaskStatusCell taskId={task.id} status={task.status} derived={derived} title={task.title} readOnly={!editable} showLabel />
        </Field>
        <Field label="Responsável">
          <TaskAssigneeCell taskId={task.id} assignee={task.assignedTo} owners={owners} title={task.title} readOnly={!editable} />
        </Field>
        <Field label="Prazo">
          <TaskDueCell
            taskId={task.id}
            value={task.dueDate?.toISOString().slice(0, 10) ?? ""}
            label={task.dueDate ? formatDate(task.dueDate, locale) : ""}
            late={late}
            title={task.title}
            readOnly={!editable}
            className="text-body"
          />
        </Field>
        <Field label="Prioridade">
          <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-meta font-medium", priority.tone)}>{priority.label}</span>
        </Field>
        <Field label="Etapa">{label.taskCategory(task.category, dict)}</Field>
        <Field label="Com quem está">{task.supplier ? task.supplier.name : "Equipe interna"}</Field>
      </div>

      <section aria-labelledby={`desc-${task.id}`}>
        <h3 id={`desc-${task.id}`} className="mb-2 text-label font-semibold text-ink">
          Descrição
        </h3>
        {task.description ? (
          <p className="text-body whitespace-pre-wrap text-ink-soft">{task.description}</p>
        ) : (
          <p className="text-body text-faint">Sem descrição. Use “Editar” para explicar o que precisa ser feito.</p>
        )}
      </section>

      <p className="flex items-center gap-2 border-t border-line-faint pt-4 text-meta text-muted">
        <UserAvatar name={task.createdBy.name} size="xs" />
        Criada por {task.createdBy.name} em {formatDateTime(task.createdAt, locale)}
      </p>
    </div>
  );
}

/** Header action: edit everything at once (the fields above cover one each). */
export function TaskDetailActions({ data, owners }: { data: TaskDetailData; owners: OwnerOption[] }) {
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

/** Right column: the task's comments, newest at the bottom, the form under them. */
export function TaskComments({ data, locale }: { data: TaskDetailData; locale: Locale }) {
  const { comments, editable, task } = data;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5 text-label font-semibold text-ink">
        Comentários
        {comments.length > 0 ? <span className="font-normal text-faint tabular-nums">{comments.length}</span> : null}
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

/** Project and stage above the title, each a way out to its page. */
export function TaskEyebrow({ data, dict }: { data: TaskDetailData; dict: Dictionary }) {
  const { task } = data;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-label">
      <Link href={`/projects/${task.project.id}`} className="text-brand-strong hover:underline">
        {task.project.name}
      </Link>
      <span className="text-faint">·</span>
      <span className="text-muted">{label.taskCategory(task.category, dict)}</span>
    </span>
  );
}

/**
 * The task as a centred window. `closeHref` is the plan's URL without
 * `?task=`; without it the window closes by stepping back (intercepted route).
 */
export function TaskWindow({
  data,
  owners,
  locale,
  dict,
  closeHref,
}: {
  data: TaskDetailData;
  owners: OwnerOption[];
  locale: Locale;
  dict: Dictionary;
  closeHref?: string;
}) {
  return (
    <TaskSheet
      closeHref={closeHref}
      openPath={closeHref ? undefined : `/tasks/${data.task.id}`}
      aside={<TaskComments data={data} locale={locale} />}
    >
      <SheetHeader
        eyebrow={<TaskEyebrow data={data} dict={dict} />}
        title={data.task.title}
        actions={
          <>
            <TaskDetailActions data={data} owners={owners} />
            {/* A plain link: a full load shows the page instead of reopening this window. */}
            <a
              href={`/tasks/${data.task.id}`}
              title="Abrir em página inteira"
              aria-label="Abrir em página inteira"
              className="inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Maximize2 className="size-4" aria-hidden />
            </a>
          </>
        }
      />
      <SheetBody>
        <TaskDetailMain data={data} owners={owners} locale={locale} dict={dict} />
      </SheetBody>
    </TaskSheet>
  );
}
