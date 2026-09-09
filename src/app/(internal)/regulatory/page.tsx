import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { listDocumentRequests } from "@/server/services/documents";
import { db } from "@/server/db";
import { projectScope } from "@/server/authz/scopes";
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
import { meta } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Regulatório" };

/**
 * Portfolio-wide regulatory view: every open request and every regulatory item
 * across projects, so the regulatory team has one queue instead of many.
 */
export default async function RegulatoryPage() {
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [requests, items] = await Promise.all([
    listDocumentRequests(user),
    db.regulatoryItem.findMany({
      where: { project: projectScope(user) },
      include: { project: { select: { id: true, name: true, projectCode: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 100,
    }),
  ]);

  const openRequests = requests.filter((request) =>
    ["PENDING", "SUBMITTED", "IN_REVIEW", "REJECTED"].includes(request.status),
  );

  return (
    <>
      <PageHeader
        title="Regulatório"
        description="Solicitações e itens regulatórios de todo o portfólio."
      />

      <section className="mb-8">
        <SectionHeader
          title="Solicitações em aberto"
          description="Documentos pedidos aos fornecedores que ainda não foram concluídos."
        />
        <TableShell>
          {openRequests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nenhuma solicitação em aberto."
              description="Todas as solicitações aos fornecedores foram concluídas."
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
                    const status = meta.request(request.status, dict);
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
                        <TD className="text-[13px] text-ink-soft">{request.project.name}</TD>
                        <TD className="text-[13px] text-ink-soft">{request.supplier.name}</TD>
                        <TD className="text-[13px] text-ink-soft">{request.requestedBy.name}</TD>
                        <TD
                          className={cn(
                            "text-[13px] whitespace-nowrap",
                            late ? "font-medium text-risk" : "text-ink-soft",
                          )}
                        >
                          {formatDate(request.dueDate, locale)}
                          {late ? ` · ${Math.abs(remaining)}d` : ""}
                        </TD>
                        <TD>
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
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
                    const status = meta.regulatory(item.status, dict);
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
                        <TD className="text-[13px] text-ink-soft">{item.project.name}</TD>
                        <TD className="text-[13px] text-ink-soft">{item.authority ?? "—"}</TD>
                        <TD className="text-[13px] text-ink-soft">{item.requestedFrom ?? "—"}</TD>
                        <TD className="text-[13px] whitespace-nowrap text-ink-soft">
                          {formatDate(item.dueDate, locale)}
                        </TD>
                        <TD>
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
