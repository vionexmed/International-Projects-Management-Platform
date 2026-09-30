"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlanColumn } from "@/features/tasks/plan-data";
import type { OwnerOption } from "@/features/tasks/task-cells";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { Dropdown, DropdownContent, DropdownTrigger } from "@/components/ui/dropdown";
import { saveInlineDraft, useAutoGrow } from "@/features/tasks/inline-edit";
import { PlanTag } from "@/features/tasks/plan-tags";
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

const MENU_ROW =
  "flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] text-ink-soft outline-none select-none data-[highlighted]:bg-raised data-[highlighted]:text-ink";

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
    if (column.type === "SELECT" && typeof value === "string" && value) {
      return <span className="flex h-8 items-center px-2"><PlanTag options={column.options} option={value} /></span>;
    }
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

  if (column.type === "SELECT") {
    const pick = (next: string) => {
      if (next === draft) return;
      setDraft(next);
      save(next);
    };
    return (
      <Dropdown>
        <DropdownTrigger
          aria-label={`${label}: ${draft || "vazio"}`}
          disabled={pending}
          className="relative z-10 flex h-8 w-full min-w-0 items-center rounded-sm px-2 text-left transition-colors hover:bg-raised/70 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60 data-[state=open]:bg-raised"
        >
          {draft ? <PlanTag options={column.options} option={draft} /> : null}
        </DropdownTrigger>
        <DropdownContent align="start" className="scroll-slim max-h-72 min-w-48 overflow-y-auto">
          {column.options.map((option) => (
            <DropdownPrimitive.Item key={option} className={MENU_ROW} onSelect={() => pick(option)}>
              <span className="min-w-0 flex-1"><PlanTag options={column.options} option={option} /></span>
              {option === draft ? <Check className="size-4 text-ink-soft" aria-hidden /> : null}
            </DropdownPrimitive.Item>
          ))}
          {draft ? (
            <DropdownPrimitive.Item className={cn(MENU_ROW, "mt-1 border-t border-line-soft text-muted")} onSelect={() => pick("")}>
              Limpar
            </DropdownPrimitive.Item>
          ) : null}
        </DropdownContent>
      </Dropdown>
    );
  }

  if (choice) {
    return (
      <select
        aria-label={label}
        className={cn(FIELD, "h-8 appearance-none")}
        value={draft}
        disabled={pending}
        onChange={(event) => {
          setDraft(event.target.value);
          save(event.target.value);
        }}
      >
        <option value="" />
        {owners.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
        {draft && !owners.some((owner) => owner.id === draft) ? (
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
