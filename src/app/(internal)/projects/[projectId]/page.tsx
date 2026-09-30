import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { can, requireInternalUser } from "@/server/auth/current-user";
import { getProjectWorkspace } from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { db } from "@/server/db";
import { ProgressBar, type ProgressTone } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/avatar";
import { EditStageDialog } from "@/features/projects/edit-stage-dialog";
import { NewMilestoneDialog } from "@/features/projects/new-milestone-dialog";
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

/** A quiet section: a small heading, an optional link, and unboxed content. */
function Block({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-label font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function BlockLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-meta text-muted transition-colors hover:text-ink">
      {children}
    </Link>
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

  const facts = [
    `${open.length} ${open.length === 1 ? "tarefa em aberto" : "tarefas em aberto"}`,
    overdue.length > 0 ? `${overdue.length} ${overdue.length === 1 ? "atrasada" : "atrasadas"}` : null,
    project.targetLaunchDate ? `lançamento em ${formatDate(project.targetLaunchDate, locale)}${launchIn !== null && launchIn >= 0 ? ` (${launchIn} dias)` : ""}` : null,
  ].filter(Boolean);

  const row = "flex min-h-10 items-center gap-3 border-b border-line-faint py-2 last:border-b-0";

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {project.blockerNote ? (
        <div role="alert" className="flex items-start gap-3 border-l-2 border-risk pl-3">
          <AlertOctagon className="mt-0.5 size-4 shrink-0 text-risk" aria-hidden />
          <p className="text-body text-ink"><span className="font-semibold text-risk">Bloqueio: </span>{project.blockerNote}</p>
        </div>
      ) : null}

      <section aria-label="Andamento">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-kpi text-ink tabular-nums">{progress}%</span>
          <span className="text-body text-muted">
            {facts.map((fact, index) => (
              <span key={fact}>
                {index > 0 ? " · " : ""}
                <span className={index === 1 && overdue.length > 0 ? "text-risk" : undefined}>{fact}</span>
              </span>
            ))}
          </span>
        </p>

        <ol className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {stages.map((stage) => {
            const status = meta.stage(stage.status as StageProgress, dict);
            const name = label.stageKey(stage.key, dict);
            const current = stage.key === project.currentStage;
            return (
              <li key={stage.id} className="group relative min-w-0">
                <ProgressBar
                  value={stage.computedProgress}
                  tone={current ? "neutral" : STAGE_BAR_TONE[stage.status as StageProgress]}
                  label={name}
                  barClassName={cn("h-0.5", current && "[&>*]:bg-brand")}
                />
                <div className="mt-2 flex items-baseline gap-2">
                  <Link
                    href={`${base}/${stageSegment(stage.key)}`}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "min-w-0 truncate text-body after:absolute after:inset-0 hover:underline",
                      current ? "font-semibold text-ink" : "text-ink-soft",
                    )}
                  >
                    {name}
                  </Link>
                  <span className="ml-auto shrink-0 text-meta text-muted tabular-nums">{stage.computedProgress}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-meta text-muted">{current ? `Atual · ${status.label.toLowerCase()}` : status.label}</span>
                  {can(user, STAGE_PERMISSION[stage.key]) ? (
                    <span className="relative z-10 -my-1.5 ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
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

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-10">
          <Block title="Próximas tarefas" action={<BlockLink href={`${base}/tasks`}>Abrir plano</BlockLink>}>
            {comingUp.length === 0 ? (
              <p className="py-2 text-body text-muted">Nenhuma tarefa em aberto.</p>
            ) : (
              <ul>
                {comingUp.map((task) => {
                  const late = isTaskOverdue(task.status, task.dueDate, now);
                  return (
                    <li key={task.id} className={cn(row, "relative")}>
                      <Link
                        href={`${base}/tasks?task=${task.id}`}
                        className="min-w-0 flex-1 truncate text-body text-ink after:absolute after:inset-0 hover:underline"
                      >
                        {task.title}
                      </Link>
                      {task.assignedTo ? (
                        <span className="hidden shrink-0 text-meta text-muted md:inline">{task.assignedTo.name}</span>
                      ) : null}
                      <span className={cn("w-16 shrink-0 text-right text-meta tabular-nums", late ? "text-risk" : "text-muted")}>
                        {task.dueDate ? formatDateShort(task.dueDate, locale) : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>

          <Block title="Marcos" action={canAddMilestone ? <NewMilestoneDialog projectId={project.id} /> : null}>
            {upcomingMilestones.length === 0 ? (
              <p className="py-2 text-body text-muted">Nenhum marco pendente.</p>
            ) : (
              <ul>
                {upcomingMilestones.map((milestone) => {
                  const status = meta.milestone(milestone.status as MilestoneProgress, dict);
                  const late = milestoneLate(milestone);
                  return (
                    <li key={milestone.id} className={row}>
                      <span className="min-w-0 flex-1 truncate text-body text-ink">{milestone.title}</span>
                      <span className="hidden shrink-0 text-meta text-muted sm:inline">{status.label}</span>
                      <span className={cn("w-16 shrink-0 text-right text-meta tabular-nums", late ? "text-risk" : "text-muted")}>
                        {milestone.dueDate ? formatDateShort(milestone.dueDate, locale) : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>
        </div>

        <div className="min-w-0 space-y-10">
          <Block title="Detalhes">
            <dl>
              {details.map((item) => (
                <div key={item.label} className={row}>
                  <dt className="w-28 shrink-0 text-meta text-muted">{item.label}</dt>
                  <dd className="min-w-0 truncate text-body text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            {project.description ? (
              <p className="mt-3 text-body whitespace-pre-wrap text-ink-soft">{project.description}</p>
            ) : null}
          </Block>

          <Block title="Atividade" action={<BlockLink href={`${base}/timeline`}>Ver tudo</BlockLink>}>
            <div className="pt-2">
              <Timeline
                locale={locale}
                emptyTitle="Nenhuma atividade ainda."
                items={timeline.slice(0, 4).map((event) => ({
                  id: event.id,
                  description: event.description,
                  createdAt: event.createdAt,
                  actorName: event.actor?.name ?? null,
                }))}
              />
            </div>
          </Block>
        </div>
      </div>
    </div>
  );
}
