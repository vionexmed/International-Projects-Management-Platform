import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import { Timeline } from "@/components/app/timeline";
import { WorkBlock } from "@/features/projects/work-block";
import { localeFromLanguage } from "@/lib/i18n/config";

/**
 * The full history — the long form of the overview's "Atividade recente", so
 * the overview tab stays lit and this page offers the way back.
 */
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
    <div className="max-w-3xl">
      <Link
        href={`/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-label font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Visão geral
      </Link>

      <WorkBlock
        title="Histórico completo"
        count={events.length || undefined}
        description="Eventos registrados automaticamente ao longo do projeto."
      >
        <div className="px-4 py-4">
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
      </WorkBlock>
    </div>
  );
}
