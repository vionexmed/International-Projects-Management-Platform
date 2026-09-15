"use client";

import { ClipboardCheck, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/app/form-dialog";
import { reviewDocumentRequestAction } from "@/server/actions/documents";
import { formatFileSize } from "@/lib/format";
import { ReviewHistory, type ReviewRound } from "@/features/documents/review-history";

export type ReviewSubmission = {
  versionId: string;
  fileName: string;
  fileSize: number;
  version: number;
  uploadedAt: string;
};

/**
 * Vionex's decision on a submitted request.
 *
 * The file is the point. Until now this dialog offered a verdict and a comment
 * box and no way to open what was being judged — the reviewer had to leave,
 * find the document elsewhere, and come back, or approve blind. Most people
 * approve blind.
 *
 * The link goes through `/api/files/[versionId]`, the same authenticated route
 * the rest of the product uses: the session is revalidated, the scope is
 * re-applied, and the download is written to the audit log. No signed URL, no
 * second document pipeline, no exception.
 */
export function ReviewRequestDialog({
  requestId,
  projectId,
  title,
  supplierName,
  status,
  submittedAt,
  dueDate,
  submission,
  rounds,
}: {
  requestId: string;
  projectId: string;
  title: string;
  supplierName: string;
  status: string;
  submittedAt: string | null;
  dueDate: string | null;
  submission: ReviewSubmission | null;
  /** Earlier decisions on this request, oldest first. */
  rounds: ReviewRound[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary" size="sm">
          <ClipboardCheck />
          Revisar
        </Button>
      }
      title="Revisar solicitação"
      description={title}
      action={reviewDocumentRequestAction}
      submitLabel="Salvar análise"
      successMessage="Análise registrada."
    >
      {(state) => (
        <>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="projectId" value={projectId} />

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-line bg-subtle px-4 py-3.5">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                Fornecedor
              </dt>
              <dd className="mt-0.5 text-[13px] text-ink">{supplierName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                Status atual
              </dt>
              <dd className="mt-0.5 text-[13px] text-ink">{status}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                Enviado em
              </dt>
              <dd className="mt-0.5 text-[13px] text-ink">{submittedAt ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                Prazo
              </dt>
              <dd className="mt-0.5 text-[13px] text-ink">{dueDate ?? "—"}</dd>
            </div>
          </dl>

          {submission ? (
            <a
              href={`/api/files/${submission.versionId}`}
              className="flex items-center gap-3 rounded-md border border-brand-line bg-brand-soft px-4 py-3 transition-colors hover:border-brand"
            >
              <FileText className="size-5 shrink-0 text-brand-strong" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {submission.fileName}
                </span>
                <span className="block text-[12px] text-muted">
                  v{submission.version} · {formatFileSize(submission.fileSize)} ·{" "}
                  {submission.uploadedAt}
                </span>
              </span>
              <Download className="size-4 shrink-0 text-brand-strong" />
            </a>
          ) : (
            <p className="rounded-md border border-warn/25 bg-warn-soft px-4 py-3 text-[13px] text-warn">
              O fornecedor respondeu sem anexar arquivo. Leia a resposta no histórico da
              solicitação antes de decidir.
            </p>
          )}

          <ReviewHistory
            rounds={rounds}
            title="Análises anteriores"
            labels={{
              approved: "Aprovado",
              changesRequested: "Correção solicitada",
              version: "v",
            }}
          />

          <Field name="status" label="Decisão" required state={state}>
            <Select id="status" name="status" defaultValue="IN_REVIEW">
              <option value="IN_REVIEW">Em análise</option>
              <option value="APPROVED">Aprovar</option>
              <option value="REJECTED">Solicitar correção</option>
            </Select>
          </Field>

          <Field
            name="note"
            label="Observação para o fornecedor"
            hint="Escreva em inglês — o fornecedor lê esta mensagem, e ela fica no histórico da solicitação."
            state={state}
          >
            <Textarea
              id="note"
              name="note"
              rows={3}
              placeholder="Describe what needs to change…"
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
