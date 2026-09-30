"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useFormAction } from "@/components/app/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <li className="grid border-b border-line-faint bg-surface" style={gridStyle}>
      <div className="col-span-full min-w-0 py-1 pl-10 pr-3 md:pl-14">
        {open ? (
          <form
            className="flex flex-wrap items-center gap-2"
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
            <Input
              ref={inputRef}
              name="title"
              aria-label={`Título da nova tarefa em ${categoryName}`}
              placeholder="Nome da tarefa"
              fieldSize="sm"
              minLength={2}
              maxLength={160}
              required
              disabled={pending}
              className="min-w-48 max-w-md flex-1"
            />
            <Button type="submit" size="sm" disabled={pending} aria-label="Salvar nova tarefa">
              <Check />
              {pending ? "Criando…" : "Criar"}
            </Button>
            <Button type="button" size="iconSm" variant="ghost" aria-label="Cancelar nova tarefa" disabled={pending} onClick={close}>
              <X />
            </Button>
            {state.error || state.fieldErrors?.title?.[0] ? (
              <p role="alert" className="w-full text-meta text-risk">{state.fieldErrors?.title?.[0] ?? state.error}</p>
            ) : null}
          </form>
        ) : (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] font-medium text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
