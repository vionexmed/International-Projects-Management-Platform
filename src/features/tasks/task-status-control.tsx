"use client";

import { StatusMenu, type StatusOption } from "@/components/app/status-menu";
import { setTaskStatusAction } from "@/server/actions/tasks";

const STATUS_OPTIONS: StatusOption[] = [
  { value: "OPEN", label: "Aberta", tone: "neutral" },
  { value: "IN_PROGRESS", label: "Em andamento", tone: "info" },
  { value: "WAITING", label: "Aguardando", tone: "warn" },
  { value: "COMPLETED", label: "Concluída", tone: "ok" },
  { value: "CANCELLED", label: "Cancelada", tone: "neutral" },
];

export function TaskStatusControl({ taskId, status }: { taskId: string; status: string }) {
  return (
    <StatusMenu
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
