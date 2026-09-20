import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import {
  countDocumentRequestsByQueue,
  isRequestQueueFilter,
  pageDocumentRequests,
  type DocumentStatus,
  type RequestQueueFilter,
  type RequestStatus,
} from "@/server/services/documents";
import { db } from "@/server/db";
import { projectScope } from "@/server/authz/scopes";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { TabsNav } from "@/components/app/tabs-nav";
import { Pagination } from "@/components/app/pagination";
import { Panel } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableFooter,
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
import { meta } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Regulatório" };

/**
 * Portfolio-wide regulatory view: every open request and every regulatory item
 * across projects, so the regulatory team has one queue instead of many.
 */
/**
 * The filters exist so that a number elsewhere can bring somebody here with
 * the question already narrowed — "12 atrasadas" lands on the twelve, not on
 * everything. Anything that shows a regulatory count links through these keys,
 * and the filtering happens in SQL, so the tab count, the rows and the pager
 * all describe the same set.
 */
const FILTERS: { key: RequestQueueFilter; label: string }[] = [
  { key: "open", label: "Em aberto" },
  { key: "supplier", label: "Aguardando fornecedor" },
  { key: "review", label: "Aguardando análise" },
  { key: "overdue", label: "Atrasadas" },
  { key: "approved", label: "Aprovadas" },
  { key: "all", label: "Todas" },
];

export default async function RegulatoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const queue: RequestQueueFilter = isRequestQueueFilter(params.status) ? params.status : "open";

  const [requests, counts, items] = await Promise.all([
    pageDocumentRequests(user, { queue, page: Number(params.page ?? 1) || 1, perPage: 25 }),
    countDocumentRequestsByQueue(user),
    db.regulatoryItem.findMany({
      where: { project: projectScope(user) },
      include: { project: { select: { id: true, name: true, projectCode: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 100,
    }),
  ]);

  const openRequests = requests.items;

  return (
    <>
      <PageHeader
        title="Regulatório"
        description="Solicitações e itens regulatórios de todo o portfólio."
      />

      <section className="mb-8">
        <SectionHeader
          title="Solicitações"
          description="Documentos pedidos aos fornecedores em todo o portfólio."
        />

        <TabsNav
          className="mb-4"
          items={FILTERS.map((filter) => ({
            href: filter.key === "open" ? "/regulatory" : `/regulatory?status=${filter.key}`,
            label: filter.label,
            count: counts[filter.key],
            active: filter.key === queue,
          }))}
        />
        <TableShell>
          {openRequests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nenhuma solicitação neste recorte."
              description="Troque o filtro acima para ver as demais solicitações."
              compact
            />
          ) : (
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Documento</TH>
                    <TH>Projeto</TH>
                    <TH>Solicitado a</TH>
                    <TH>Responsável</TH>
                    <TH>Prazo</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {openRequests.map((request) => {
                    const status = meta.request(request.status as RequestStatus, dict);
                    const remaining = daysUntil(request.dueDate);
                    const late = remaining !== null && remaining < 0 && request.status === "PENDING";

                    return (
                      <TR key={request.id} interactive>
                        <TD>
                          <Link
                            href={`/projects/${request.project.id}/regulatory`}
                            className="block after:absolute after:inset-0 after:content-['']"
                          >
                            <CellStack title={request.title} />
                          </Link>
                        </TD>
                        <TD label="Projeto" className="text-[13px] text-ink-soft">{request.project.name}</TD>
                        <TD label="Solicitado a" className="text-[13px] text-ink-soft">{request.supplier.name}</TD>
                        <TD label="Responsável" className="text-[13px] text-ink-soft">{request.requestedBy.name}</TD>
                        <TD label="Prazo"
                          className={cn(
                            "text-[13px] whitespace-nowrap",
                            late ? "font-medium text-risk" : "text-ink-soft",
                          )}
                        >
                          {formatDate(request.dueDate, locale)}
                          {late ? ` · ${Math.abs(remaining)}d` : ""}
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

          {openRequests.length > 0 ? (
            <TableFooter>
              <Pagination
                page={requests.page}
                pageCount={requests.pageCount}
                total={requests.total}
                perPage={requests.perPage}
                searchParams={params}
                label="solicitações"
              />
            </TableFooter>
          ) : null}
        </TableShell>
      </section>

      <section>
        <SectionHeader
          title="Itens regulatórios"
          description="Documentação exigida pelos órgãos reguladores em cada projeto."
        />
        <Panel>
          {items.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nenhum item regulatório cadastrado." compact />
          ) : (
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    <TH>Projeto</TH>
                    <TH>Órgão</TH>
                    <TH>Solicitado a</TH>
                    <TH>Prazo</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((item) => {
                    const status = meta.regulatory(item.status as DocumentStatus, dict);
                    return (
                      <TR key={item.id} interactive>
                        <TD>
                          <Link
                            href={`/projects/${item.project.id}/regulatory`}
                            className="block after:absolute after:inset-0 after:content-['']"
                          >
                            <CellStack title={item.title} />
                          </Link>
                        </TD>
                        <TD label="Projeto" className="text-[13px] text-ink-soft">{item.project.name}</TD>
                        <TD label="Órgão" className="text-[13px] text-ink-soft">{item.authority ?? "—"}</TD>
                        <TD label="Solicitado a" className="text-[13px] text-ink-soft">{item.requestedFrom ?? "—"}</TD>
                        <TD label="Prazo" className="text-[13px] whitespace-nowrap text-ink-soft">
                          {formatDate(item.dueDate, locale)}
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
    </>
  );
}
