"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { updateStageAction } from "@/server/actions/projects";

export type EditableStage = {
  id: string;
  projectId: string;
  name: string;
  status: string;
  progress: number | null;
  notes: string | null;
};

/**
 * Editing a project stage.
 *
 * Stage status and progress are normally derived from the tasks underneath
 * them, which is the right default and the reason nothing here is required.
 * What was missing is the override: a stage held up by something outside the
 * task list — an authority that has not replied, a supplier that has gone
 * quiet — had no way to say so, and the project went on reporting a progress
 * nobody believed.
 *
 * Leaving progress empty hands control back to the derivation.
 *
 * The notes field is internal. It is one of the fields that used to reach the
 * supplier's browser and no longer does.
 */
const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Não iniciada" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "BLOCKED", label: "Bloqueada" },
];

export function EditStageDialog({ stage }: { stage: EditableStage }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="iconSm" aria-label={`Editar etapa ${stage.name}`}>
          <SlidersHorizontal />
        </Button>
      }
      title={`Etapa: ${stage.name}`}
      description="O progresso é calculado pelas tarefas. Preencha apenas para sobrepor."
      action={updateStageAction}
      submitLabel="Salvar etapa"
      successMessage="Etapa atualizada."
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={stage.projectId} />
          <input type="hidden" name="stageId" value={stage.id} />

          <FieldGrid>
            <Field name="status" label="Status" state={state}>
              <Select id="status" name="status" defaultValue={stage.status}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              name="progress"
              label="Progresso (%)"
              hint="Vazio devolve o cálculo às tarefas."
              state={state}
            >
              <Input
                id="progress"
                name="progress"
                type="number"
                min={0}
                max={100}
                defaultValue={stage.progress ?? ""}
              />
            </Field>
          </FieldGrid>

          <Field
            name="notes"
            label="Notas internas"
            hint="Visível apenas para a equipe Vionex."
            state={state}
          >
            <Textarea id="notes" name="notes" rows={3} defaultValue={stage.notes ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
