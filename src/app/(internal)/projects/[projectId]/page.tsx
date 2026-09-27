import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { can, requireInternalUser } from "@/server/auth/current-user";
import { getProjectWorkspace } from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { Panel } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { ProgressBar, type ProgressTone } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { EditStageDialog } from "@/features/projects/edit-stage-dialog";
import { NewMilestoneDialog } from "@/features/projects/new-milestone-dialog";
import { CanvasEmpty, CanvasList, CanvasRow } from "@/features/projects/canvas-list";
import { stageSegment } from "@/features/projects/stage-routes";
import { STAGE_PERMISSION } from "@/server/authz/permissions";
import { Timeline } from "@/components/app/timeline";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta, type MilestoneProgress, type StageProgress } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A bar is neutral unless it has something to say: done, or held up. */
const STAGE_BAR_TONE: Partial<Record<StageProgress, ProgressTone>> = {
  COMPLETED: "ok",
  BLOCKED: "risk",
};

/**
 * "How is this project right now?"
 *
 * One focal block — progress: the overall number, what comes next, the
 * blocker when there is one, and the four stages beside them. Everything
 * under it is on the canvas. Identity (owner, dates, category) lives in the record header,
 * and the full tables live in the other tabs; this page links to them rather
 * than reproducing them.
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

  const [{ project, stages, milestones, progress }, timeline] = await Promise.all([
    orNotFound(getProjectWorkspace(user, projectId)),
    /**
     * Three, not eight. This block is a preview of the full history, which is
     * the canonical record of the project; a longer list here would be the
     * same information twice, and the second copy is the one nobody trusts.
     */
    listProjectTimeline(user, projectId, 3),
  ]);

  const upcomingMilestones = milestones.filter((milestone) => milestone.status !== "COMPLETED");
  const nextMilestone = upcomingMilestones[0] ?? null;
  const nextLate =
    nextMilestone !== null &&
    (nextMilestone.status === "DELAYED" || (daysUntil(nextMilestone.dueDate) ?? 0) < 0);

  const base = `/projects/${projectId}`;

  const canAddMilestone =
    can(user, "project:update") || OPTIONS.stageKey.some((key) => can(user, STAGE_PERMISSION[key]));

  return (
    <div className="space-y-10">
      {/*
        Progress — the one box on the page. Overall number on the left, the
        four stages on the right: one block that answers "how far along, and
        where". The stage rows used to be a second, full-width section below a
        half-empty health panel that also repeated the current stage's number.
      */}
      <Panel className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <p className="text-meta text-muted">Progresso geral</p>
          <p className="mt-1 text-kpi text-ink tabular-nums">{progress}%</p>
          <ProgressBar value={progress} label="Progresso geral" className="mt-3 max-w-xs" />

          <div className="mt-6">
            <p className="text-meta text-muted">Próximo marco</p>
            {nextMilestone ? (
              <>
                <p className="mt-0.5 text-body font-medium text-ink">{nextMilestone.title}</p>
                <p className={cn("text-meta tabular-nums", nextLate ? "text-risk" : "text-muted")}>
                  {formatDate(nextMilestone.dueDate, locale)}
                  {nextLate ? " · atrasado" : ""}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-body text-muted">Nenhum pendente</p>
            )}
          </div>

          {/*
            A blocker is an exception, so it appears only when there is one —
            under the number it explains.
          */}
          {project.blockerNote ? (
            <Panel variant="callout" tone="risk" role="alert" className="mt-6">
              <div className="flex items-start gap-3">
                <AlertOctagon className="mt-0.5 size-4 shrink-0 text-risk" aria-hidden />
                <div className="min-w-0">
                  <p className="text-title text-risk">Bloqueio atual</p>
                  <p className="mt-1 text-body text-ink">{project.blockerNote}</p>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="min-w-0 border-t border-line px-5 pt-4 pb-2 sm:px-6 lg:border-t-0 lg:border-l lg:pt-5">
          <h2 className="text-meta text-muted">Etapas</h2>
          <ul className="mt-1 divide-y divide-line-soft">
            {stages.map((stage) => {
              const status = meta.stage(stage.status as StageProgress, dict);
              const name = label.stageKey(stage.key, dict);
              const current = stage.key === project.currentStage;
              return (
                /*
                  Fixed tracks so name, bar, number and status line up across
                  the four rows and read as one unit. On a phone it is two
                  lines — name and status, then bar and number — so the name
                  is not squeezed to a few letters.
                */
                <li
                  key={stage.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[11.5rem_minmax(0,1fr)_2.75rem_8.5rem_2rem] sm:gap-x-4"
                >
                  <Link
                    href={`${base}/${stageSegment(stage.key)}`}
                    aria-current={current ? "step" : undefined}
                    className="col-start-1 row-start-1 min-w-0 truncate text-body font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {name}
                    {/* Replaces the "Etapa atual" line the health panel used to repeat. */}
                    {current ? <span className="ml-1.5 text-meta font-normal text-muted">atual</span> : null}
                  </Link>
                  <ProgressBar
                    value={stage.computedProgress}
                    tone={STAGE_BAR_TONE[stage.status as StageProgress]}
                    label={name}
                    className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1"
                  />
                  <span className="col-start-2 row-start-2 text-meta font-medium text-ink tabular-nums sm:col-start-3 sm:row-start-1 sm:text-right">
                    {stage.computedProgress}%
                  </span>
                  <span className="col-start-2 row-start-1 min-w-0 sm:col-start-4">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </span>
                  <span className="col-start-3 row-span-2 row-start-1 flex justify-end sm:col-start-5 sm:row-span-1">
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
          </ul>
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-8">
        <Section
          title="Próximos marcos"
          count={upcomingMilestones.length || undefined}
          action={
            /*
              A stage owner adds milestones to their own stage; the general
              project capability covers the ones that span the project. The
              action re-checks both — this only decides whether offering it
              makes sense.
            */
            canAddMilestone ? <NewMilestoneDialog projectId={project.id} /> : null
          }
        >
          {upcomingMilestones.length === 0 ? (
            <CanvasEmpty>Nenhum marco pendente.</CanvasEmpty>
          ) : (
            <CanvasList>
              {upcomingMilestones.map((milestone) => {
                const status = meta.milestone(milestone.status as MilestoneProgress, dict);
                return (
                  <CanvasRow
                    key={milestone.id}
                    title={milestone.title}
                    subtitle={[
                      milestone.stage ? label.stageKey(milestone.stage, dict) : null,
                      milestone.dueDate ? formatDate(milestone.dueDate, locale) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
                  />
                );
              })}
            </CanvasList>
          )}
        </Section>

        <Section
          title="Atividade recente"
          action={{ label: "Ver histórico completo", href: `${base}/timeline` }}
        >
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
        </Section>
      </div>
    </div>
  );
}
