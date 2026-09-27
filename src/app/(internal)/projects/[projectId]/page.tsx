import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { can, requireInternalUser } from "@/server/auth/current-user";
import { getProjectWorkspace } from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PropertyList } from "@/components/ui/card";
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
 * One focal block — the health panel: overall progress, where the project is,
 * what comes next, and the blocker when there is one. Everything under it is
 * on the canvas. Identity (owner, dates, category) lives in the record header,
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

  const currentStage = stages.find((stage) => stage.key === project.currentStage) ?? null;
  const base = `/projects/${projectId}`;

  const canAddMilestone =
    can(user, "project:update") || OPTIONS.stageKey.some((key) => can(user, STAGE_PERMISSION[key]));

  return (
    <div className="space-y-10">
      {/* Health — the one box on the page. */}
      <Panel className="p-5 sm:p-6">
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            project.blockerNote && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8",
          )}
        >
          <div className="min-w-0">
            <p className="text-meta text-muted">Progresso geral</p>
            <p className="mt-1 text-kpi text-ink tabular-nums">{progress}%</p>
            <ProgressBar value={progress} label="Progresso geral" className="mt-3 max-w-md" />

            <PropertyList
              className="mt-5"
              items={[
                {
                  label: "Etapa atual",
                  value: currentStage ? (
                    <Link
                      href={`${base}/${stageSegment(currentStage.key)}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {label.stageKey(currentStage.key, dict)}
                      <span className="font-normal text-muted tabular-nums">
                        {" "}
                        · {currentStage.computedProgress}%
                      </span>
                    </Link>
                  ) : null,
                },
                {
                  label: "Próximo marco",
                  value: nextMilestone ? (
                    <>
                      {nextMilestone.title}
                      <span
                        className={cn(
                          "font-normal tabular-nums",
                          nextLate ? "text-risk" : "text-muted",
                        )}
                      >
                        {" "}
                        · {formatDate(nextMilestone.dueDate, locale)}
                        {nextLate ? " · atrasado" : ""}
                      </span>
                    </>
                  ) : (
                    <span className="font-normal text-muted">Nenhum pendente</span>
                  ),
                },
              ]}
            />
          </div>

          {/*
            A blocker is an exception, so it appears only when there is one —
            inside the health panel, next to the number it explains.
          */}
          {project.blockerNote ? (
            <Panel variant="callout" tone="risk" role="alert" className="self-start">
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
      </Panel>

      <Section title="Etapas">
        <ul className="divide-y divide-line border-y border-line">
          {stages.map((stage) => {
            const status = meta.stage(stage.status as StageProgress, dict);
            const name = label.stageKey(stage.key, dict);
            return (
              <li key={stage.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <Link
                  href={`${base}/${stageSegment(stage.key)}`}
                  className="min-w-0 flex-1 truncate text-body font-medium text-ink underline-offset-4 hover:underline sm:w-48 sm:flex-none"
                >
                  {name}
                </Link>
                {/* Full width on its own line on a phone; between name and number on desktop. */}
                <ProgressBar
                  value={stage.computedProgress}
                  tone={STAGE_BAR_TONE[stage.status as StageProgress]}
                  label={name}
                  className="order-last basis-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0"
                />
                <span className="w-10 text-right text-meta font-medium text-ink tabular-nums">
                  {stage.computedProgress}%
                </span>
                <span className="sm:w-36">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </span>
                <span className="flex w-8 justify-end">
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
      </Section>

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
