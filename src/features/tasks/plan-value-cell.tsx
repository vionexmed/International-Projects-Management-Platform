"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlanColumn } from "@/features/tasks/plan-data";
import type { OwnerOption } from "@/features/tasks/task-cells";
import { setTaskPlanValueAction } from "@/server/actions/project-plan";

/** Empty fields delete their stored value; numbers stay JSON numbers. */
export function planValueJson(type: PlanColumn["type"], raw: string): string {
  if (raw === "") return "null";
  if (type === "NUMBER") {
    const number = Number(raw);
    if (!Number.isFinite(number)) throw new Error("Informe um número válido.");
    return JSON.stringify(number);
  }
  return JSON.stringify(raw);
}

function inputValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function displayValue(column: PlanColumn, value: unknown, owners: OwnerOption[]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.type === "PERSON") {
    return owners.find((owner) => owner.id === value)?.name ?? "Pessoa indisponível";
  }
  if (column.type === "NUMBER" && typeof value === "number") {
    return new Intl.NumberFormat("pt-BR").format(value);
  }
  return inputValue(value) || "—";
}

export function PlanValueCell({
  projectId,
  taskId,
  taskTitle,
  column,
  value,
  owners,
  editable,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  column: PlanColumn;
  value: unknown;
  owners: OwnerOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState(inputValue(value));
  const saved = inputValue(value);

  const save = (next: string) => {
    if (next === saved) return;
    let valueJson: string;
    try {
      valueJson = planValueJson(column.type, next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Valor inválido.");
      setDraft(saved);
      return;
    }
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("taskId", taskId);
      data.set("columnId", column.id);
      data.set("valueJson", valueJson);
      const result = await setTaskPlanValueAction({}, data);
      if (result.error) {
        toast.error(result.error);
        setDraft(saved);
        return;
      }
      router.refresh();
    });
  };

  if (!editable) {
    return <span className="truncate text-body text-ink-soft">{displayValue(column, value, owners)}</span>;
  }

  const label = `${column.name} de ${taskTitle}`;
  const common = "relative z-10 h-8 w-full min-w-0 rounded-sm border border-transparent bg-transparent px-2 text-body text-ink-soft hover:border-line focus:border-brand focus:bg-surface focus:outline-none disabled:opacity-60";

  if (column.type === "SELECT" || column.type === "PERSON") {
    return (
      <select
        aria-label={label}
        className={common}
        value={draft}
        disabled={pending}
        onChange={(event) => {
          setDraft(event.target.value);
          save(event.target.value);
        }}
      >
        <option value="">—</option>
        {(column.type === "SELECT"
          ? column.options.map((option) => ({ id: option, name: option }))
          : owners
        ).map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
        {column.type === "PERSON" && draft && !owners.some((owner) => owner.id === draft) ? (
          <option value={draft}>Pessoa indisponível</option>
        ) : null}
      </select>
    );
  }

  return (
    <input
      aria-label={label}
      className={common}
      type={column.type === "DATE" ? "date" : column.type === "NUMBER" ? "number" : "text"}
      step={column.type === "NUMBER" ? "any" : undefined}
      value={draft}
      disabled={pending}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => save(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(saved);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
