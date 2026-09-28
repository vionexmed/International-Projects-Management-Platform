import Link from "next/link";
import { Inbox, ShieldCheck } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listDocumentRequests, type RequestStatus } from "@/server/services/documents";
import { db } from "@/server/db";
import { WorkBlock } from "@/features/projects/work-block";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CellStack, Table, TableScroll, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RequestDocumentDialog } from "@/features/documents/request-document-dialog";
import { ReviewRequestDialog } from "@/features/documents/review-request-dialog";
import { RegulatoryItemDialog } from "@/features/projects/regulatory-item-dialog";
import { StatusMenu, type StatusOption } from "@/components/app/status-menu";
import { updateRegulatoryItemAction } from "@/server/actions/stages";
import { canReviewDocumentType } from "@/server/authz/permissions";
import { orNotFound } from "@/server/authz/rsc";
import { StageDocumentList } from "@/features/projects/stage-document-list";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, meta } from "@/lib/labels";
import { formatDate, formatDateShort, formatDateTime, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

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
      // Mirror tasks of the requests above are the same pendency; listing
      // them again showed every request twice on this screen.
      where: { projectId, category: "REGULATORY", requests: { none: {} } },
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
  // The authority most items answer to; a row repeats it only when it differs.
  const authority = items.find((item) => item.authority)?.authority ?? null;

  const statusOptions: StatusOption[] = OPTIONS.taskStatus.map((value) => ({
    value,
    ...meta.task(value, dict),
  }));

  return (
    <div className="space-y-6">
      {/* Document requests to the supplier */}
      <WorkBlock
        title="Solicitações ao fornecedor"
        count={openRequests > 0 ? `${openRequests} ${openRequests === 1 ? "aberta" : "abertas"}` : undefined}
        description={`Documentos pedidos a ${project.supplier.name} pelo portal.`}
        action={
          canRequest ? (
            <RequestDocumentDialog projectId={projectId} supplierName={project.supplier.name} />
          ) : null
        }
      >
        {requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhuma solicitação enviada."
            description="Solicite um documento para que ele apareça no portal do fornecedor."
            compact
          />
        ) : (
          <TableScroll>
            <Table columnRules>
              <THead>
                {/* Same distribution as the list pages: the name takes the slack, dates close the row. */}
                <TR>
                  <TH className="min-w-64">Documento</TH>
                  <TH className="w-px">Solicitado por</TH>
                  <TH className="w-px">Status</TH>
                  <TH className="w-px" align="right">Prazo</TH>
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
                        <CellStack title={request.title} subtitle={request.document?.name} />
                      </TD>
                      <TD label="Solicitado por">{request.requestedBy.name}</TD>
                      <TD label="Status">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </TD>
                      <TD label="Prazo" align="right" className={cn(late && "font-medium text-risk")}>
                        {request.dueDate ? formatDateShort(request.dueDate, locale) : null}
                        {late ? " · atrasado" : ""}
                      </TD>
                      <TD className="text-right whitespace-nowrap max-md:mt-3">
                        {canReviewDocumentType(user.role, request.type) &&
                        ["SUBMITTED", "IN_REVIEW"].includes(request.status) ? (
                          <ReviewRequestDialog
                            requestId={request.id}
                            projectId={projectId}
                            title={request.title}
                            supplierName={request.supplier.name}
                            status={status.label}
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
      </WorkBlock>

      {/*
        Regulatory checklist — real tasks (category REGULATORY) since Fase 3
        of the architecture-simplification plan. This is the same table
        `/tasks?category=REGULATORY` would show, filtered to this project,
        plus `authority`/`requestedFrom`: the two fields a task only carries
        for this category.
      */}
      <WorkBlock
        title="Itens regulatórios"
        count={items.length > 0 ? `${approved} de ${items.length} concluídos` : undefined}
        description={
          authority
            ? `Documentação exigida por ${authority}.`
            : "Documentação exigida pelo órgão regulatório."
        }
        action={
          canManage ? (
            <RegulatoryItemDialog projectId={projectId} supplierName={project.supplier.name} />
          ) : null
        }
      >
        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhum item regulatório cadastrado." compact />
        ) : (
          <TableScroll>
            <Table columnRules>
              <THead>
                <TR>
                  <TH className="min-w-64">Item</TH>
                  <TH className="w-px">Solicitado a</TH>
                  <TH className="w-px">Responsável</TH>
                  <TH className="w-px">Status</TH>
                  <TH className="w-px" align="right">Prazo</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <CellStack
                        title={
                          <Link href={`/tasks/${item.id}`} className="hover:underline">
                            {item.title}
                          </Link>
                        }
                        subtitle={item.authority !== authority ? item.authority : null}
                      />
                    </TD>
                    <TD label="Solicitado a">{item.requestedFrom}</TD>
                    <TD label="Responsável">{item.assignedTo?.name}</TD>
                    <TD label="Status">
                      <StatusMenu
                        action={updateRegulatoryItemAction}
                        hidden={{ projectId, itemId: item.id }}
                        name="status"
                        value={item.status}
                        options={statusOptions}
                        ariaLabel={`Status de ${item.title}`}
                        readOnly={!canManage}
                      />
                    </TD>
                    <TD label="Prazo" align="right">
                      {item.dueDate ? formatDateShort(item.dueDate, locale) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </WorkBlock>

      <WorkBlock
        title="Documentos regulatórios"
        count={documents.length || undefined}
        description="Regulatórios, certificados e instruções de uso."
        action={{ label: "Ver todos", href: `/projects/${projectId}/documents` }}
      >
        <StageDocumentList documents={documents} locale={locale} dict={dict} />
      </WorkBlock>
    </div>
  );
}
