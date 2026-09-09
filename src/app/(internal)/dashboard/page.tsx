import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, History, TriangleAlert } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import {
  getPortfolioSummary,
  listProjectsRequiringAttention,
  listSupplierBottlenecks,
  listUpcomingDeadlines,
} from "@/server/services/dashboard";
import { listRecentActivity } from "@/server/services/timeline";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { Panel } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableScroll,
  TableShell,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDeadlineParts, formatRelative, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(name: string) {
  const hour = new Date().getHours();
  const firstName = name.split(" ")[0];
  if (hour < 12) return `Bom dia, ${firstName}.`;
  if (hour < 18) return `Boa tarde, ${firstName}.`;
  return `Boa noite, ${firstName}.`;
}

export default async function DashboardPage() {
  const user = await requireInternalUser();
  const dict = getDictionary(localeFromLanguage(user.language));
  const locale = localeFromLanguage(user.language);

  const [summary, attention, deadlines, activity, bottlenecks] = await Promise.all([
    getPortfolioSummary(user),
    listProjectsRequiringAttention(user),
    listUpcomingDeadlines(user),
    listRecentActivity(user),
    listSupplierBottlenecks(user),
  ]);

  return (
    <>
      <PageHeader
        title={greeting(user.name)}
        description="Veja o que está acontecendo nos seus projetos."
      />

      {/* Portfolio — four numbers, no charts. */}
      <Panel className="mb-8">
        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          <Stat label="Total de projetos" value={summary.total} href="/projects" />
          <Stat label="Em dia" value={summary.onTrack} tone="ok" href="/projects?tab=ON_TRACK" />
          <Stat label="Em risco" value={summary.atRisk} tone="warn" href="/projects?tab=AT_RISK" />
          <Stat label="Bloqueados" value={summary.blocked} tone="risk" href="/projects?tab=BLOCKED" />
        </div>
      </Panel>

      {/* Projects requiring attention */}
      <section className="mb-8">
        <SectionHeader
          title="Projetos que precisam de atenção"
          description="Projetos em risco ou bloqueados e o próximo passo de cada um."
          action={
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
            >
              Ver todos
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />

        <TableShell>
          {attention.length === 0 ? (
            <EmptyState
              icon={TriangleAlert}
              title="Nenhum projeto precisa de atenção."
              description="Todos os projetos do portfólio estão em dia."
              compact
            />
          ) : (
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Projeto</TH>
                    <TH>Fornecedor</TH>
                    <TH>Etapa</TH>
                    <TH>Responsável</TH>
                    <TH>Status</TH>
                    <TH>Próximo passo</TH>
                  </TR>
                </THead>
                <TBody>
                  {attention.map((project) => {
                    const status = meta.project(project.status, dict);
                    return (
                      <TR key={project.id} interactive>
                        <TD>
                          <Link href={`/projects/${project.id}`} className="block hover:underline">
                            <CellStack title={project.name} subtitle={project.projectCode} />
                          </Link>
                        </TD>
                        <TD className="text-[13px] text-ink-soft">{project.supplier.name}</TD>
                        <TD className="text-[13px] text-ink-soft">
                          {label.stageKey(project.currentStage, dict)}
                        </TD>
                        <TD className="text-[13px] text-ink-soft">{project.owner.name}</TD>
                        <TD>
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </TD>
                        <TD className="max-w-[240px] text-[13px] text-ink-soft">
                          <span className="block truncate">
                            {project.nextStep?.title ?? project.blockerNote ?? "—"}
                          </span>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </TableShell>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming deadlines */}
        <section>
          <SectionHeader title="Próximos prazos" description="Tarefas com vencimento próximo." />
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

        {/* Recent activity */}
        <section>
          <SectionHeader title="Atividade recente" description="Últimos eventos do portfólio." />
          <Panel>
            {activity.length === 0 ? (
              <EmptyState icon={History} title="Nenhuma atividade ainda." compact />
            ) : (
              <ul className="divide-y divide-line-soft">
                {activity.map((event) => (
                  <li key={event.id} className="px-5 py-3.5">
                    <Link href={`/projects/${event.projectId}`} className="group block">
                      <p className="text-sm text-ink group-hover:underline">{event.description}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {event.project.name}
                        {event.actor ? ` · ${event.actor.name}` : ""} ·{" "}
                        {formatRelative(event.createdAt, locale)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>

      {/* Supplier bottlenecks */}
      {bottlenecks.length > 0 ? (
        <section className="mt-8">
          <SectionHeader
            title="Fornecedores com pendências"
            description="Quem precisa responder para destravar os projetos."
          />
          <Panel>
            <ul className="divide-y divide-line-soft">
              {bottlenecks.map((supplier) => {
                const status = meta.supplier(supplier.status, dict);
                return (
                  <li key={supplier.id}>
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-subtle"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{supplier.name}</p>
                        <p className="mt-0.5 text-[13px] text-muted">{supplier.country}</p>
                      </div>
                      <div className="flex items-center gap-5 text-[13px]">
                        <span className="text-ink-soft">
                          <span className="font-semibold tabular-nums">{supplier.openCount}</span>{" "}
                          <span className="text-muted">pendências</span>
                        </span>
                        {supplier.overdueCount > 0 ? (
                          <span className="font-medium text-risk tabular-nums">
                            {supplier.overdueCount} atrasadas
                          </span>
                        ) : null}
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </section>
      ) : null}
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
      className="group border-b border-line px-5 py-4 transition-colors last:border-b-0 hover:bg-subtle sm:border-b-0"
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
