"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { createTaskAction } from "@/server/actions/tasks";

export const TASK_CATEGORIES = [
  { value: "REGULATORY", label: "Regulatório" },
  { value: "CLINICAL", label: "Clínico" },
  { value: "IMPORT", label: "Importação" },
  { value: "GO_TO_MARKET", label: "Go-to-Market" },
  { value: "GENERAL", label: "Geral" },
];

export const TASK_PRIORITIES = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

export function NewTaskDialog({
  projects,
  projectId,
  owners,
  supplierName,
  defaultCategory = "GENERAL",
  variant = "primary",
}: {
  projects?: { id: string; name: string }[];
  projectId?: string;
  owners: { id: string; name: string }[];
  /** Shown next to the "waiting on supplier" toggle when the project is fixed. */
  supplierName?: string;
  defaultCategory?: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <FormDialog
      trigger={
        <Button variant={variant} size={variant === "primary" ? "md" : "sm"}>
          <Plus />
          Nova tarefa
        </Button>
      }
      title="Nova tarefa"
      action={createTaskAction}
      submitLabel="Criar tarefa"
      successMessage="Tarefa criada."
      size="lg"
    >
      {(state) => (
        <>
          {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}

          {!projectId && projects ? (
            <Field name="projectId" label="Projeto" required state={state}>
              <Select id="projectId" name="projectId" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field name="title" label="Título" required state={state}>
            <Input id="title" name="title" required placeholder="Certificate of Analysis" />
          </Field>

          <FieldGrid>
            <Field name="category" label="Categoria" required state={state}>
              <Select id="category" name="category" defaultValue={defaultCategory}>
                {TASK_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="priority" label="Prioridade" required state={state}>
              <Select id="priority" name="priority" defaultValue="MEDIUM">
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="assignedToId" label="Responsável" state={state}>
              <Select id="assignedToId" name="assignedToId" defaultValue="">
                <option value="">Sem responsável</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" />
            </Field>
          </FieldGrid>

          <Field name="description" label="Descrição" state={state}>
            <Textarea id="description" name="description" rows={3} />
          </Field>

          <div className="flex items-start gap-2.5 rounded-sm border border-line bg-subtle px-3 py-2.5">
            <Checkbox id="waitingOnSupplier" name="waitingOnSupplier" className="mt-0.5" />
            <div>
              <Label htmlFor="waitingOnSupplier" className="cursor-pointer font-normal">
                Aguardando o fornecedor{supplierName ? ` (${supplierName})` : ""}
              </Label>
              <p className="mt-0.5 text-[12px] text-muted">
                A tarefa ficará visível para o fornecedor no Supplier Portal.
              </p>
            </div>
          </div>
        </>
      )}
    </FormDialog>
  );
}
