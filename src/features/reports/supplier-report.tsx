import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplierReport } from "@/server/services/reports";
import type { DocumentStatus } from "@/server/services/documents";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { FigureStrip, HealthTable } from "@/features/reports/report-parts";
import { PrintButton } from "@/features/reports/print-button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import { daysUntil, formatDate, formatDateShort } from "@/lib/format";
import type { SessionUser } from "@/types/auth";
import { cn } from "@/lib/utils";

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-3 text-body text-muted">{children}</p>;

/** One company: its projects' health, what it owes, what it sent and how fast it answers. */
export async function SupplierReport({ user, supplierId, locale, dict }: { user: SessionUser; supplierId: string; locale: Locale; dict: Dictionary }) {
  const report = await getSupplierReport(user, supplierId);
  if (!report) notFound();
  const { supplier, projects, performance, owed, received } = report;
  const late = owed.filter((request) => (daysUntil(request.dueDate) ?? 0) < 0).length;
  const blockedOrRisk = projects.filter((project) => project.status === "BLOCKED" || project.status === "AT_RISK").length;

  return (
    <article className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/reports" }, { label: supplier.name }]}
        title={`Relatório · ${supplier.name}`}
        description={`${supplier.country}${supplier.primaryContact ? ` · contato ${supplier.primaryContact}` : ""} · gerado em ${formatDate(new Date(), locale)}`}
        actions={
          <>
            <PrintButton />
            <Button asChild variant="secondary" size="sm" className="print:hidden">
              <Link href={`/regulatory?supplier=${supplier.id}`}>Abrir pasta</Link>
            </Button>
          </>
        }
      />

      <div className="mb-10">
        <FigureStrip
          figures={[
            { label: "Projetos ativos", value: projects.length, note: blockedOrRisk ? `${blockedOrRisk} em risco ou bloqueado${blockedOrRisk === 1 ? "" : "s"}` : "Todos em dia", tone: blockedOrRisk ? "warn" : undefined },
            { label: "Documentos devidos", value: owed.length, note: late ? `${late} com prazo vencido` : "Nenhum vencido", tone: late ? "risk" : owed.length ? "warn" : undefined },
            { label: "Aprovados", value: performance?.approved ?? 0, note: performance?.changesRequested ? `${performance.changesRequested} com correção pedida` : "Sem correções pedidas" },
            {
              label: "Resposta média",
              value: performance?.responseDays === null || performance?.responseDays === undefined ? "—" : `${performance.responseDays.toFixed(1)} dias`,
              note: "Do pedido ao envio",
            },
          ]}
        />
      </div>

      <Section title="Saúde dos projetos" count={projects.length} className="mb-10">
        {projects.length === 0 ? <Empty>Nenhum projeto ativo.</Empty> : <HealthTable rows={projects} dict={dict} locale={locale} showSupplier={false} />}
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="Documentos devidos" count={owed.length || undefined}>
          {owed.length === 0 ? (
            <Empty>Nada devido: tudo o que foi pedido já chegou.</Empty>
          ) : (
            <ul className="divide-y divide-line-faint border-y border-line-faint">
              {owed.map((request) => {
                const overdue = (daysUntil(request.dueDate) ?? 0) < 0;
                return (
                  <li key={request.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-body text-ink">{request.title}</span>
                      <span className="block text-meta text-muted">
                        {request.project.name}
                        {request.status === "REJECTED" ? " · correção pedida" : ""}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-meta tabular-nums", overdue ? "font-medium text-risk" : "text-muted")}>
                      {request.dueDate ? formatDateShort(request.dueDate, locale) : "sem prazo"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Últimos documentos recebidos" count={received.length || undefined}>
          {received.length === 0 ? (
            <Empty>Nenhum documento recebido.</Empty>
          ) : (
            <ul className="divide-y divide-line-faint border-y border-line-faint">
              {received.map((document) => (
                <li key={document.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-body text-ink">{document.name}</span>
                    <span className="block text-meta text-muted">
                      {document.project.name} · {meta.document(document.status as DocumentStatus, dict).label}
                    </span>
                  </span>
                  <span className="shrink-0 text-meta text-muted tabular-nums">{formatDateShort(document.updatedAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </article>
  );
}
