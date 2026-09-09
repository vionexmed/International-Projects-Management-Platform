"use client";

import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/app/form-dialog";
import { reviewDocumentRequestAction } from "@/server/actions/documents";

/** Vionex-side decision on a submitted request. */
export function ReviewRequestDialog({
  requestId,
  projectId,
  title,
}: {
  requestId: string;
  projectId: string;
  title: string;
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

          <Field name="status" label="Decisão" required state={state}>
            <Select id="status" name="status" defaultValue="IN_REVIEW">
              <option value="IN_REVIEW">Em análise</option>
              <option value="APPROVED">Aprovado</option>
              <option value="REJECTED">Rejeitado</option>
            </Select>
          </Field>

          <Field
            name="note"
            label="Observação para o fornecedor"
            hint="Escreva em inglês — o fornecedor verá esta mensagem."
            state={state}
          >
            <Textarea id="note" name="note" rows={3} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
