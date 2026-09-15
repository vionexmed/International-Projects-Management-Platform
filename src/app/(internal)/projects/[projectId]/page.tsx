import Link from "next/link";
import { AlertOctagon, Flag } from "lucide-react";
import { can, requireInternalUser } from "@/server/auth/current-user";
import { getProjectWorkspace } from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditStageDialog } from "@/features/projects/edit-stage-dialog";
import { NewMilestoneDialog } from "@/features/projects/new-milestone-dialog";
import { STAGE_PERMISSION } from "@/server/authz/permissions";
import { Timeline } from "@/components/app/timeline";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";

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
    listProjectTimeline(user, projectId, 8),
  ]);

  const upcomingMilestones = milestones.filter((milestone) => milestone.status !== "COMPLETED");

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Panel>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Responsável">{project.owner.name}</Field>
          <Field label="Início">{formatDate(project.startDate, locale)}</Field>
          <Field label="Lançamento previsto">{formatDate(project.targetLaunchDate, locale)}</Field>
          <Field label="Categoria">{project.category ?? "—"}</Field>
          <Field label="Tipo de produto">{project.productType ?? "—"}</Field>
          <Field label="Etapa atual">{label.stageKey(project.currentStage, dict)}</Field>
        </dl>
      </Panel>

      {/* Progress */}
      <Panel>
        <PanelHeader
          title="Progresso"
          description="Percentual concluído em cada etapa do projeto."
          action={
            <span className="text-[13px] text-muted">
              Geral <span className="ml-1 font-semibold text-ink tabular-nums">{progress}%</span>
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          {stages.map((stage) => {
            const status = meta.stage(stage.status, dict);
            return (
              <div key={stage.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-ink">
                    {label.stageKey(stage.key, dict)}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    <span className="text-[13px] font-semibold text-ink tabular-nums">
                      {stage.computedProgress}%
                    </span>
                    {can(user, STAGE_PERMISSION[stage.key]) ? (
                      <EditStageDialog
                        stage={{
                          id: stage.id,
                          projectId: project.id,
                          name: label.stageKey(stage.key, dict),
                          status: stage.status,
                          progress: stage.progress,
                          notes: stage.notes,
                        }}
                      />
                    ) : null}
                  </span>
                </div>
                <ProgressBar value={stage.computedProgress} label={label.stageKey(stage.key, dict)} />
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Blockers */}
        <Panel>
          <PanelHeader title="Bloqueios atuais" />
          {project.blockerNote ? (
            <div className="flex items-start gap-3 p-5">
              <AlertOctagon className="mt-0.5 size-4 shrink-0 text-risk" />
              <p className="text-sm leading-relaxed text-ink">{project.blockerNote}</p>
            </div>
          ) : (
            <EmptyState title="Nenhum bloqueio registrado." compact />
          )}
        </Panel>

        {/* Milestones */}
        <Panel>
          <PanelHeader
            title="Próximos marcos"
            action={
              can(user, "project:update") ? <NewMilestoneDialog projectId={project.id} /> : null
            }
          />
          {upcomingMilestones.length === 0 ? (
            <EmptyState icon={Flag} title="Nenhum marco pendente." compact />
          ) : (
            <ul className="divide-y divide-line-soft">
              {upcomingMilestones.map((milestone) => {
                const status = meta.milestone(milestone.status, dict);
                return (
                  <li
                    key={milestone.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{milestone.title}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {milestone.stage ? label.stageKey(milestone.stage, dict) : "—"} ·{" "}
                        {formatDate(milestone.dueDate, locale)}
                      </p>
                    </div>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Recent activity */}
      <Panel>
        <PanelHeader
          title="Atividade recente"
          action={
            <Link
              href={`/projects/${projectId}/timeline`}
              className="text-[13px] font-medium text-brand-strong hover:underline"
            >
              Ver histórico completo
            </Link>
          }
        />
        <div className="p-5">
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
      </Panel>
    </div>
  );
}
