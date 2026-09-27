import { Flag } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { getSupplierProjectWorkspace } from "@/server/services/projects";
import { orNotFound } from "@/server/authz/rsc";
import { Panel } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta, type MilestoneProgress, type StageProgress } from "@/lib/labels";
import { formatDate } from "@/lib/format";

/**
 * "How is this project now?" The one focal fact is the overall progress next
 * to what's coming up — everything else (the per-stage bars, the milestone
 * list) is supporting detail and reads as canvas sections, not more panels of
 * the same weight.
 */
export default async function SupplierProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const { project, stages, milestones, progress } = await orNotFound(getSupplierProjectWorkspace(user, projectId));
  const upcoming = milestones.filter((milestone) => milestone.status !== "COMPLETED");

  return (
    <div className="space-y-10">
      {/* Internal fields — owner, blockers, stage notes, project description —
          are absent from the *query*, not merely from this markup: a server
          component ships every field it receives in the RSC payload, so
          leaving one out of the JSX would still send it to the browser.
          The column allowlist lives in `src/server/authz/projections.ts`. */}
      <Panel className="flex flex-wrap items-center gap-x-10 gap-y-5 p-6">
        <div>
          <p className="text-meta text-muted">{dict.common.progress}</p>
          <p className="mt-1 text-kpi text-ink tabular-nums">{progress}%</p>
          <p className="mt-1 text-body text-ink-soft">{label.stageKey(project.currentStage, dict)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-meta text-muted">{dict.common.nextMilestone}</p>
          <p className="mt-1 text-title font-medium text-ink">
            {upcoming[0]?.title ?? dict.portal.project.noMilestones}
          </p>
          {upcoming[0] ? (
            <p className="mt-0.5 text-meta text-muted">{formatDate(upcoming[0].dueDate, locale)}</p>
          ) : null}
        </div>
      </Panel>

      <Section title={dict.portal.project.stageProgress}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {stages.map((stage) => {
            const status = meta.stage(stage.status as StageProgress, dict);
            return (
              <div key={stage.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-title font-medium text-ink">
                    {label.stageKey(stage.key, dict)}
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    <span className="text-meta font-semibold text-ink tabular-nums">
                      {stage.computedProgress}%
                    </span>
                  </span>
                </div>
                <ProgressBar value={stage.computedProgress} label={label.stageKey(stage.key, dict)} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={dict.portal.project.milestones} count={upcoming.length || undefined}>
        {upcoming.length === 0 ? (
          <EmptyState icon={Flag} title={dict.portal.project.noMilestones} compact />
        ) : (
          <ul className="divide-y divide-line-soft">
            {upcoming.map((milestone) => {
              const status = meta.milestone(milestone.status as MilestoneProgress, dict);
              return (
                <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink">{milestone.title}</p>
                    <p className="mt-0.5 text-meta text-muted">
                      {milestone.stage ? `${label.stageKey(milestone.stage, dict)} · ` : ""}
                      {formatDate(milestone.dueDate, locale)}
                    </p>
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
