import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { redirect } from "next/navigation";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { countDocumentRequestsByQueue } from "@/server/services/documents";
import {
  getDeadlineBreakdown,
  getPortfolioBreakdown,
  getRegulatoryPerformance,
  getSupplierPerformance,
  type Slice,
} from "@/server/services/analytics";
import type { ProjectStatus } from "@/server/services/projects";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/ui/section";
import { Panel, PanelHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StageKey } from "@/generated/prisma";

export const metadata: Metadata = { title: "Relatórios" };

const EXPORTS = [
  { key: "portfolio", title: "Portfolio overview", description: "Todos os projetos com etapa, status e progresso." },
  { key: "regulatory", title: "Regulatory status", description: "Solicitações de documentos e seus prazos." },
  { key: "suppliers", title: "Supplier overview", description: "Fornecedores com pendências e atrasos." },
];

/**
 * What the operation's data is saying.
 *
 * Reports used to render the portfolio table again, with the same columns as
 * `/projects` and no aggregation — which made it a worse version of a screen
 * that already existed. There is not a single row of project data on this page
 * now: only counts, shares and averages, each one a link into the operational
 * list that holds the rows behind the number.
 *
 * Nothing here is estimated. Where the data cannot answer honestly — the mean
 * response time of a supplier who has never answered, the review history
 * before the table existed — the page says so instead of printing a zero.
 */
