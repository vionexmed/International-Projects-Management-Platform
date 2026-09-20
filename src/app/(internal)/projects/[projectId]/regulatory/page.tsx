import Link from "next/link";
import { Download, Inbox, ShieldCheck } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listDocumentRequests, type RequestStatus } from "@/server/services/documents";
import type { TaskStatus } from "@/server/services/tasks";
import { db } from "@/server/db";
import { Panel, PanelHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { RequestDocumentDialog } from "@/features/documents/request-document-dialog";
import { ReviewRequestDialog } from "@/features/documents/review-request-dialog";
import { RegulatoryItemDialog } from "@/features/projects/regulatory-item-dialog";
import { InlineStatusSelect } from "@/features/projects/inline-status-select";
import { updateRegulatoryItemAction } from "@/server/actions/stages";
import { canReviewDocumentType } from "@/server/authz/permissions";
import { orNotFound } from "@/server/authz/rsc";
import { StageDocumentList } from "@/features/projects/stage-document-list";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta } from "@/lib/labels";
import { formatDate, formatDateTime, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "WAITING", label: "Aguardando" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];

export default async function ProjectRegulatoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  const project = await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [requests, items, documents] = await Promise.all([
    listDocumentRequests(user, { projectId }),
    db.task.findMany({
      where: { projectId, category: "REGULATORY" },
      include: { assignedTo: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    db.document.findMany({
      where: { projectId, type: { in: ["REGULATORY", "CERTIFICATE", "IFU"] } },
      include: { currentVersion: true, createdBy: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  /**
   * The rounds each request has already been through. One query for the page
   * rather than one per row; the requests themselves were scoped above, so
   * these ids are already the caller's to see.
   */
  const reviews = await db.documentRequestReview.findMany({
    where: { requestId: { in: requests.map((request) => request.id) } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      requestId: true,
      decision: true,
      note: true,
      createdAt: true,
      reviewer: { select: { id: true, name: true } },
      documentVersion: { select: { id: true, version: true, fileName: true } },
    },
  });
  const reviewsByRequest = Map.groupBy(reviews, (review) => review.requestId);

  const canRequest = can(user, "document:request");
  const canManage = can(user, "regulatory:manage");
  const approved = items.filter((item) => item.status === "COMPLETED").length;
  const openRequests = requests.filter((request) => request.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Status summary */}
      <Panel>
        <div className="stat-grid grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          <Summary label="Itens regulatórios" value={items.length} />
          <Summary label="Concluídos" value={approved} tone="ok" />
          <Summary label="Solicitações abertas" value={openRequests} tone={openRequests ? "warn" : undefined} />
          <Summary label="Órgão" text={items.find((item) => item.authority)?.authority ?? "—"} />
        </div>
      </Panel>

      {/* Document requests to the supplier */}
      <Panel>
        <PanelHeader
          title="Solicitações ao fornecedor"
          description={`Documentos pedidos a ${project.supplier.name}.`}
          action={
            canRequest ? (
              <RequestDocumentDialog projectId={projectId} supplierName={project.supplier.name} />
            ) : null
          }
        />

        {requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhuma solicitação enviada."
            description="Solicite um documento para que ele apareça no portal do fornecedor."
            compact
          />
        ) : (
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH>Documento</TH>
                  <TH>Solicitado a</TH>
                  <TH>Responsável</TH>
                  <TH>Prazo</TH>
                  <TH>Status</TH>
                  <TH className="w-px" />
                </TR>
              </THead>
              <TBody>
                {requests.map((request) => {
                  const status = meta.request(request.status as RequestStatus, dict);
                  const remaining = daysUntil(request.dueDate);
                  const late =
                    remaining !== null &&
                    remaining < 0 &&
                    ["PENDING", "REJECTED"].includes(request.status);

                  return (
                    <TR key={request.id}>
                      <TD>
                        <div className="font-medium text-ink">{request.title}</div>
                        {request.document?.name ? (
                          <div className="mt-0.5 text-[13px] text-muted">
                            Documento: {request.document.name}
                          </div>
                        ) : null}
                      </TD>
                      <TD label="Solicitado a" className="text-[13px] text-ink-soft">{request.supplier.name}</TD>
                      <TD label="Responsável" className="text-[13px] text-ink-soft">{request.requestedBy.name}</TD>
                      <TD label="Prazo" className={cn("text-[13px] whitespace-nowrap", late ? "font-medium text-risk" : "text-ink-soft")}>
                        {formatDate(request.dueDate, locale)}
                        {late ? " · atrasado" : ""}
                      </TD>
                      <TD label="Status">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </TD>
                      <TD className="whitespace-nowrap text-right max-md:mt-3">
                        {canReviewDocumentType(user.role, request.type) &&
                        ["SUBMITTED", "IN_REVIEW"].includes(request.status) ? (
                          <ReviewRequestDialog
                            requestId={request.id}
                            projectId={projectId}
                            title={request.title}
                            supplierName={request.supplier.name}
                            status={meta.request(request.status as RequestStatus, dict).label}
                            submittedAt={
                              request.submittedAt ? formatDateTime(request.submittedAt, locale) : null
                            }
                            dueDate={request.dueDate ? formatDate(request.dueDate, locale) : null}
                            rounds={(reviewsByRequest.get(request.id) ?? []).map((review) => ({
                              ...review,
                              when: formatDateTime(review.createdAt, locale),
                            }))}
                            submission={
                              request.document?.currentVersion
                                ? {
                                    versionId: request.document.currentVersion.id,
                                    fileName: request.document.currentVersion.fileName,
                                    fileSize: request.document.currentVersion.fileSize,
                                    version: request.document.currentVersion.version,
                                    uploadedAt: formatDateTime(
                                      request.document.currentVersion.createdAt,
                                      locale,
                                    ),
                                  }
                                : null
                            }
                          />
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      {/*
        Regulatory checklist — real tasks (category REGULATORY) since Fase 3
        of the architecture-simplification plan. This is the same table
        `/tasks?category=REGULATORY` would show, filtered to this project,
        plus `authority`/`requestedFrom`: the two fields a task only carries
        for this category.
      */}
      <Panel>
        <PanelHeader
          title="Itens regulatórios"
          description="Documentação exigida pelo órgão regulatório."
          action={
            canManage ? (
              <RegulatoryItemDialog projectId={projectId} supplierName={project.supplier.name} />
            ) : null
          }
        />

        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhum item regulatório cadastrado." compact />
        ) : (
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH>Item</TH>
                  <TH>Solicitado a</TH>
                  <TH>Responsável</TH>
                  <TH>Prazo</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => {
                  const status = meta.task(item.status as TaskStatus, dict);
                  return (
                    <TR key={item.id}>
                      <TD>
                        <Link href={`/tasks/${item.id}`} className="font-medium text-ink hover:underline">
                          {item.title}
                        </Link>
                        {item.authority ? (
                          <div className="mt-0.5 text-[13px] text-muted">{item.authority}</div>
                        ) : null}
                      </TD>
                      <TD label="Solicitado a" className="text-[13px] text-ink-soft">{item.requestedFrom ?? "—"}</TD>
                      <TD label="Responsável" className="text-[13px] text-ink-soft">{item.assignedTo?.name ?? "—"}</TD>
                      <TD label="Prazo" className="text-[13px] whitespace-nowrap text-ink-soft">
                        {formatDate(item.dueDate, locale)}
                      </TD>
                      <TD label="Status">
                        {canManage ? (
                          <InlineStatusSelect
                            action={updateRegulatoryItemAction}
                            hidden={{ projectId, itemId: item.id }}
                            name="status"
                            value={item.status}
                            options={STATUS_OPTIONS}
                            ariaLabel={`Status de ${item.title}`}
                          />
                        ) : (
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Documentos regulatórios"
          action={
            <Link
              href={`/projects/${projectId}/documents`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
            >
              <Download className="size-3.5" />
              Ver todos
            </Link>
          }
        />
        <StageDocumentList documents={documents} locale={locale} dict={dict} />
      </Panel>
    </div>
  );
}

function Summary({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value?: number;
  text?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{label}</div>
      {typeof value === "number" ? (
        <div
          className={cn(
            "mt-2 text-[24px] leading-none font-semibold tabular-nums",
            tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink",
          )}
        >
          {value}
        </div>
      ) : (
        <div className="mt-2 truncate text-[15px] font-medium text-ink">{text}</div>
      )}
    </div>
  );
}
