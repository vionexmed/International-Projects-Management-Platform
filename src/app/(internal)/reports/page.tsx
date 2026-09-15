import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { redirect } from "next/navigation";
import { requireInternalUser, can } from "@/server/auth/current-user";
import {
  getDeadlineBreakdown,
  getPortfolioBreakdown,
  getRegulatoryPerformance,
  getSupplierPerformance,
  type Slice,
} from "@/server/services/analytics";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
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
import type { ProjectStatus, StageKey } from "@/generated/prisma";

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

  const [portfolio, deadlines, suppliers, regulatory] = await Promise.all([
    getPortfolioBreakdown(user),
    getDeadlineBreakdown(user),
    getSupplierPerformance(user),
    getRegulatoryPerformance(user),
  ]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Como o portfólio está se comportando. Cada número leva à lista que o originou."
      />

      {/* Portfolio health */}
      <section className="mb-8">
        <SectionHeader
          title="Saúde do portfólio"
          description={`${portfolio.total} projeto(s) ativos.`}
        />
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
      </section>

      {/* Deadlines */}
      <section className="mb-8">
        <SectionHeader
          title="Prazos"
          description={`${deadlines.openTotal} tarefa(s) em aberto.`}
        />
        <Panel>
          <div className="stat-grid grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            <MetricLink
              label="Atrasadas"
              value={deadlines.overdue}
              tone="risk"
              href="/tasks?tab=OVERDUE"
            />
            <MetricLink label="Próximos 7 dias" value={deadlines.thisWeek} href="/tasks" />
            <MetricLink label="Próximos 30 dias" value={deadlines.thisMonth} href="/tasks" />
            <MetricLink label="Sem prazo" value={deadlines.undated} href="/tasks" />
          </div>
        </Panel>
      </section>

      {/* Regulatory performance */}
      <section className="mb-8">
        <SectionHeader
          title="Desempenho regulatório"
          description={`${regulatory.total} solicitação(ões) registradas.`}
        />
        <Panel>
          <div className="stat-grid grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 sm:divide-x">
            <MetricLink
              label="Aguardando fornecedor"
              value={regulatory.pending}
              href="/regulatory?status=supplier"
            />
            <MetricLink
              label="Enviadas"
              value={regulatory.submitted}
              href="/regulatory?status=review"
            />
            <MetricLink
              label="Em análise"
              value={regulatory.inReview}
              href="/regulatory?status=review"
            />
            <MetricLink
              label="Correção pedida"
              value={regulatory.rejected}
              href="/regulatory?status=supplier"
            />
            <MetricLink
              label="Aprovadas"
              value={regulatory.approved}
              tone="ok"
              href="/regulatory?status=all"
            />
            <MetricLink
              label="Atrasadas"
              value={regulatory.overdue}
              tone="risk"
              href="/regulatory?status=overdue"
            />
          </div>

          <div className="border-t border-line px-5 py-4">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              Rodadas de análise
            </p>
            {regulatory.review.rounds === 0 ? (
              <p className="mt-1.5 text-[13px] text-muted">
                Nenhuma análise registrada ainda. O histórico estruturado começa a ser gravado a
                partir da primeira decisão — rodadas anteriores a ele não foram reconstruídas.
              </p>
            ) : (
              <p className="mt-1.5 text-[13px] text-ink-soft">
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
                  <span className="text-muted">
                    {" "}
                    · desde {formatDate(regulatory.review.since, locale)}
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </Panel>
      </section>

      {/* Supplier performance */}
      <section className="mb-8">
        <SectionHeader
          title="Desempenho dos fornecedores"
          description="Solicitações abertas, atrasos e tempo médio de resposta."
          action={
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
            >
              Ver fornecedores
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />
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
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="block font-medium text-ink after:absolute after:inset-0 after:content-['']"
                        >
                          {supplier.name}
                          <span className="mt-0.5 block text-[13px] font-normal text-muted">
                            {supplier.country}
                          </span>
                        </Link>
                      </TD>
                      <TD label="Em aberto" className="text-[13px] text-ink-soft tabular-nums">
                        {supplier.open}
                      </TD>
                      <TD
                        label="Atrasadas"
                        className={
                          supplier.overdue > 0
                            ? "text-[13px] font-medium text-risk tabular-nums"
                            : "text-[13px] text-ink-soft tabular-nums"
                        }
                      >
                        {supplier.overdue}
                      </TD>
                      <TD label="Aprovadas" className="text-[13px] text-ink-soft tabular-nums">
                        {supplier.approved}
                      </TD>
                      <TD
                        label="Correções pedidas"
                        className="text-[13px] text-ink-soft tabular-nums"
                      >
                        {supplier.changesRequested}
                      </TD>
                      <TD label="Resposta média" className="text-[13px] text-ink-soft tabular-nums">
                        {/* An average of nothing is not zero. */}
                        {supplier.responseDays === null
                          ? "—"
                          : `${supplier.responseDays.toFixed(1)} dias`}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </TableShell>
      </section>

      {/* Exports */}
      <section>
        <SectionHeader title="Exportações" description="Os mesmos dados em CSV, linha a linha." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {EXPORTS.map((report) => (
            <Panel key={report.key} className="flex flex-col justify-between p-5">
              <div>
                <p className="text-sm font-semibold text-ink">{report.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{report.description}</p>
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
      </section>
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
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{slice.label}</span>
                <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-raised">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${share}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-[13px] font-semibold text-ink tabular-nums">
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

function MetricLink({
  label: metricLabel,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone?: "ok" | "risk";
  href: string;
}) {
  return (
    <Link href={href} className="px-5 py-4 transition-colors hover:bg-subtle">
      <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        {metricLabel}
      </div>
      <div
        className={
          tone === "risk" && value > 0
            ? "mt-2 text-[24px] leading-none font-semibold text-risk tabular-nums"
            : tone === "ok" && value > 0
              ? "mt-2 text-[24px] leading-none font-semibold text-ok tabular-nums"
              : "mt-2 text-[24px] leading-none font-semibold text-ink tabular-nums"
        }
      >
        {value}
      </div>
    </Link>
  );
}
