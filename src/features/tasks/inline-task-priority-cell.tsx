"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TaskPriority } from "@/generated/prisma";
import { setTaskPriorityAction } from "@/server/actions/tasks";

const OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Baixa" }, { value: "MEDIUM", label: "Média" }, { value: "HIGH", label: "Alta" }, { value: "URGENT", label: "Urgente" },
];

export function InlineTaskPriorityCell({ taskId, priority, editable }: { taskId: string; priority: TaskPriority; editable: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  if (!editable) return <span className={priority === "HIGH" || priority === "URGENT" ? "text-body font-medium text-risk" : "text-body text-muted"}>{OPTIONS.find((option) => option.value === priority)?.label}</span>;
  return <select aria-label="Prioridade" value={priority} disabled={pending} onChange={(event) => startTransition(async () => { const data = new FormData(); data.set("taskId", taskId); data.set("priority", event.target.value); const result = await setTaskPriorityAction({}, data); if (result.error) toast.error(result.error); else router.refresh(); })} className="relative z-10 h-8 w-full rounded-sm border border-transparent bg-transparent px-2 text-body text-ink hover:border-line focus:border-brand focus:bg-surface focus:outline-none disabled:opacity-60">{OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}
