import { requireInternalUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listProjectTimeline } from "@/server/services/timeline";
import { orNotFound } from "@/server/authz/rsc";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Timeline } from "@/components/app/timeline";
import { localeFromLanguage } from "@/lib/i18n/config";

/**
 * The full history. No longer a tab of its own: it is the long form of the
 * overview's "Atividade recente", so the overview tab stays lit and this page
 * offers the way back.
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
        className="mb-4 inline-flex items-center gap-1.5 text-meta text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Visão geral
      </Link>

      <Section
        title="Histórico completo"
        count={events.length || undefined}
        description="Eventos registrados automaticamente ao longo do projeto."
      >
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
      </Section>
    </div>
  );
}
