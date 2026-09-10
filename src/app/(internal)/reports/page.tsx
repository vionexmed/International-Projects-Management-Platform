import type { Metadata } from "next";
import { Download, PieChart } from "lucide-react";
import { redirect } from "next/navigation";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { getPortfolioProgress, getPortfolioSummary } from "@/server/services/dashboard";
import { listSuppliers } from "@/server/services/suppliers";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableScroll,
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

export const metadata: Metadata = { title: "Relatórios" };

const REPORTS = [
  { key: "portfolio", title: "Portfolio overview", description: "Todos os projetos com etapa, status e progresso." },
  { key: "regulatory", title: "Regulatory status", description: "Solicitações de documentos e seus prazos." },
  { key: "suppliers", title: "Supplier overview", description: "Fornecedores com pendências e atrasos." },
];

export default async function ReportsPage() {
  const user = await requireInternalUser();
  if (!can(user, "report:read")) redirect("/dashboard");

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [summary, projects, suppliers] = await Promise.all([
    getPortfolioSummary(user),
    getPortfolioProgress(user),
    listSuppliers(user),
  ]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Visões consolidadas do portfólio. Exporte em CSV para análise externa."
      />

      <section className="mb-8">
        <SectionHeader title="Exportações" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {REPORTS.map((report) => (
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

      <section className="mb-8">
        <SectionHeader title="Portfolio overview" />
        <Panel>
          <div className="stat-grid grid grid-cols-2 divide-line border-b border-line sm:grid-cols-5 sm:divide-x">
            <Metric label="Total" value={summary.total} />
            <Metric label="Em dia" value={summary.onTrack} />
            <Metric label="Em risco" value={summary.atRisk} />
            <Metric label="Bloqueados" value={summary.blocked} />
            <Metric label="Concluídos" value={summary.completed} />
          </div>

          {projects.length === 0 ? (
            <EmptyState icon={PieChart} title="Nenhum projeto no portfólio." compact />
          ) : (
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Projeto</TH>
                    <TH>Fornecedor</TH>
                    <TH>Etapa</TH>
                    <TH>Responsável</TH>
                    <TH className="w-40">Progresso</TH>
                    <TH>Lançamento</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {projects.map((project) => {
                    const status = meta.project(project.status, dict);
                    return (
                      <TR key={project.id}>
                        <TD>
                          <CellStack title={project.name} subtitle={project.projectCode} />
                        </TD>
                        <TD label="Fornecedor" className="text-[13px] text-ink-soft">{project.supplierName}</TD>
                        <TD label="Etapa" className="text-[13px] text-ink-soft">
                          {label.stageKey(project.currentStage, dict)}
                        </TD>
                        <TD label="Responsável" className="text-[13px] text-ink-soft">{project.ownerName}</TD>
                        <TD label="Progresso">
                          <div className="w-32">
                            <div className="mb-1 text-[13px] font-semibold text-ink tabular-nums">
                              {project.progress}%
                            </div>
                            <ProgressBar value={project.progress} />
                          </div>
                        </TD>
                        <TD label="Lançamento" className="text-[13px] whitespace-nowrap text-ink-soft">
                          {formatDate(project.targetLaunchDate, locale)}
                        </TD>
                        <TD label="Status">
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </Panel>
      </section>

      <section>
        <SectionHeader title="Supplier overview" />
        <Panel>
          <PanelHeader title="Fornecedores" description="Pendências abertas por fornecedor." />
          {suppliers.length === 0 ? (
            <EmptyState title="Nenhum fornecedor cadastrado." compact />
          ) : (
            <ul className="divide-y divide-line-soft">
              {suppliers.map((supplier) => {
                const status = meta.supplier(supplier.status, dict);
                return (
                  <li
                    key={supplier.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{supplier.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {supplier.country} · {supplier.projectCount} projeto(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-5 text-[13px]">
                      <span className="text-ink-soft tabular-nums">
                        {supplier.openTaskCount} pendências
                      </span>
                      {supplier.overdueTaskCount > 0 ? (
                        <span className="font-medium text-risk tabular-nums">
                          {supplier.overdueTaskCount} atrasadas
                        </span>
                      ) : null}
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>
    </>
  );
}

function Metric({ label: metricLabel, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        {metricLabel}
      </div>
      <div className="mt-2 text-[24px] leading-none font-semibold text-ink tabular-nums">{value}</div>
    </div>
  );
}
