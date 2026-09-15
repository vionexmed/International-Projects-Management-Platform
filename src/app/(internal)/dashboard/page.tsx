import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { getPortfolioSummary, listUpcomingDeadlines } from "@/server/services/dashboard";
import { countAttentionItems, listAttentionItems } from "@/server/services/attention";
import { getPortfolioBreakdown } from "@/server/services/analytics";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { AttentionList } from "@/components/app/attention-list";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label } from "@/lib/labels";
import { formatDeadlineParts, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StageKey } from "@/generated/prisma";

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
 * This page used to answer it with the portfolio table — the same columns,
 * the same query and the same actions as `/projects`, one filter apart. That
 * made two screens for one job and taught people that the dashboard is just a
 * shorter list of projects.
 *
 * Now nothing here is a canonical list. The numbers link into `/projects`, the
 * exceptions link to wherever each one is resolved, and the deadlines link to
 * the task. Every block is a doorway; none of them is a destination.
 */
export default async function DashboardPage() {
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [summary, attention, counts, deadlines, breakdown] = await Promise.all([
    getPortfolioSummary(user),
    listAttentionItems(user, 6),
    countAttentionItems(user),
    listUpcomingDeadlines(user, 6),
    getPortfolioBreakdown(user),
  ]);

  /** Only the kinds that actually have rows get a link — no empty promises. */
  const attentionLinks = [
    counts.tasks > 0
      ? { label: `${counts.tasks} tarefas atrasadas`, href: "/tasks?tab=OVERDUE" }
      : null,
    counts.requests > 0
      ? { label: `${counts.requests} documentos atrasados`, href: "/regulatory?status=overdue" }
      : null,
    counts.reviews > 0
      ? { label: `${counts.reviews} aguardando análise`, href: "/regulatory?status=review" }
      : null,
    counts.projects > 0
      ? { label: `${counts.projects} projetos bloqueados`, href: "/projects?tab=BLOCKED" }
      : null,
    counts.milestones > 0
      ? { label: `${counts.milestones} marcos atrasados`, href: "/projects?tab=ATTENTION" }
      : null,
  ].filter((link): link is { label: string; href: string } => link !== null);

  return (
    <>
      <PageHeader
        title={greeting(user.name)}
        description="O que precisa da sua atenção agora."
      />

      {/* Portfolio — four numbers, each a way into the canonical list. */}
      <Panel className="mb-8">
        <div className="stat-grid grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          <Stat label="Total de projetos" value={summary.total} href="/projects" />
          <Stat label="Em dia" value={summary.onTrack} tone="ok" href="/projects?tab=ON_TRACK" />
          <Stat label="Em risco" value={summary.atRisk} tone="warn" href="/projects?tab=AT_RISK" />
          <Stat label="Bloqueados" value={summary.blocked} tone="risk" href="/projects?tab=BLOCKED" />
        </div>
      </Panel>

      {/* Exceptions */}
      <section className="mb-8">
        <SectionHeader
          title="Precisa da sua atenção"
          description={
            counts.total > 0
              ? `${counts.total} pendências fora do previsto em todo o portfólio.`
              : "Exceções do portfólio: atrasos, bloqueios e análises paradas."
          }
        />
        <AttentionList
          items={attention}
          locale={locale}
          links={attentionLinks}
          emptyTitle="Nada fora do previsto."
          emptyDescription="Nenhum atraso, bloqueio ou análise parada no portfólio."
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming deadlines */}
        <section>
          <SectionHeader
            title="Próximos prazos"
            description="Tarefas com vencimento próximo."
            action={
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
              >
                Ver tarefas
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <Panel>
            {deadlines.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nenhum prazo próximo." compact />
            ) : (
              <ul className="divide-y divide-line-soft">
                {deadlines.map((item) => {
                  const parts = formatDeadlineParts(item.dueDate, locale);
                  const remaining = daysUntil(item.dueDate);
                  const late = remaining !== null && remaining < 0;

                  return (
                    <li key={item.id}>
                      <Link
                        href={`/tasks/${item.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-subtle"
                      >
                        <div
                          className={cn(
                            "flex size-11 shrink-0 flex-col items-center justify-center rounded-sm border",
                            late ? "border-risk/20 bg-risk-soft" : "border-line bg-subtle",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[9px] font-semibold tracking-[0.08em]",
                              late ? "text-risk" : "text-muted",
                            )}
                          >
                            {parts.month}
                          </span>
                          <span
                            className={cn(
                              "text-[15px] leading-none font-semibold tabular-nums",
                              late ? "text-risk" : "text-ink",
                            )}
                          >
                            {parts.day}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                          <p className="mt-0.5 truncate text-[13px] text-muted">
                            {item.project.name}
                            {item.supplier ? ` · ${item.supplier.name}` : ""}
                          </p>
                        </div>

                        {late ? (
                          <span className="shrink-0 text-[12px] font-medium text-risk">
                            {Math.abs(remaining)}d atrasado
                          </span>
                        ) : (
                          <span className="shrink-0 text-[12px] text-muted">{remaining}d</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </section>

        {/*
          Portfolio health — where the projects are, not which projects they
          are. Counts and shares only; the names live one click away.
        */}
        <section>
          <SectionHeader
            title="Saúde do portfólio"
            description="Distribuição por etapa."
            action={
              <Link
                href="/reports"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
              >
                Ver relatórios
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <Panel>
            {breakdown.total === 0 ? (
              <EmptyState title="Nenhum projeto no portfólio." compact />
            ) : (
              <ul className="divide-y divide-line-soft">
                {breakdown.stage.map((slice) => {
                  const share = Math.round((slice.count / breakdown.total) * 100);
                  return (
                    <li key={slice.key}>
                      <Link
                        href={slice.href}
                        className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-subtle"
                      >
                        <span className="w-44 shrink-0 truncate text-[13px] text-ink">
                          {label.stageKey(slice.key as StageKey, dict)}
                        </span>
                        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
                          <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                        <span className="w-10 shrink-0 text-right text-[13px] font-semibold text-ink tabular-nums">
                          {slice.count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </>
  );
}

function Stat({
  label: statLabel,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "risk";
  href: string;
}) {
  const dot =
    tone === "ok" ? "bg-ok-dot" : tone === "warn" ? "bg-warn-dot" : tone === "risk" ? "bg-risk-dot" : null;

  return (
    <Link
      href={href}
      className="group px-5 py-4 transition-colors hover:bg-subtle"
    >
      <div className="flex items-center gap-2">
        {dot ? <span className={cn("size-[7px] rounded-full", dot)} aria-hidden /> : null}
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          {statLabel}
        </span>
      </div>
      <div className="mt-2 text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </div>
    </Link>
  );
}
