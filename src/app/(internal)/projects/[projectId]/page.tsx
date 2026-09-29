import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { can, requireInternalUser } from "@/server/auth/current-user";
import { getProjectWorkspace, type ProjectStatus } from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import { STAGE_TASK_CATEGORY } from "@/server/services/project-health";
import { orNotFound } from "@/server/authz/rsc";
import { db } from "@/server/db";
import { ProgressBar, type ProgressTone } from "@/components/ui/progress";
import { StatusIcon } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { EditStageDialog } from "@/features/projects/edit-stage-dialog";
import { NewMilestoneDialog } from "@/features/projects/new-milestone-dialog";
import { DenseEmpty, DenseList, DenseRow, WorkBlock } from "@/features/projects/work-block";
import { stageSegment } from "@/features/projects/stage-routes";
import { STAGE_PERMISSION } from "@/server/authz/permissions";
import { Timeline } from "@/components/app/timeline";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta, type MilestoneProgress, type StageProgress } from "@/lib/labels";
import { isTaskOverdue } from "@/lib/status";
import { daysUntil, formatDate, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A bar is neutral unless it has something to say: done, or held up. */
const STAGE_BAR_TONE: Partial<Record<StageProgress, ProgressTone>> = {
  COMPLETED: "ok",
  BLOCKED: "risk",
};

/**
 * "How is this project right now?" — a KPI strip (derived health, progress,
 * open and late work, next milestone, launch), then the stages and the
 * milestones on the left and the record's properties and recent activity on
 * the right. Health is never picked by hand: it is recalculated from
 * deadlines, blockers and stages on every write, and the card says why.
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

  const [{ project, stages, milestones, progress }, timeline, tasks] = await Promise.all([
    orNotFound(getProjectWorkspace(user, projectId)),
    listProjectTimeline(user, projectId, 5),
    // Counts only, for the KPI strip and the stage rows. The project is verified by the layout and the workspace call.
    db.task.findMany({
      where: { projectId },
      select: { category: true, status: true, priority: true, dueDate: true },
    }),
  ]);

  const now = new Date();
  const open = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
  const overdue = open.filter((task) => isTaskOverdue(task.status, task.dueDate, now));
  const criticalOverdue = overdue.filter((task) => task.priority === "HIGH" || task.priority === "URGENT");
  const blockedStages = stages.filter((stage) => stage.status === "BLOCKED");

  const health = meta.project(project.status as ProjectStatus, dict);
  const healthReason = project.blockerNote
    ? "Há um bloqueio registrado."
    : blockedStages.length > 0
      ? `${blockedStages.length === 1 ? "Uma etapa bloqueada" : `${blockedStages.length} etapas bloqueadas`}.`
      : criticalOverdue.length > 0
        ? `${criticalOverdue.length} ${criticalOverdue.length === 1 ? "tarefa crítica atrasada" : "tarefas críticas atrasadas"}.`
        : overdue.length > 0
          ? `${overdue.length} ${overdue.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"}.`
          : project.status === "ON_TRACK" || project.status === "COMPLETED"
            ? "Nenhum atraso crítico."
            : "Recalculada a cada alteração do projeto.";

  const upcomingMilestones = milestones.filter((milestone) => milestone.status !== "COMPLETED");
  const nextMilestone = upcomingMilestones[0] ?? null;
  const milestoneLate = (milestone: (typeof milestones)[number]) =>
    milestone.status === "DELAYED" || (daysUntil(milestone.dueDate) ?? 0) < 0;

  const base = `/projects/${projectId}`;
  const canAddMilestone =
    can(user, "project:update") || OPTIONS.stageKey.some((key) => can(user, STAGE_PERMISSION[key]));

  const properties = [
    {
      label: "Responsável",
      value: (
        <span className="inline-flex items-center gap-2">
          <UserAvatar name={project.owner.name} size="xs" />
          {project.owner.name}
        </span>
      ),
    },
    {
      label: "Fornecedor",
      value: (
        <Link href={`/suppliers/${project.supplier.id}`} className="text-brand-strong hover:underline">
          {project.supplier.name}
        </Link>
      ),
    },
    { label: "País", value: project.country },
    { label: "Código", value: <span className="font-mono text-meta">{project.projectCode}</span> },
    { label: "Etapa atual", value: label.stageKey(project.currentStage, dict) },
    { label: "Início", value: project.startDate ? formatDate(project.startDate, locale) : null },
    {
      label: "Lançamento previsto",
      value: project.targetLaunchDate ? formatDate(project.targetLaunchDate, locale) : null,
    },
    { label: "Categoria", value: project.category },
    { label: "Tipo de produto", value: project.productType },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

  return (
    <div className="space-y-6">
      {project.blockerNote ? (
        <div role="alert" className="flex items-start gap-3 rounded-sm border border-risk/25 bg-risk-soft px-4 py-3">
          <AlertOctagon className="mt-0.5 size-4 shrink-0 text-risk" aria-hidden />
          <div className="min-w-0">
            <p className="text-title text-risk">Bloqueio atual</p>
            <p className="mt-0.5 text-body text-ink">{project.blockerNote}</p>
          </div>
        </div>
      ) : null}

      <section className="border-b border-line pb-6" aria-label="Resumo do projeto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-meta font-medium text-brand-strong">Progresso geral</p>
            <div className="mt-1 flex items-baseline gap-3">
              <p className="text-kpi text-ink tabular-nums">{progress}%</p>
              <span className="text-body text-muted">{label.stageKey(project.currentStage, dict)} · {health.label}</span>
            </div>
            <p className="mt-1 text-meta text-muted">{healthReason}</p>
          </div>
          <div className="text-meta text-muted sm:text-right">
            <p>{open.length} tarefa{open.length === 1 ? "" : "s"} em aberto{overdue.length ? ` · ${overdue.length} atrasada${overdue.length === 1 ? "" : "s"}` : ""}</p>
            <p className="mt-1">{nextMilestone ? `Próximo marco: ${nextMilestone.title}` : "Nenhum marco pendente"}</p>
          </div>
        </div>
        <ProgressBar value={progress} tone={progress === 100 ? "ok" : "neutral"} label="Progresso geral" className="mt-4" barClassName="h-2" />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <WorkBlock title="Progresso por etapa" action={{ label: "Abrir plano", href: `${base}/tasks` }}>
            <DenseList>
              {stages.map((stage) => {
                const status = meta.stage(stage.status as StageProgress, dict);
                const name = label.stageKey(stage.key, dict);
                const category = STAGE_TASK_CATEGORY[stage.key];
                const stageTasks = tasks.filter((task) => task.category === category && task.status !== "CANCELLED");
                const done = stageTasks.filter((task) => task.status === "COMPLETED").length;
                const current = stage.key === project.currentStage;
                return (
                  /*
                    Fixed tracks so name, bar, number and status line up across
                    the rows. On a phone: name and status, then bar and number.
                  */
                  <li
                    key={stage.id}
                    className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-1 px-4 py-2 sm:grid-cols-[12rem_minmax(0,1fr)_2.75rem_4rem_8rem_2rem] sm:py-1.5"
                  >
                    <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
                      <StatusIcon status={stage.status as StageProgress} label={status.label} />
                      <Link
                        href={`${base}/${stageSegment(stage.key)}`}
                        aria-current={current ? "step" : undefined}
                        className="min-w-0 truncate text-body font-medium text-ink hover:underline"
                      >
                        {name}
                      </Link>
                      {current ? <span className="shrink-0 text-meta text-muted">atual</span> : null}
                    </span>
                    <ProgressBar
                      value={stage.computedProgress}
                      tone={STAGE_BAR_TONE[stage.status as StageProgress]}
                      label={name}
                      barClassName="h-1.5"
                      className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                    />
                    <span className="col-start-3 row-start-2 text-meta font-semibold text-ink tabular-nums sm:col-start-3 sm:row-start-1 sm:text-right">
                      {stage.computedProgress}%
                    </span>
                    <span className="hidden text-meta text-muted tabular-nums sm:col-start-4 sm:row-start-1 sm:block">
                      {done}/{stageTasks.length}
                    </span>
                    <span className="col-start-2 row-start-1 min-w-0 truncate text-meta text-muted sm:col-start-5">
                      {status.label}
                    </span>
                    <span className="col-start-3 row-start-1 flex justify-end sm:col-start-6">
                      {can(user, STAGE_PERMISSION[stage.key]) ? (
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
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </DenseList>
          </WorkBlock>

          <WorkBlock
            title="Próximos marcos"
            count={upcomingMilestones.length || undefined}
            action={
              /*
                A stage owner adds milestones to their own stage; the general
                project capability covers the ones that span the project. The
                action re-checks both — this only decides whether to offer it.
              */
              canAddMilestone ? <NewMilestoneDialog projectId={project.id} /> : null
            }
          >
            {upcomingMilestones.length === 0 ? (
              <DenseEmpty>Nenhum marco pendente.</DenseEmpty>
            ) : (
              <DenseList>
                {upcomingMilestones.map((milestone) => {
                  const status = meta.milestone(milestone.status as MilestoneProgress, dict);
                  const late = milestoneLate(milestone);
                  return (
                    <DenseRow
                      key={milestone.id}
                      leading={<StatusIcon kind="milestone" tone={late ? "risk" : undefined} />}
                      title={milestone.title}
                      meta={milestone.stage ? label.stageKey(milestone.stage, dict) : null}
                      trailing={
                        <>
                          <span className="hidden sm:inline">{status.label}</span>
                          <span className={cn("w-16 text-right tabular-nums", late ? "font-medium text-risk" : "text-ink-soft")}>
                            {milestone.dueDate ? formatDateShort(milestone.dueDate, locale) : ""}
                          </span>
                        </>
                      }
                    />
                  );
                })}
              </DenseList>
            )}
          </WorkBlock>
        </div>

        <div className="min-w-0 space-y-6">
          <WorkBlock title="Propriedades">
            <dl className="divide-y divide-line-faint">
              {properties.map((item) => (
                <div key={item.label} className="grid min-h-10 grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 px-4 py-1.5">
                  <dt className="text-meta text-muted">{item.label}</dt>
                  <dd className="min-w-0 truncate text-body text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            {project.description ? (
              <p className="border-t border-line-faint px-4 py-3 text-body whitespace-pre-wrap text-ink-soft">
                {project.description}
              </p>
            ) : null}
          </WorkBlock>

          <WorkBlock title="Atividade recente" action={{ label: "Histórico completo", href: `${base}/timeline` }}>
            <div className="px-4 py-4">
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
          </WorkBlock>
        </div>
      </div>
    </div>
  );
}
