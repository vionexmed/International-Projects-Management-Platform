import "server-only";
import { Inbox } from "lucide-react";
import type { TaskCategory } from "@/generated/prisma";
import { listDocumentRequests, type RequestStatus } from "@/server/services/documents";
import { canReviewDocumentType } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { WorkBlock } from "@/features/projects/work-block";
import { ReviewRequestDialog } from "@/features/documents/review-request-dialog";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CellStack, Table, TableScroll, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { documentTypesForStage } from "@/lib/document-stage";
import { daysUntil, formatDate, formatDateShort, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { meta } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

const OPEN = ["PENDING", "SUBMITTED", "IN_REVIEW", "REJECTED"];

/**
 * The documents requested from the supplier for one stage — on that stage's
 * own page, with where each stands and, once the supplier has sent it, the
 * review. A request belongs to the stage of the category it was asked under
 * (`documentTypesForStage`), so every request shows on exactly one stage page.
 */
export async function StageRequests({
  user,
  projectId,
  supplierName,
  stage,
  locale,
  dict,
}: {
  user: SessionUser;
  projectId: string;
  supplierName: string;
  stage: TaskCategory;
  locale: Locale;
  dict: Dictionary;
}) {
  const types = documentTypesForStage(stage);
  const requests = (await listDocumentRequests(user, { projectId })).filter((request) =>
    types.includes(request.type),
  );

  /**
   * The rounds each request has already been through. One query for the
   * block rather than one per row; the requests were scoped above, so these
   * ids are already the caller's to see.
   */
  const reviews = requests.length
    ? await db.documentRequestReview.findMany({
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
      })
    : [];
  const reviewsByRequest = Map.groupBy(reviews, (review) => review.requestId);
  const open = requests.filter((request) => OPEN.includes(request.status)).length;

  return (
    <WorkBlock
      title="Documentos solicitados"
      count={open > 0 ? `${open} em aberto` : undefined}
      description={`Pedidos a ${supplierName} pelo portal nesta etapa.`}
    >
      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum documento solicitado nesta etapa."
          description="Use “Solicitar documento”, no topo do projeto, e escolha a categoria desta etapa."
          compact
        />
      ) : (
        <TableScroll>
          <Table columnRules>
            <THead>
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
                const late = remaining !== null && remaining < 0 && ["PENDING", "REJECTED"].includes(request.status);

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
                      {request.dueDate ? formatDateShort(request.dueDate, locale) : "—"}
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
                          submittedAt={request.submittedAt ? formatDateTime(request.submittedAt, locale) : null}
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
                                  uploadedAt: formatDateTime(request.document.currentVersion.createdAt, locale),
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
  );
}
