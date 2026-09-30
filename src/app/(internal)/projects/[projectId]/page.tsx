import Link from "next/link";
import { AlertOctagon, ArrowUpRight } from "lucide-react";
import { can, requireInternalUser } from "@/server/auth/current-user";
import { getProjectWorkspace } from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { db } from "@/server/db";
import { StatusIcon } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { EditStageDialog } from "@/features/projects/edit-stage-dialog";
import { NewMilestoneDialog } from "@/features/projects/new-milestone-dialog";
import { stageSegment } from "@/features/projects/stage-routes";
import { STAGE_TASK_CATEGORY } from "@/server/services/project-health";
import { STAGE_PERMISSION } from "@/server/authz/permissions";
import { Timeline } from "@/components/app/timeline";
import { CardSection as Card, CardLink } from "@/components/app/card-section";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta, type MilestoneProgress, type StageProgress } from "@/lib/labels";
import { isTaskOverdue } from "@/lib/status";
import { daysUntil, formatDate, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The fill of a stage on the track: done is green, held up is red, the current one is the brand. */
function stageFill(status: StageProgress, current: boolean) {
  if (status === "COMPLETED") return "bg-ok-dot";
  if (status === "BLOCKED") return "bg-risk-dot";
  return current ? "bg-brand" : "bg-line-strong";
}

/** "em 12 dias", "hoje", "3 dias atrasada" — how far a date is, in words. */
function distance(date: Date | null, lateWord: string) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days === 0) return { text: "hoje", late: false };
  if (days < 0) return { text: `${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"} ${lateWord}`, late: true };
  return { text: `em ${days} ${days === 1 ? "dia" : "dias"}`, late: false };
}

/**
 * The project at a glance: where it stands (progress, next milestone,
 * launch and the four stages), then — each in its own space — the work
 * coming due, what happened lately, the supplier, the milestones and the
 * project's details.
 */
