import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { can, requireInternalUser } from "@/server/auth/current-user";
import { getProjectWorkspace } from "@/server/services/projects";
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

/** One fact of the strip under the stages: a label, the value, and a short note. */
function Fact({ label, value, note, noteClass }: { label: string; value: React.ReactNode; note?: React.ReactNode; noteClass?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-title text-ink">{value}</dd>
      {note ? <dd className={cn("mt-0.5 truncate text-meta text-muted", noteClass)}>{note}</dd> : null}
    </div>
  );
}

/**
 * "Where is this project, and what comes next?" — the four stages as one
 * journey, three facts (open work, next milestone, launch), then the work
 * coming due and the milestones on the left, details and activity on the right.
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
  const launchIn = daysUntil(project.targetLaunchDate);

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
    <div className="space-y-6">
      {project.blockerNote ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-risk/25 bg-risk-soft px-4 py-3">
          <AlertOctagon className="mt-0.5 size-4 shrink-0 text-risk" aria-hidden />
          <div className="min-w-0">
            <p className="text-title text-risk">Bloqueio atual</p>
            <p className="mt-0.5 text-body text-ink">{project.blockerNote}</p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="journey-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <h2 id="journey-title" className="text-section text-ink">Etapas do projeto</h2>
            <p className="text-meta text-muted">Etapa atual: {label.stageKey(project.currentStage, dict)}</p>
          </div>
          <p className="text-meta text-muted">
            <span className="text-kpi-sm text-ink tabular-nums">{progress}%</span> concluído
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage, index) => {
            const status = meta.stage(stage.status as StageProgress, dict);
            const name = label.stageKey(stage.key, dict);
            const category = STAGE_TASK_CATEGORY[stage.key];
            const stageTasks = tasks.filter((task) => task.category === category && task.status !== "CANCELLED");
            const done = stageTasks.filter((task) => task.status === "COMPLETED").length;
            const current = stage.key === project.currentStage;
            return (
              <li
                key={stage.id}
                className={cn(
                  "relative flex min-w-0 flex-col gap-2.5 rounded-md border px-4 py-3 transition-colors",
                  current ? "border-brand-line bg-brand-soft/50" : "border-line-soft bg-surface hover:border-line",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StatusIcon status={stage.status as StageProgress} label={status.label} />
                  <Link
                    href={`${base}/${stageSegment(stage.key)}`}
                    aria-current={current ? "step" : undefined}
                    className="min-w-0 truncate text-body font-semibold text-ink after:absolute after:inset-0 hover:underline"
                  >
                    <span className="mr-1 text-faint tabular-nums">{index + 1}.</span>
                    {name}
                  </Link>
                  {current ? (
                    <span className="shrink-0 rounded-full bg-brand px-1.5 py-px text-[11px] font-semibold text-on-brand">Atual</span>
                  ) : null}
                  {can(user, STAGE_PERMISSION[stage.key]) ? (
                    <span className="relative z-10 -my-1 -mr-2 ml-auto">
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
                <ProgressBar
                  value={stage.computedProgress}
                  tone={STAGE_BAR_TONE[stage.status as StageProgress]}
                  label={name}
                  barClassName="h-1.5"
                />
                <p className="flex items-center justify-between gap-2 text-meta text-muted">
                  <span className="truncate">{status.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {stage.computedProgress}% · {done}/{stageTasks.length} tarefas
                  </span>
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <dl className="grid grid-cols-1 divide-y divide-line-soft rounded-md border border-line-soft bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Fact
          label="Tarefas em aberto"
          value={open.length}
          note={overdue.length > 0 ? `${overdue.length} atrasada${overdue.length === 1 ? "" : "s"}` : "Nenhuma atrasada"}
          noteClass={overdue.length > 0 ? "font-medium text-risk" : undefined}
        />
        <Fact
          label="Próximo marco"
          value={nextMilestone ? nextMilestone.title : "Nenhum pendente"}
          note={nextMilestone?.dueDate ? formatDate(nextMilestone.dueDate, locale) : undefined}
          noteClass={nextMilestone && milestoneLate(nextMilestone) ? "font-medium text-risk" : undefined}
        />
        <Fact
          label="Lançamento previsto"
          value={project.targetLaunchDate ? formatDate(project.targetLaunchDate, locale) : "Sem data"}
          note={launchIn !== null && launchIn >= 0 ? `em ${launchIn} dias` : undefined}
        />
      </dl>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <WorkBlock title="Próximas tarefas" count={open.length || undefined} action={{ label: "Abrir plano", href: `${base}/tasks` }}>
            {comingUp.length === 0 ? (
              <DenseEmpty>Nenhuma tarefa em aberto.</DenseEmpty>
            ) : (
              <DenseList>
                {comingUp.map((task) => {
                  const late = isTaskOverdue(task.status, task.dueDate, now);
                  return (
                    <DenseRow
                      key={task.id}
                      href={`${base}/tasks?task=${task.id}`}
                      leading={<StatusIcon status={late ? "OVERDUE" : (task.status as StageProgress)} />}
                      title={task.title}
                      meta={label.taskCategory(task.category, dict)}
                      trailing={
                        <>
                          {task.assignedTo ? (
                            <span className="hidden items-center gap-1.5 md:inline-flex">
                              <UserAvatar name={task.assignedTo.name} size="xs" />
                              {task.assignedTo.name}
                            </span>
                          ) : null}
                          <span className={cn("w-16 text-right tabular-nums", late ? "font-medium text-risk" : "text-ink-soft")}>
                            {task.dueDate ? formatDateShort(task.dueDate, locale) : ""}
                          </span>
                        </>
                      }
                    />
                  );
                })}
              </DenseList>
            )}
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
          <WorkBlock title="Detalhes">
            <dl className="divide-y divide-line-faint">
              {details.map((item) => (
                <div key={item.label} className="grid min-h-10 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3 px-4 py-1.5">
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
