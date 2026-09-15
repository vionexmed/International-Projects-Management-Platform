import { requireSupplierUser } from "@/server/auth/current-user";
import { requireSharedProjectAccess } from "@/server/authz/access";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Timeline } from "@/components/app/timeline";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

export default async function SupplierProjectTimelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSupplierUser();
  await orNotFound(requireSharedProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  // Internal-only events are filtered out by the timeline scope.
  const events = await listProjectTimeline(user, projectId, 100);

  return (
    <Panel>
      <PanelHeader title={dict.portal.project.timeline} />
      <div className="p-5">
        <Timeline
          locale={locale}
          emptyTitle={dict.common.noResults}
          items={events.map((event) => ({
            id: event.id,
            description: event.description,
            createdAt: event.createdAt,
            actorName: event.actor?.name ?? null,
          }))}
        />
      </div>
    </Panel>
  );
}
