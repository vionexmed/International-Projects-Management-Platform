"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlanColumn } from "@/features/tasks/plan-data";
import type { OwnerOption } from "@/features/tasks/task-cells";
import { saveInlineDraft, useAutoGrow } from "@/features/tasks/inline-edit";
import { setTaskPlanValueAction } from "@/server/actions/project-plan";
import { cn } from "@/lib/utils";

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

/** Empty cells stay empty, as in a spreadsheet — no dash in every row. */
function displayValue(column: PlanColumn, value: unknown, owners: OwnerOption[]): string {
  if (value === null || value === undefined || value === "") return "";
  if (column.type === "PERSON") {
    return owners.find((owner) => owner.id === value)?.name ?? "Pessoa indisponível";
  }
  if (column.type === "NUMBER" && typeof value === "number") {
    return new Intl.NumberFormat("pt-BR").format(value);
  }
  return inputValue(value);
}

/** Quiet until hovered or focused, like the other plan cells. */
const FIELD =
  "relative z-10 w-full min-w-0 rounded-sm border border-transparent bg-transparent px-2 text-body text-ink-soft outline-none hover:bg-raised/70 focus:border-brand focus:bg-surface aria-[invalid=true]:border-risk disabled:opacity-60";

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
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const cancelled = React.useRef(false);
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState(inputValue(value));
  const [saved, setSaved] = React.useState(inputValue(value));
  const [error, setError] = React.useState<string | null>(null);
  useAutoGrow(ref, draft);

  if (!editable) {
    return (
      <span className="block min-w-0 px-2 py-1.5 text-body whitespace-pre-wrap break-words text-ink-soft">
        {displayValue(column, value, owners)}
      </span>
    );
  }

  const choice = column.type === "SELECT" || column.type === "PERSON";

  const save = (next: string) => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    let valueJson: string;
    try {
      valueJson = planValueJson(column.type, next);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Valor inválido.";
      setError(message);
      toast.error(message);
      return;
    }
    startTransition(async () => {
      const result = await saveInlineDraft(next, saved, () => {
        const data = new FormData();
        data.set("projectId", projectId);
        data.set("taskId", taskId);
        data.set("columnId", column.id);
        data.set("valueJson", valueJson);
        return setTaskPlanValueAction({}, data);
      });
      // A menu choice has nothing typed to keep, so a refusal puts it back.
      setDraft(choice && result.error ? result.saved : result.draft);
      setSaved(result.saved);
      setError(result.error);
      if (result.error) toast.error(result.error);
      else if (result.saved !== saved) router.refresh();
    });
  };

  const label = `${column.name} de ${taskTitle}`;
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Shift+Enter keeps a line break in text; Enter alone confirms.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      cancelled.current = true;
      setDraft(saved);
      setError(null);
      event.currentTarget.blur();
    }
  };

  if (choice) {
    return (
      <select
        aria-label={label}
        className={cn(
          FIELD,
          "h-8 appearance-none",
          column.type === "SELECT" && draft && "my-1 h-6 w-auto max-w-full self-start rounded-full bg-brand-soft px-2.5 text-meta font-medium text-brand-deep",
        )}
        value={draft}
        disabled={pending}
        onChange={(event) => {
          setDraft(event.target.value);
          save(event.target.value);
        }}
      >
        <option value="" />
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

  if (column.type === "TEXT") {
    return (
      <textarea
        ref={ref}
        rows={1}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD, "block resize-none overflow-hidden py-1.5 leading-5 whitespace-pre-wrap break-words field-sizing-content")}
        value={draft}
        readOnly={pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => save(event.target.value)}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <input
      aria-label={label}
      aria-invalid={error ? true : undefined}
      className={cn(FIELD, "h-8 tabular-nums")}
      type={column.type === "DATE" ? "date" : "number"}
      step={column.type === "NUMBER" ? "any" : undefined}
      value={draft}
      readOnly={pending}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => save(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}