export default async function ReportsPage() {
  const user = await requireInternalUser();
  if (!can(user, "report:read")) redirect("/dashboard");

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  /**
   * `queue` comes from the same function `/regulatory` uses for its tabs, so a
   * number here and the list it links to cannot disagree: "12 atrasadas" opens
   * exactly those twelve. Deriving them separately is how a report starts
   * lying by one.
   */
  const [portfolio, deadlines, suppliers, regulatory, queue] = await Promise.all([
    getPortfolioBreakdown(user),
    getDeadlineBreakdown(user),
    getSupplierPerformance(user),
    getRegulatoryPerformance(user),
    countDocumentRequestsByQueue(user),
  ]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Como o portfólio está se comportando. Cada número leva à lista que o originou."
      />

      {/* Portfolio health */}
      <Section title="Saúde do portfólio" count={portfolio.total} className="mb-10">
        {portfolio.total === 0 ? (
          <Panel>
            <EmptyState title="Nenhum projeto no portfólio." compact />
          </Panel>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Distribution
              title="Por status"
              total={portfolio.total}
              slices={portfolio.status.map((slice) => ({
                ...slice,
                label: meta.project(slice.key as ProjectStatus, dict).label,
              }))}
            />
            <Distribution
              title="Por etapa"
              total={portfolio.total}
              slices={portfolio.stage.map((slice) => ({
                ...slice,
                label: label.stageKey(slice.key as StageKey, dict),
              }))}
            />
            <Distribution
              title="Por país"
              total={portfolio.total}
              slices={portfolio.country.map((slice) => ({ ...slice, label: slice.key }))}
            />
          </div>
        )}
      </Section>

      {/* Deadlines */}
      <Section title="Prazos" count={deadlines.openTotal} className="mb-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Atrasadas"
            value={deadlines.overdue}
            href="/tasks?tab=OVERDUE"
            delta={deadlines.overdue > 0 ? "Ação necessária" : undefined}
            deltaTone="risk"
          />
          {/*
            No link on these three: `/tasks` has no filter that reproduces
            them, and a link that lands on a different set is worse than no
            link — it quietly contradicts the number it came from.
          */}
          <StatCard label="Próximos 7 dias" value={deadlines.thisWeek} />
          <StatCard label="Próximos 30 dias" value={deadlines.thisMonth} />
          <StatCard label="Sem prazo" value={deadlines.undated} />
        </div>
      </Section>

      {/* Regulatory performance */}
      <Section title="Desempenho regulatório" count={regulatory.total} className="mb-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Aguardando fornecedor"
            value={queue.supplier}
            href="/regulatory?status=supplier"
          />
          <StatCard
            label="Aguardando análise"
            value={queue.review}
            href="/regulatory?status=review"
          />
          <StatCard label="Aprovadas" value={queue.approved} href="/regulatory?status=approved" />
          <StatCard
            label="Atrasadas"
            value={queue.overdue}
            href="/regulatory?status=overdue"
            delta={queue.overdue > 0 ? "Ação necessária" : undefined}
            deltaTone="risk"
          />
        </div>

        <div className="mt-4 rounded-lg bg-raised/70 px-4 py-3">
          <p className="text-meta font-medium text-muted">Rodadas de análise</p>
          {regulatory.review.rounds === 0 ? (
            <p className="mt-1.5 text-body text-muted">
              Nenhuma análise registrada ainda. O histórico estruturado começa a ser gravado a
              partir da primeira decisão — rodadas anteriores a ele não foram reconstruídas.
            </p>
          ) : (
            <p className="mt-1.5 text-body text-ink-soft">
              <span className="font-semibold text-ink tabular-nums">
                {regulatory.review.rounds}
              </span>{" "}
              decisões registradas ·{" "}
              <span className="font-semibold text-ink tabular-nums">
                {regulatory.review.approvals}
              </span>{" "}
              aprovações ·{" "}
              <span className="font-semibold text-ink tabular-nums">
                {regulatory.review.changesRequested}
              </span>{" "}
              pedidos de correção
              {regulatory.review.since ? (
                <span className="text-muted"> · desde {formatDate(regulatory.review.since, locale)}</span>
              ) : null}
            </p>
          )}
        </div>
      </Section>

      {/* Supplier performance */}
      <Section
        title="Desempenho dos fornecedores"
        className="mb-10"
        action={
          <Link
            href="/suppliers"
            className="inline-flex items-center gap-1.5 text-body font-medium text-brand-strong hover:underline"
          >
            Ver fornecedores
            <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <TableShell>
          {suppliers.length === 0 ? (
            <EmptyState title="Nenhuma solicitação registrada." compact />
          ) : (
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Fornecedor</TH>
                    <TH>Em aberto</TH>
                    <TH>Atrasadas</TH>
                    <TH>Aprovadas</TH>
                    <TH>Correções pedidas</TH>
                    <TH>Resposta média</TH>
                  </TR>
                </THead>
                <TBody>
                  {suppliers.map((supplier) => (
                    <TR key={supplier.id} interactive>
                      <TD>
                        <CellStack title={supplier.name} subtitle={supplier.country} />
                      </TD>
                      <TD label="Em aberto" className="tabular-nums">
                        {supplier.open}
                      </TD>
                      <TD
                        label="Atrasadas"
                        className={cn("tabular-nums", supplier.overdue > 0 && "font-medium text-risk")}
                      >
                        {supplier.overdue}
                      </TD>
                      <TD label="Aprovadas" className="tabular-nums">
                        {supplier.approved}
                      </TD>
                      <TD label="Correções pedidas" className="tabular-nums">
                        {supplier.changesRequested}
                      </TD>
                      <TD label="Resposta média" className="tabular-nums">
                        {/* An average of nothing is not zero. */}
                        {supplier.responseDays === null ? "" : `${supplier.responseDays.toFixed(1)} dias`}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </TableShell>
      </Section>

      {/* Exports */}
      <Section title="Exportações" description="Os mesmos dados em CSV, linha a linha.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {EXPORTS.map((report) => (
            <Panel key={report.key} className="flex flex-col justify-between p-5">
              <div>
                <p className="text-title font-semibold text-ink">{report.title}</p>
                <p className="mt-1 text-meta leading-relaxed text-muted">{report.description}</p>
              </div>
              <Button variant="secondary" size="sm" className="mt-4 self-start" asChild>
                <a href={`/api/reports/${report.key}`} download>
                  <Download />
                  Export CSV
                </a>
              </Button>
            </Panel>
          ))}
        </div>
      </Section>
    </>
  );
}

/** A share, its count, and the way to the rows behind it. */
function Distribution({
  title,
  total,
  slices,
}: {
  title: string;
  total: number;
  slices: (Slice & { label: string })[];
}) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <ul className="divide-y divide-line-soft">
        {slices.map((slice) => {
          const share = total > 0 ? Math.round((slice.count / total) * 100) : 0;
          return (
            <li key={slice.key}>
              <Link
                href={slice.href}
                className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-subtle"
              >
                <span className="min-w-0 flex-1 truncate text-body text-ink">{slice.label}</span>
                <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-raised">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${share}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-body font-semibold text-ink tabular-nums">
                  {slice.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
