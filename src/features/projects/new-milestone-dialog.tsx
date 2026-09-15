"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { createMilestoneAction } from "@/server/actions/stages";

/**
 * Creating a milestone.
 *
 * The panel that lists upcoming milestones has been on the project overview
 * from the start, and everything it showed came from the seed — the product had
 * no way to produce one. `createMilestoneAction` was complete, including the
 * timeline entry and the project recalculation, and unreachable.
 *
 * The stage is optional: some milestones belong to a phase, others are dates
 * the whole project is measured against. When one is chosen, the permission to
 * create it is the permission that owns that stage.
 */
const STAGE_OPTIONS = [
  { value: "", label: "Sem etapa específica" },
  { value: "CLINICAL", label: "Clínico" },
  { value: "REGULATORY", label: "Regulatório" },
  { value: "IMPORT_LOGISTICS", label: "Importação e Logística" },
  { value: "GO_TO_MARKET", label: "Go-to-Market" },
];

export function NewMilestoneDialog({ projectId }: { projectId: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary" size="sm">
          <Plus />
          Novo marco
        </Button>
      }
      title="Novo marco"
      action={createMilestoneAction}
      submitLabel="Criar marco"
      successMessage="Marco criado."
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />

          <Field name="title" label="Marco" required state={state}>
            <Input
              id="title"
              name="title"
              required
              placeholder="Submissão à ANVISA"
              defaultValue=""
            />
          </Field>

          <FieldGrid>
            <Field name="stage" label="Etapa" state={state}>
              <Select id="stage" name="stage" defaultValue="">
                {STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" defaultValue="" />
            </Field>
          </FieldGrid>
        </>
      )}
    </FormDialog>
  );
}
