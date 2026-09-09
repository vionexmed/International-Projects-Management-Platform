"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { createRegulatoryItemAction } from "@/server/actions/stages";

const STATUS = [
  { value: "PENDING", label: "Pendente" },
  { value: "REQUESTED", label: "Solicitado" },
  { value: "RECEIVED", label: "Recebido" },
  { value: "IN_REVIEW", label: "Em análise" },
  { value: "APPROVED", label: "Aprovado" },
  { value: "REJECTED", label: "Rejeitado" },
];

export function RegulatoryItemDialog({
  projectId,
  supplierName,
}: {
  projectId: string;
  supplierName: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary" size="sm">
          <Plus />
          Adicionar item
        </Button>
      }
      title="Novo item regulatório"
      action={createRegulatoryItemAction}
      submitLabel="Adicionar"
      successMessage="Item regulatório adicionado."
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />

          <Field name="title" label="Item" required state={state}>
            <Input id="title" name="title" required placeholder="Risk Management File" />
          </Field>

          <FieldGrid>
            <Field name="authority" label="Órgão" state={state}>
              <Input id="authority" name="authority" placeholder="ANVISA" />
            </Field>
            <Field name="requestedFrom" label="Responsável externo" state={state}>
              <Input id="requestedFrom" name="requestedFrom" defaultValue={supplierName} />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="ownerName" label="Responsável Vionex" state={state}>
              <Input id="ownerName" name="ownerName" />
            </Field>
            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" />
            </Field>
          </FieldGrid>

          <Field name="status" label="Status" required state={state}>
            <Select id="status" name="status" defaultValue="PENDING">
              {STATUS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field name="notes" label="Observações" state={state}>
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
