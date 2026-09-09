"use client";

import { InlineStatusSelect } from "@/features/projects/inline-status-select";
import { setTaskStatusAction } from "@/server/actions/tasks";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Aberta" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "WAITING", label: "Aguardando" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "CANCELLED", label: "Cancelada" },
];

export function TaskStatusControl({ taskId, status }: { taskId: string; status: string }) {
  return (
    <InlineStatusSelect
      action={setTaskStatusAction}
      hidden={{ taskId }}
      name="status"
      value={status}
      options={STATUS_OPTIONS}
      ariaLabel="Alterar status da tarefa"
      successMessage="Tarefa atualizada."
    />
  );
}
