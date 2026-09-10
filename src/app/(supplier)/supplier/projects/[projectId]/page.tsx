import { Flag } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { getProjectWorkspace } from "@/server/services/projects";
import { orNotFound } from "@/server/authz/rsc";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export default async function SupplierProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const { project, stages, milestones, progress } = await orNotFound(getProjectWorkspace(user, projectId));
  const upcoming = milestones.filter((milestone) => milestone.status !== "COMPLETED");

  return (
    <div className="space-y-6">
      <Panel>
        {/* Confidential internal fields (owner, blockers, internal notes) are
            deliberately absent from the supplier view. */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-4">
          <Field label={dict.common.stage}>{label.stageKey(project.currentStage, dict)}</Field>
          <Field label={dict.common.progress}>{progress}%</Field>
          <Field label={dict.common.targetLaunch}>
            {formatDate(project.targetLaunchDate, locale)}
          </Field>
          <Field label={dict.common.nextMilestone}>{upcoming[0]?.title ?? "—"}</Field>
        </dl>
      </Panel>

      <Panel>
        <PanelHeader title={dict.portal.project.stageProgress} />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          {stages.map((stage) => {
            const status = meta.stage(stage.status, dict);
            return (
              <div key={stage.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-ink">
                    {label.stageKey(stage.key, dict)}
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    <span className="text-[13px] font-semibold text-ink tabular-nums">
                      {stage.computedProgress}%
                    </span>
                  </span>
                </div>
                <ProgressBar value={stage.computedProgress} label={label.stageKey(stage.key, dict)} />
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={dict.portal.project.milestones} />
        {upcoming.length === 0 ? (
          <EmptyState icon={Flag} title={dict.portal.project.noMilestones} compact />
        ) : (
          <ul className="divide-y divide-line-soft">
            {upcoming.map((milestone) => {
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
  );
}