export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [{ project, stages, milestones, progress }, timeline, tasks, documentCount, owedCount] = await Promise.all([
    orNotFound(getProjectWorkspace(user, projectId)),
    listProjectTimeline(user, projectId, 5),
    // The project is verified by the layout and the workspace call.
    db.task.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        dueDate: true,
        assignedTo: { select: { name: true } },
      },
    }),
    db.document.count({ where: { projectId } }),
    db.documentRequest.count({ where: { projectId, status: { in: ["PENDING", "REJECTED"] } } }),
  ]);

  const now = new Date();
  const open = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
  const overdue = open.filter((task) => isTaskOverdue(task.status, task.dueDate, now));
  // Dated work first, soonest (or most late) on top; undated work after it.
  const comingUp = [...open]
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .slice(0, 6);

  const upcomingMilestones = milestones.filter((milestone) => milestone.status !== "COMPLETED");
  const nextMilestone = upcomingMilestones[0] ?? null;
  const milestoneLate = (milestone: (typeof milestones)[number]) =>
    milestone.status === "DELAYED" || (daysUntil(milestone.dueDate) ?? 0) < 0;
  const launch = distance(project.targetLaunchDate, "de atraso");

  const base = `/projects/${projectId}`;
  const canAddMilestone =
    can(user, "project:update") || OPTIONS.stageKey.some((key) => can(user, STAGE_PERMISSION[key]));

  // Supplier, country and code already sit in the header above.
  const details = [
    {
      label: "Responsável",
      value: (
        <span className="inline-flex items-center gap-2">
          <UserAvatar name={project.owner.name} size="xs" />
          {project.owner.name}
        </span>
      ),
    },
    { label: "Início", value: project.startDate ? formatDate(project.startDate, locale) : null },
    { label: "Categoria", value: project.category },
    { label: "Tipo de produto", value: project.productType },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-4">
      {project.blockerNote ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-risk/20 bg-risk-soft px-5 py-4">
          <AlertOctagon className="mt-0.5 size-4 shrink-0 text-risk" aria-hidden />
          <div className="min-w-0">
            <p className="text-title text-risk">Bloqueio atual</p>
            <p className="mt-0.5 text-body text-ink">{project.blockerNote}</p>
          </div>
        </div>
      ) : null}

      {/* Where the project stands. */}
      <section aria-label="Andamento do projeto" className="rounded-2xl border border-line-soft bg-subtle px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
          <div>
            <p className="text-meta font-medium text-muted">Progresso geral</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[40px] leading-none font-semibold tracking-tight text-ink tabular-nums">{progress}%</span>
              <span className="text-body text-muted">concluído</span>
            </p>
            <p className="mt-3 text-body text-ink-soft">
              {open.length} {open.length === 1 ? "tarefa em aberto" : "tarefas em aberto"}
              {overdue.length > 0 ? (
                <span className="font-medium text-risk">
                  {" · "}
                  {overdue.length} {overdue.length === 1 ? "atrasada" : "atrasadas"}
                </span>
              ) : null}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-10 gap-y-5">
            <div className="min-w-0">
              <dt className="text-meta font-medium text-muted">Próximo marco</dt>
              <dd className="mt-2 max-w-56 truncate text-title text-ink">{nextMilestone ? nextMilestone.title : "Nenhum pendente"}</dd>
              {nextMilestone?.dueDate ? (
                <dd className={cn("mt-0.5 text-meta", milestoneLate(nextMilestone) ? "font-medium text-risk" : "text-muted")}>
                  {formatDate(nextMilestone.dueDate, locale)}
                </dd>
              ) : null}
            </div>
            <div className="min-w-0 sm:border-l sm:border-line sm:pl-10">
              <dt className="text-meta font-medium text-muted">Lançamento previsto</dt>
              <dd className="mt-2 text-title text-ink">
                {project.targetLaunchDate ? formatDate(project.targetLaunchDate, locale) : "Sem data"}
              </dd>
              {launch ? (
                <dd className={cn("mt-0.5 text-meta", launch.late ? "font-medium text-risk" : "text-muted")}>{launch.text}</dd>
              ) : null}
            </div>
          </dl>
        </div>

        {/* The four stages as one track. */}
        <ol className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 xl:grid-cols-4 xl:gap-x-3">
          {stages.map((stage) => {
            const stageStatus = stage.status as StageProgress;
            const status = meta.stage(stageStatus, dict);
            const name = label.stageKey(stage.key, dict);
            const current = stage.key === project.currentStage;
            const category = STAGE_TASK_CATEGORY[stage.key];
            const stageTasks = tasks.filter((task) => task.category === category && task.status !== "CANCELLED");
            const done = stageTasks.filter((task) => task.status === "COMPLETED").length;
            return (
              <li key={stage.id} className="group relative min-w-0">
                <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className={cn("h-full rounded-full", stageFill(stageStatus, current))}
                    style={{ width: `${Math.max(0, Math.min(100, stage.computedProgress))}%` }}
                  />
                </div>
                <div className="mt-3 flex min-w-0 items-center gap-2">
                  <Link
                    href={`${base}/${stageSegment(stage.key)}`}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "min-w-0 truncate text-body after:absolute after:inset-0 hover:underline",
                      current ? "font-semibold text-ink" : "font-medium text-ink-soft",
                    )}
                  >
                    {name}
                  </Link>
                  <span className="ml-auto shrink-0 text-meta text-muted tabular-nums">{stage.computedProgress}%</span>
                </div>
                <div className="mt-0.5 flex min-h-6 items-center gap-2">
                  <span className="truncate text-meta text-muted">
                    {current ? <span className="font-medium text-brand-strong">Etapa atual</span> : status.label}
                    {stageTasks.length > 0 ? ` · ${done}/${stageTasks.length} tarefas` : ""}
                  </span>
                  {can(user, STAGE_PERMISSION[stage.key]) ? (
                    <span className="relative z-10 -my-1 ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                      <EditStageDialog
                        stage={{
                          id: stage.id,
                          projectId: project.id,
                          name,
                          status: stage.status,
                          progress: stage.progress,
                          notes: stage.notes,
                        }}
                      />
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <Card title="Próximas tarefas" count={open.length} action={<CardLink href={`${base}/tasks`}>Abrir plano</CardLink>}>
            {comingUp.length === 0 ? (
              <p className="px-6 pb-6 text-body text-muted">Nenhuma tarefa em aberto.</p>
            ) : (
              <ul className="pb-2">
                {comingUp.map((task) => {
                  const late = isTaskOverdue(task.status, task.dueDate, now);
                  const due = distance(task.dueDate, "de atraso");
                  return (
                    <li key={task.id} className="relative flex items-center gap-4 border-t border-line-faint px-6 py-3.5 transition-colors hover:bg-subtle">
                      <StatusIcon status={late ? "OVERDUE" : (task.status as StageProgress)} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="block truncate text-body font-medium text-ink after:absolute after:inset-0"
                        >
                          {task.title}
                        </Link>
                        <p className="mt-0.5 truncate text-meta text-muted">
                          {label.taskCategory(task.category, dict)}
                          {task.assignedTo ? ` · ${task.assignedTo.name}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-meta tabular-nums">
                        <p className="text-ink-soft">{task.dueDate ? formatDateShort(task.dueDate, locale) : "Sem prazo"}</p>
                        {due ? <p className={cn("mt-0.5", late ? "font-medium text-risk" : "text-muted")}>{due.text}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Atividade recente" action={<CardLink href={`${base}/timeline`}>Histórico completo</CardLink>}>
            <div className="px-6 pt-1 pb-6">
              <Timeline
                locale={locale}
                emptyTitle="Nenhuma atividade ainda."
                items={timeline.map((event) => ({
                  id: event.id,
                  description: event.description,
                  createdAt: event.createdAt,
                  actorName: event.actor?.name ?? null,
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-8">
          <Card
            title="Fornecedor"
            action={
              <CardLink href={`/regulatory?supplier=${project.supplier.id}&project=${project.id}`}>
                Ver pasta
                <ArrowUpRight className="size-3.5" aria-hidden />
              </CardLink>
            }
          >
            <div className="px-6 pb-6">
              <Link href={`/suppliers/${project.supplier.id}`} className="text-section text-ink hover:underline">
                {project.supplier.name}
              </Link>
              <p className="mt-0.5 text-meta text-muted">{project.supplier.country}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-subtle px-4 py-3">
                  <dt className="text-meta text-muted">Documentos</dt>
                  <dd className="mt-1 text-section text-ink tabular-nums">{documentCount}</dd>
                </div>
                <div className={cn("rounded-lg px-4 py-3", owedCount > 0 ? "bg-warn-soft" : "bg-subtle")}>
                  <dt className={cn("text-meta", owedCount > 0 ? "text-warn" : "text-muted")}>Pendentes</dt>
                  <dd className={cn("mt-1 text-section tabular-nums", owedCount > 0 ? "text-warn" : "text-ink")}>{owedCount}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card
            title="Marcos"
            count={upcomingMilestones.length}
            action={canAddMilestone ? <NewMilestoneDialog projectId={project.id} /> : null}
          >
            {upcomingMilestones.length === 0 ? (
              <p className="px-6 pb-6 text-body text-muted">Nenhum marco pendente.</p>
            ) : (
              <ol className="px-6 pt-1 pb-6">
                {upcomingMilestones.map((milestone, index) => {
                  const status = meta.milestone(milestone.status as MilestoneProgress, dict);
                  const late = milestoneLate(milestone);
                  return (
                    <li key={milestone.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < upcomingMilestones.length - 1 ? (
                        <span className="absolute top-6 bottom-1 left-[7.5px] w-px bg-line" aria-hidden />
                      ) : null}
                      <StatusIcon kind="milestone" tone={late ? "risk" : undefined} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-ink">{milestone.title}</p>
                        <p className="mt-0.5 truncate text-meta text-muted">
                          {milestone.stage ? `${label.stageKey(milestone.stage, dict)} · ` : ""}
                          {status.label}
                        </p>
                      </div>
                      <span className={cn("shrink-0 text-meta tabular-nums", late ? "font-medium text-risk" : "text-ink-soft")}>
                        {milestone.dueDate ? formatDateShort(milestone.dueDate, locale) : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card title="Detalhes">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 px-6 pt-1 pb-6">
              {details.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-meta text-muted">{item.label}</dt>
                  <dd className="mt-1 truncate text-body text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            {project.description ? (
              <p className="mx-6 border-t border-line-faint py-5 text-body whitespace-pre-wrap text-ink-soft">
                {project.description}
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
