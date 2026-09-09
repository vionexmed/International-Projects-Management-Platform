"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { saveClinicalStudyAction } from "@/server/actions/stages";

export type ClinicalStudyValues = {
  institution: string;
  country: string;
  protocol: string;
  studyType: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SUSPENDED";
  startDate: string;
  expectedCompletion: string;
  notes: string;
};

const STATUS = [
  { value: "PLANNED", label: "Planejado" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "SUSPENDED", label: "Suspenso" },
];

export function ClinicalStudyDialog({
  projectId,
  values,
  hasStudy,
}: {
  projectId: string;
  values: ClinicalStudyValues;
  hasStudy: boolean;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant={hasStudy ? "secondary" : "primary"} size="sm">
          <Pencil />
          {hasStudy ? "Editar estudo" : "Adicionar estudo"}
        </Button>
      }
      title={hasStudy ? "Editar estudo clínico" : "Adicionar estudo clínico"}
      action={saveClinicalStudyAction}
      submitLabel="Salvar"
      successMessage="Estudo clínico atualizado."
      size="lg"
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />

          <FieldGrid>
            <Field name="institution" label="Instituição" state={state}>
              <Input id="institution" name="institution" defaultValue={values.institution} />
            </Field>
            <Field name="country" label="País" state={state}>
              <Input id="country" name="country" defaultValue={values.country} />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="protocol" label="Protocolo" state={state}>
              <Input id="protocol" name="protocol" defaultValue={values.protocol} />
            </Field>
            <Field name="studyType" label="Tipo de estudo" state={state}>
              <Input id="studyType" name="studyType" defaultValue={values.studyType} />
            </Field>
          </FieldGrid>

          <Field name="status" label="Status" required state={state}>
            <Select id="status" name="status" defaultValue={values.status}>
              {STATUS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <FieldGrid>
            <Field name="startDate" label="Início" state={state}>
              <Input id="startDate" name="startDate" type="date" defaultValue={values.startDate} />
            </Field>
            <Field name="expectedCompletion" label="Conclusão prevista" state={state}>
              <Input
                id="expectedCompletion"
                name="expectedCompletion"
                type="date"
                defaultValue={values.expectedCompletion}
              />
            </Field>
          </FieldGrid>

          <Field name="notes" label="Observações" state={state}>
            <Textarea id="notes" name="notes" rows={3} defaultValue={values.notes} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
