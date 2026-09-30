import "server-only";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { countDocumentRequestsByQueue } from "@/server/services/documents";
import { getDeadlineBreakdown, getPortfolioBreakdown, getRegulatoryPerformance, getSupplierPerformance, type Slice } from "@/server/services/analytics";
import type { HealthRow } from "@/server/services/reports";
import type { ProjectStatus } from "@/server/services/projects";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableScroll, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FigureStrip, HealthTable, HealthTag } from "@/features/reports/report-parts";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import type { SessionUser } from "@/types/auth";
import type { StageKey } from "@/generated/prisma";
import { cn } from "@/lib/utils";

const WORST: ProjectStatus[] = ["BLOCKED", "AT_RISK", "ON_TRACK", "COMPLETED"];

/**
 * The whole portfolio as one report: headline figures, every project's
 * health with its reason, every company, and where the work sits. Tables and
 * short lists — the numbers do the talking.
 */
export async function PortfolioReport({ user, rows, locale, dict }: { user: SessionUser; rows: HealthRow[]; locale: Locale; dict: Dictionary }) {
  const [portfolio, deadlines, performance, regulatory, queue] = await Promise.all([
    getPortfolioBreakdown(user),
    getDeadlineBreakdown(user),
    getSupplierPerformance(user),
    getRegulatoryPerformance(user),
    countDocumentRequestsByQueue(user),
  ]);
  const byStatus = (status: ProjectStatus) => rows.filter((row) => row.status === status).length;
  const blocked = byStatus("BLOCKED");
  const atRisk = byStatus("AT_RISK");

  const companies = new Map<string, { id: string; name: string; country: string; projects: HealthRow[] }>();
  for (const row of rows) {
    const company = companies.get(row.supplier.id) ?? { ...row.supplier, projects: [] };
    company.projects.push(row);
    companies.set(row.supplier.id, company);
  }
  const perf = new Map(performance.map((row) => [row.id, row]));
  const companyRows = [...companies.values()]
    .map((company) => {
      const worst = WORST.find((status) => company.projects.some((project) => project.status === status)) ?? "ON_TRACK";
      return { ...company, worst, perf: perf.get(company.id) };
    })
    .sort((a, b) => WORST.indexOf(a.worst) - WORST.indexOf(b.worst) || a.name.localeCompare(b.name, "pt-BR"));

  if (rows.length === 0) {
    return <EmptyState title="Nenhum projeto no portfólio." description="Os relatórios aparecem assim que houver projetos." />;
  }

  return (
    <>
      <div className="mb-10">
        <FigureStrip
          figures={[
            { label: "Projetos ativos", value: rows.length, note: `${byStatus("ON_TRACK")} em dia` },
            { label: "Em risco", value: atRisk, note: atRisk ? "Atrasos ou prazos críticos" : "Nenhum", tone: atRisk ? "warn" : undefined },
            { label: "Bloqueados", value: blocked, note: blocked ? "Precisam de uma decisão" : "Nenhum", tone: blocked ? "risk" : undefined },
            {
              label: "Tarefas atrasadas",
              value: deadlines.overdue,
              note: `${deadlines.thisWeek} ${deadlines.thisWeek === 1 ? "vence" : "vencem"} em 7 dias`,
              tone: deadlines.overdue ? "risk" : undefined,
            },
            {
              label: "Documentos pendentes",
              value: queue.supplier,
              note: `${queue.review} aguardando análise`,
              tone: queue.overdue ? "warn" : undefined,
            },
          ]}
        />
      </div>

      <Section title="Saúde por projeto" count={rows.length} description="Do mais crítico ao mais tranquilo. Clique para o relatório do projeto." className="mb-10">
        <HealthTable rows={rows} dict={dict} locale={locale} />
      </Section>

      <Section title="Empresas" count={companyRows.length} description="Clique para o relatório da empresa." className="mb-10">
        <TableShell>
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH className="min-w-52">Empresa</TH>
                  <TH className="w-px">Situação</TH>
                  <TH className="w-px" align="right">Projetos</TH>
                  <TH className="w-px" align="right">Docs pendentes</TH>
                  <TH className="w-px" align="right">Vencidos</TH>
                  <TH className="w-px" align="right">Aprovados</TH>
                  <TH className="w-px" align="right">Resposta média</TH>
                  <TH className="w-px print:hidden" />
                </TR>
              </THead>
              <TBody>
                {companyRows.map((company) => (
                  <TR key={company.id} interactive className="group">
                    <TD>
                      <Link href={`/reports?supplier=${company.id}`} className="block after:absolute after:inset-0">
                        <span className="block font-medium text-ink">{company.name}</span>
                        <span className="block text-meta text-muted">{company.country}</span>
                      </Link>
                    </TD>
                    <TD label="Situação">
                      <HealthTag status={company.worst} dict={dict} />
                    </TD>
                    <TD label="Projetos" align="right">{company.projects.length}</TD>
                    <TD label="Docs pendentes" align="right" className={cn((company.perf?.open ?? 0) > 0 && "font-medium text-warn")}>
                      {company.perf?.open ?? 0}
                    </TD>
                    <TD label="Vencidos" align="right" className={cn((company.perf?.overdue ?? 0) > 0 && "font-medium text-risk")}>
                      {company.perf?.overdue ?? 0}
                    </TD>
                    <TD label="Aprovados" align="right">{company.perf?.approved ?? 0}</TD>
                    <TD label="Resposta média" align="right" className="whitespace-nowrap">
                      {/* An average of nothing is not zero. */}
                      {company.perf?.responseDays == null ? "—" : `${company.perf.responseDays.toFixed(1)} dias`}
                    </TD>
                    <TD className="text-right print:hidden">
                      <span className="inline-flex items-center gap-1 text-meta font-medium text-brand-strong opacity-0 transition-opacity group-hover:opacity-100">
                        Relatório
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </TableShell>
      </Section>

      <Section title="Onde está o trabalho" className="mb-10">
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-3">
          <Breakdown
            title="Por etapa"
            total={portfolio.total}
            slices={portfolio.stage.map((slice) => ({ ...slice, label: label.stageKey(slice.key as StageKey, dict) }))}
          />
          <Breakdown title="Por país de origem" total={portfolio.total} slices={portfolio.country.map((slice) => ({ ...slice, label: slice.key }))} />
          <div>
            <h3 className="mb-2 text-meta font-medium text-muted">Prazos das tarefas abertas</h3>
            <dl className="divide-y divide-line-faint border-y border-line-faint">
              {[
                { label: "Atrasadas", value: deadlines.overdue, href: "/tasks?tab=OVERDUE", tone: deadlines.overdue ? "text-risk" : "" },
                { label: "Próximos 7 dias", value: deadlines.thisWeek },
                { label: "Próximos 30 dias", value: deadlines.thisMonth },
                { label: "Sem prazo", value: deadlines.undated },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2">
                  <dt className="text-body text-ink-soft">
                    {item.href ? (
                      <Link href={item.href} className="hover:text-ink hover:underline">
                        {item.label}
                      </Link>
                    ) : (
                      item.label
                    )}
                  </dt>
                  <dd className={cn("text-body font-semibold text-ink tabular-nums", item.tone)}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section title="Análise regulatória">
        <p className="max-w-3xl text-body text-ink-soft">
          {regulatory.review.rounds === 0 ? (
            "Nenhuma análise registrada ainda. O histórico começa na primeira decisão."
          ) : (
            <>
              <strong className="font-semibold text-ink tabular-nums">{regulatory.review.rounds}</strong> decisões registradas:{" "}
              <strong className="font-semibold text-ink tabular-nums">{regulatory.review.approvals}</strong> aprovações e{" "}
              <strong className="font-semibold text-ink tabular-nums">{regulatory.review.changesRequested}</strong> pedidos de correção
              {regulatory.review.since ? <span className="text-muted"> · desde {formatDate(regulatory.review.since, locale)}</span> : null}.
              {queue.overdue > 0 ? (
                <>
                  {" "}
                  <Link href="/regulatory?status=overdue" className="font-medium text-risk hover:underline">
                    {queue.overdue} {queue.overdue === 1 ? "solicitação vencida" : "solicitações vencidas"}
                  </Link>{" "}
                  aguardando o fornecedor.
                </>
              ) : null}
            </>
          )}
        </p>
      </Section>
    </>
  );
}

/** A share of the portfolio: a label, a thin bar and the count, as a list. */
function Breakdown({ title, total, slices }: { title: string; total: number; slices: (Slice & { label: string })[] }) {
  return (
    <div>
      <h3 className="mb-2 text-meta font-medium text-muted">{title}</h3>
      <ul className="divide-y divide-line-faint border-y border-line-faint">
        {slices.map((slice) => {
          const share = total > 0 ? Math.round((slice.count / total) * 100) : 0;
          return (
            <li key={slice.key}>
              <Link href={slice.href} className="group flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-body text-ink-soft group-hover:text-ink">{slice.label}</span>
                <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-line-soft">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                </span>
                <span className="w-6 shrink-0 text-right text-body font-semibold text-ink tabular-nums">{slice.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
