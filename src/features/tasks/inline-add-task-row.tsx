"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useFormAction } from "@/components/app/use-form-action";
import type { TaskCategory } from "@/generated/prisma";
import { createTaskAction } from "@/server/actions/tasks";

/** A quick entry row for the category currently displayed in the plan. */
export function InlineAddTaskRow({
  projectId,
  category,
  categoryName,
  gridStyle,
}: {
  projectId: string;
  category: TaskCategory;
  categoryName: string;
  gridStyle: React.CSSProperties;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { state, pending, onSubmit, reset } = useFormAction(createTaskAction, (_result, form) => {
    form.reset();
    setOpen(false);
    toast.success("Tarefa criada.");
    router.refresh();
  });

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    if (pending) return;
    reset();
    setOpen(false);
  };

  return (
    <li className="grid border-b border-line-soft bg-surface" style={gridStyle}>
      <div className="col-span-full min-w-0 py-1 pr-3 pl-3">
        {open ? (
          /* Typed straight into the row, like the titles above it: no field box. Enter creates, Esc cancels. */
          <form
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
            onSubmit={(event) => {
              if (!event.currentTarget.reportValidity()) {
                event.preventDefault();
                return;
              }
              onSubmit(event);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="priority" value="MEDIUM" />
            <Plus className="ml-1 size-4 shrink-0 text-faint" aria-hidden />
            <input
              ref={inputRef}
              name="title"
              aria-label={`Título da nova tarefa em ${categoryName}`}
              placeholder="Nome da tarefa"
              minLength={2}
              maxLength={160}
              required
              disabled={pending}
              autoComplete="off"
              onBlur={(event) => {
                if (!event.currentTarget.value.trim()) close();
              }}
              className="h-8 min-w-48 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-faint disabled:opacity-60"
            />
            <span className="hidden shrink-0 text-meta text-faint sm:inline">
              {pending ? "Criando…" : "Enter para criar · Esc para cancelar"}
            </span>
            {/* Touch screens have no Enter key to hand; a quiet word does the same. */}
            <button type="submit" disabled={pending} className="shrink-0 text-meta font-medium text-brand-strong sm:hidden">
              Criar
            </button>
            {state.error || state.fieldErrors?.title?.[0] ? (
              <p role="alert" className="w-full pl-7 text-meta text-risk">{state.fieldErrors?.title?.[0] ?? state.error}</p>
            ) : null}
          </form>
        ) : (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2.5 rounded-sm px-1 text-[13px] text-faint transition-colors hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={() => {
              reset();
              setOpen(true);
            }}
            aria-label={`Adicionar tarefa em ${categoryName}`}
          >
            <Plus className="size-4" />
            Adicionar tarefa
          </button>
        )}
      </div>
    </li>
  );
}
