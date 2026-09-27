import type { Metadata } from "next";
import Link from "next/link";
import { requireInternalUser } from "@/server/auth/current-user";
import { getPortfolioSummary, listUpcomingDeadlines } from "@/server/services/dashboard";
import { countAttentionItems, listAttentionItems } from "@/server/services/attention";
import { PageHeader } from "@/components/app/page-header";
import { AttentionList } from "@/components/app/attention-list";
import { Section } from "@/components/ui/section";
import { SummaryLine, type SummaryItem } from "@/components/ui/stat";
import { CanvasEmpty, CanvasList, CanvasRow } from "@/features/projects/canvas-list";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatDateShort, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(name: string) {
  const hour = new Date().getHours();
  const firstName = name.split(" ")[0];
  if (hour < 12) return `Bom dia, ${firstName}.`;
  if (hour < 18) return `Boa tarde, ${firstName}.`;
  return `Boa noite, ${firstName}.`;
}

/**
 * Triage. One question: what needs attention now?
 *
 * Nothing here is a canonical list. The summary line links into `/projects`,
 * the exceptions link to wherever each one is resolved (their counts, in the
 * section header, to the filtered list of each kind), and the deadlines link
 * to the task. Every block is a doorway; none of them is a destination.
 *
 * The page has one box on purpose — the exceptions. The portfolio numbers are
 * a sentence, the deadlines sit on the canvas, and the distribution by stage
 * lives on `/reports`, which owns it; a near-copy here competed with the one
 * thing this page is for.
 */
export default async function DashboardPage() {
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);

  const [summary, attention, counts, deadlines] = await Promise.all([
    getPortfolioSummary(user),
    listAttentionItems(user, 6),
    countAttentionItems(user),
    listUpcomingDeadlines(user, 6),
  ]);

  /**
   * The attention list shows six rows of mixed kinds; these counts are the
   * way to the rest. They sit in the section header as one quiet line — as a
   * footer under the rows they read as the same items a second time.
   */
  const attentionKinds = [
    counts.tasks > 0
      ? { label: `${counts.tasks} ${counts.tasks === 1 ? "tarefa atrasada" : "tarefas atrasadas"}`, href: "/tasks?tab=OVERDUE" }
      : null,
    counts.requests > 0
      ? { label: `${counts.requests} ${counts.requests === 1 ? "documento atrasado" : "documentos atrasados"}`, href: "/regulatory?status=overdue" }
      : null,
    counts.reviews > 0
      ? { label: `${counts.reviews} aguardando análise`, href: "/regulatory?status=review" }
      : null,
    counts.projects > 0
      ? { label: `${counts.projects} ${counts.projects === 1 ? "projeto bloqueado" : "projetos bloqueados"}`, href: "/projects?tab=BLOCKED" }
      : null,
    counts.milestones > 0
      ? { label: `${counts.milestones} ${counts.milestones === 1 ? "marco atrasado" : "marcos atrasados"}`, href: "/projects?tab=ATTENTION" }
      : null,
  ].filter((link): link is { label: string; href: string } => link !== null);

  // Colour only on the exceptions, and only when there is one.
  const portfolio: SummaryItem[] = [
    { label: summary.total === 1 ? "projeto" : "projetos", value: summary.total, href: "/projects" },
    { label: "em dia", value: summary.onTrack, href: "/projects?tab=ON_TRACK" },
    {
      label: "em risco",
      value: summary.atRisk,
      tone: summary.atRisk > 0 ? "warn" : undefined,
      href: "/projects?tab=AT_RISK",
    },
    {
      label: summary.blocked === 1 ? "bloqueado" : "bloqueados",
      value: summary.blocked,
      tone: summary.blocked > 0 ? "risk" : undefined,
      href: "/projects?tab=BLOCKED",
    },
  ];

  return (
    <>
      <PageHeader title={greeting(user.name)}>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <SummaryLine items={portfolio} />
          <Link
            href="/reports"
            className="text-meta text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Ver relatórios
          </Link>
        </div>
      </PageHeader>

      {/*
        Two columns on a desktop: the exceptions are the page's subject and
        take two thirds; the deadlines are a compact rail beside them. One
        full-width column put titles on the far left and dates on the far
        right, with 800px of nothing in between.
      */}
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
        <Section
          title="Precisa da sua atenção"
          count={counts.total > 0 ? counts.total : undefined}
          description={
            attentionKinds.length > 0 ? (
              <span className="flex flex-wrap gap-x-1.5">
                {attentionKinds.map((kind, index) => (
                  <span key={kind.href} className="whitespace-nowrap">
                    <Link
                      href={kind.href}
                      className="underline-offset-4 transition-colors hover:text-ink hover:underline"
                    >
                      {kind.label}
                    </Link>
                    {/* Trailing, so a wrapped line never opens with a separator. */}
                    {index < attentionKinds.length - 1 ? (
                      <span className="ml-1.5 text-faint" aria-hidden>
                        ·
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            ) : (
              "Atrasos, bloqueios e análises paradas em todo o portfólio."
            )
          }
        >
          <AttentionList
            items={attention}
            locale={locale}
            emptyTitle="Nada fora do previsto."
            emptyDescription="Nenhum atraso, bloqueio ou análise parada no portfólio."
          />
        </Section>

        <Section
          title="Próximos prazos"
          description="Tarefas em aberto, por vencimento."
          action={{ label: "Ver tarefas", href: "/tasks" }}
        >
          {deadlines.length === 0 ? (
            <CanvasEmpty>Nenhum prazo próximo.</CanvasEmpty>
          ) : (
            <CanvasList>
              {deadlines.map((item) => {
                const remaining = daysUntil(item.dueDate);
                const late = remaining !== null && remaining < 0;

                return (
                  <CanvasRow
                    key={item.id}
                    href={`/tasks/${item.id}`}
                    title={item.title}
                    subtitle={
                      item.supplier
                        ? `${item.project.name} · aguardando ${item.supplier.name}`
                        : item.project.name
                    }
                    // Stacked to mirror title/subtitle: the date lines up with
                    // the title, how far away it is with the project.
                    trailing={
                      <span className="text-right text-meta whitespace-nowrap tabular-nums">
                        <span className="block text-ink-soft">
                          {formatDateShort(item.dueDate, locale)}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block",
                            late ? "font-medium text-risk" : "text-muted",
                          )}
                        >
                          {late
                            ? `${Math.abs(remaining)}d atrasado`
                            : remaining === 0
                              ? "hoje"
                              : `em ${remaining}d`}
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </CanvasList>
          )}
        </Section>
      </div>
    </>
  );
}
