"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { requestDocumentAction } from "@/server/actions/documents";

const TYPES = [
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "IFU", label: "IFU" },
  { value: "REGULATORY", label: "Regulatório" },
  { value: "CLINICAL", label: "Clínico" },
  { value: "CONTRACT", label: "Contrato" },
  { value: "NDA", label: "NDA" },
  { value: "IMPORT", label: "Importação" },
  { value: "COMMERCIAL", label: "Comercial" },
  { value: "PRESENTATION", label: "Apresentação" },
  { value: "OTHER", label: "Outro" },
];

/**
 * Asks the project's supplier for a document. The request lands in their
 * portal under Action Required and notifies every user of that company.
 */
export function RequestDocumentDialog({
  projectId,
  supplierName,
}: {
  projectId: string;
  supplierName: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="primary" size="sm">
          <Send />
          Solicitar documento
        </Button>
      }
      title="Solicitar documento"
      description={`A solicitação será enviada para ${supplierName} no Supplier Portal.`}
      action={requestDocumentAction}
      submitLabel="Enviar solicitação"
      successMessage="Solicitação enviada ao fornecedor."
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />

          <Field name="title" label="Documento solicitado" required state={state}>
            <Input id="title" name="title" required placeholder="Certificate of Analysis" />
          </Field>

          <FieldGrid>
            <Field name="type" label="Tipo" required state={state}>
              <Select id="type" name="type" defaultValue="CERTIFICATE">
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" />
            </Field>
          </FieldGrid>

          <Field
            name="description"
            label="Instruções para o fornecedor"
            hint="Escreva em inglês — o fornecedor lerá esta mensagem no portal."
            state={state}
          >
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Please provide the latest Certificate of Analysis for the product."
            />
          </Field>

          <div className="flex items-center gap-2.5 rounded-sm border border-line bg-subtle px-3 py-2.5">
            <Checkbox id="createTask" name="createTask" defaultChecked />
            <Label htmlFor="createTask" className="cursor-pointer font-normal">
              Criar tarefa interna de acompanhamento
            </Label>
          </div>
        </>
      )}
    </FormDialog>
  );
}
