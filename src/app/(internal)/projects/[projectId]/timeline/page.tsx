import { requireInternalUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Timeline } from "@/components/app/timeline";
import { localeFromLanguage } from "@/lib/i18n/config";

export default async function ProjectTimelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  await orNotFound(requireProjectAccess(user, projectId));

  const events = await listProjectTimeline(user, projectId, 200);
  const locale = localeFromLanguage(user.language);

  return (
    <Panel>
      <PanelHeader
        title="Histórico"
        description="Eventos registrados automaticamente ao longo do projeto."
      />
      <div className="p-5">
        <Timeline
          locale={locale}
          emptyTitle="Nenhum evento registrado."
          emptyDescription="As ações realizadas no projeto aparecerão aqui."
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
