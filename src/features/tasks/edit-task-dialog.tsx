"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { updateTaskAction } from "@/server/actions/tasks";
import { TASK_CATEGORIES, TASK_PRIORITIES } from "@/features/tasks/new-task-dialog";

export type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assignedToId: string | null;
  dueDate: string;
};

export function EditTaskDialog({
  task,
  owners,
}: {
  task: EditableTask;
  owners: { id: string; name: string }[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <Pencil />
          Editar
        </Button>
      }
      title="Editar tarefa"
      action={updateTaskAction}
      submitLabel="Salvar alterações"
      successMessage="Tarefa atualizada."
      size="lg"
    >
      {(state) => (
        <>
          <input type="hidden" name="taskId" value={task.id} />

          <Field name="title" label="Título" required state={state}>
            <Input id="title" name="title" required defaultValue={task.title} />
          </Field>

          <FieldGrid>
            <Field name="category" label="Categoria" state={state}>
              <Select id="category" name="category" defaultValue={task.category}>
                {TASK_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="priority" label="Prioridade" state={state}>
              <Select id="priority" name="priority" defaultValue={task.priority}>
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
              <Select id="assignedToId" name="assignedToId" defaultValue={task.assignedToId ?? ""}>
                <option value="">Sem responsável</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={task.dueDate} />
            </Field>
          </FieldGrid>

          <Field name="description" label="Descrição" state={state}>
            <Textarea id="description" name="description" rows={4} defaultValue={task.description ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
