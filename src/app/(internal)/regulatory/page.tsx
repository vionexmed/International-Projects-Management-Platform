import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { getSupplierFolder, listSupplierFolders } from "@/server/services/regulatory-folders";
import { Button } from "@/components/ui/button";
import { DocumentsTable } from "@/features/documents/documents-table";
import { PendingRequests, ProjectFolderTable, SupplierFolderGrid } from "@/features/regulatory/folder-views";
import type { SessionUser } from "@/types/auth";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  countDocumentRequestsByQueue,
  isRequestQueueFilter,
  pageDocumentRequests,
  type RequestQueueFilter,
  type RequestStatus,
} from "@/server/services/documents";
import type { TaskStatus } from "@/server/services/tasks";
import { db } from "@/server/db";
import { projectScope } from "@/server/authz/scopes";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/ui/section";
import { StatusFilter } from "@/components/app/status-filter";
import { Pagination } from "@/components/app/pagination";
import { Panel } from "@/components/ui/card";
import { StatusIcon, type StatusIconKind } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tone } from "@/lib/status";
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
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDate, formatDateShort } from "@/lib/format";
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
/** A generic tone → glyph map: dense rows read status as a shape first, the tone gives its colour. */
const TONE_ICON: Record<Tone, StatusIconKind> = {
  ok: "done",
  warn: "waiting",
  risk: "blocked",
  info: "in-progress",
  neutral: "open",
};

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

  if (params.supplier) {
    return (
      <SupplierFolderView user={user} supplierId={params.supplier} projectId={params.project} locale={locale} dict={dict} />
    );
  }

  const queue: RequestQueueFilter = isRequestQueueFilter(params.status) ? params.status : "open";

  const [folders, requests, counts, items] = await Promise.all([
    listSupplierFolders(user),
    pageDocumentRequests(user, { queue, page: Number(params.page ?? 1) || 1, perPage: 25 }),
    countDocumentRequestsByQueue(user),
    db.task.findMany({
      // A request's mirror task is the same pendency as the request listed
      // above; only the request can be resolved, so the mirror stays out.
      where: { project: projectScope(user), category: "REGULATORY", requests: { none: {} } },
      include: { project: { select: { id: true, name: true, projectCode: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 100,
    }),
  ]);

  const openRequests = requests.items;

  return (
    <>
      <PageHeader
        title="Regulatório"
        description="Uma pasta por fornecedor, com os projetos e todos os documentos enviados."
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/regulatory?status=overdue" className="font-medium text-risk hover:underline">
              {counts.overdue} {counts.overdue === 1 ? "solicitação atrasada" : "solicitações atrasadas"}
            </Link>
            <Link href="/regulatory?status=review" className="font-medium text-brand-strong hover:underline">
              {counts.review} aguardando análise
            </Link>
          </div>
        }
      />

      <Section title="Pastas" count={folders.length} className="mb-10">
        <SupplierFolderGrid folders={folders} locale={locale} />
      </Section>

      {/*
        The queue is chosen in the section header — one filter writing the
        same `status` param the tab strip did; the counts live in its menu,
        the section shows the current total once.
      */}
      <Section
        title="Solicitações"
        count={requests.total}
        className="mb-10"
        action={
          <StatusFilter
            paramKey="status"
            defaultValue="open"
            align="end"
            options={FILTERS.map((filter) => ({
              value: filter.key,
              label: filter.label,
              count: counts[filter.key],
              tone: filter.key === "overdue" ? "risk" : undefined,
            }))}
          />
        }
      >
        <TableShell>
          {openRequests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nenhuma solicitação neste recorte."
              description="Troque o filtro ao lado do título para ver as demais solicitações."
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
                    const late =
                      remaining !== null &&
                      remaining < 0 &&
                      ["PENDING", "REJECTED"].includes(request.status);

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
                        <TD label="Projeto">{request.project.name}</TD>
                        <TD label="Solicitado a">{request.supplier.name}</TD>
                        <TD label="Responsável">{request.requestedBy.name}</TD>
                        <TD label="Prazo" className={cn(late && "font-medium text-risk")}>
                          {request.dueDate ? formatDateShort(request.dueDate, locale) : "—"}
                          {late ? " · atrasado" : ""}
                        </TD>
                        <TD label="Status">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <StatusIcon kind={TONE_ICON[status.tone]} tone={status.tone} />
                            {status.label}
                          </span>
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
      </Section>

      <Section title="Itens regulatórios" count={items.length}>
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
                    const status = meta.task(item.status as TaskStatus, dict);
                    const remaining = daysUntil(item.dueDate);
                    const late =
                      remaining !== null &&
                      remaining < 0 &&
                      !["COMPLETED", "CANCELLED"].includes(item.status);
                    return (
                      <TR key={item.id} interactive>
                        <TD>
                          <Link
                            href={`/tasks/${item.id}`}
                            className="block after:absolute after:inset-0 after:content-['']"
                          >
                            <CellStack title={item.title} />
                          </Link>
                        </TD>
                        <TD label="Projeto">{item.project.name}</TD>
                        <TD label="Órgão">{item.authority ?? ""}</TD>
                        <TD label="Solicitado a">{item.requestedFrom ?? ""}</TD>
                        <TD label="Prazo" className={cn(late && "font-medium text-risk")}>
                          {item.dueDate ? formatDateShort(item.dueDate, locale) : "—"}
                          {late ? " · atrasado" : ""}
                        </TD>
                        <TD label="Status">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <StatusIcon kind={TONE_ICON[status.tone]} tone={status.tone} />
                            {status.label}
                          </span>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </Panel>
      </Section>
    </>
  );
}

/**
 * Inside a folder: a supplier (its projects as sub-folders, the documents
 * still owed and every document filed) or one of its projects.
 */
async function SupplierFolderView({
  user,
  supplierId,
  projectId,
  locale,
  dict,
}: {
  user: SessionUser;
  supplierId: string;
  projectId?: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const folder = await getSupplierFolder(user, supplierId, projectId);
  if (!folder) notFound();
  const { supplier, project, projects, documents, requests } = folder;
  const supplierHref = `/regulatory?supplier=${supplier.id}`;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Regulatório", href: "/regulatory" },
          project ? { label: supplier.name, href: supplierHref } : { label: supplier.name },
          ...(project ? [{ label: project.name }] : []),
        ]}
        title={project ? project.name : supplier.name}
        description={
          project
            ? [
                project.projectCode,
                `Etapa: ${label.stageKey(project.currentStage, dict)}`,
                `Responsável: ${project.owner.name}`,
                project.targetLaunchDate ? `Lançamento: ${formatDate(project.targetLaunchDate, locale)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : `${supplier.country} · ${projects.length} ${projects.length === 1 ? "projeto" : "projetos"} · ${documents.total} ${documents.total === 1 ? "documento" : "documentos"}`
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={project ? `/projects/${project.id}` : `/suppliers/${supplier.id}`}>
              {project ? "Abrir projeto" : "Ver fornecedor"}
            </Link>
          </Button>
        }
      />

      {!project ? (
        <Section title="Projetos" count={projects.length} className="mb-10">
          <ProjectFolderTable supplierId={supplier.id} projects={projects} locale={locale} dict={dict} />
        </Section>
      ) : null}

      {requests.length > 0 ? (
        <Section
          title="Aguardando documentos"
          count={requests.length}
          description="Solicitações em aberto: o que ainda deve chegar ou está em análise."
          className="mb-10"
        >
          <PendingRequests requests={requests} showProject={!project} locale={locale} dict={dict} />
        </Section>
      ) : null}

      <Section title={project ? "Documentos do projeto" : "Todos os documentos"} count={documents.total}>
        <TableShell>
          <DocumentsTable
            documents={documents.items}
            showProject={!project}
            locale={locale}
            dict={dict}
            emptyTitle="Nenhum documento nesta pasta."
            emptyDescription="Os arquivos enviados pelo fornecedor ou pela equipe aparecem aqui."
          />
        </TableShell>
        {documents.total > documents.items.length ? (
          <p className="mt-2 text-meta text-muted">
            Mostrando os {documents.items.length} mais recentes.{" "}
            <Link
              href={`/documents?supplier=${supplier.id}${project ? `&project=${project.id}` : ""}`}
              className="font-medium text-brand-strong hover:underline"
            >
              Ver todos em Documentos
            </Link>
          </p>
        ) : null}
      </Section>
    </>
  );
}
