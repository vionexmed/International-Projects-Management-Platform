"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CircleChevronDown,
  Eye,
  EyeOff,
  Hash,
  Plus,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { PlanColumn } from "@/features/tasks/plan-data";
import {
  createProjectPlanColumnAction,
  deleteProjectPlanColumnAction,
  reorderProjectPlanColumnsAction,
  updateProjectPlanColumnAction,
} from "@/server/actions/project-plan";
import type { ActionState } from "@/server/actions/utils";
import { cn } from "@/lib/utils";

type PlanAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Submit = (action: PlanAction, fields: Record<string, string>, success: string, onSuccess?: () => void) => void;

const COLUMN_TYPES: { value: PlanColumn["type"]; label: string; icon: LucideIcon }[] = [
  { value: "TEXT", label: "Texto", icon: AlignLeft },
  { value: "SELECT", label: "Seleção", icon: CircleChevronDown },
  { value: "DATE", label: "Data", icon: Calendar },
  { value: "NUMBER", label: "Número", icon: Hash },
  { value: "PERSON", label: "Pessoa", icon: UserRound },
];

/** The header glyph for a custom column, as Notion marks a property's type. */
export function columnTypeIcon(type: PlanColumn["type"]): LucideIcon {
  return COLUMN_TYPES.find((option) => option.value === type)?.icon ?? AlignLeft;
}

/* Popovers are portalled: the grid scrolls sideways and would clip them. */
const POPOVER =
  "z-50 rounded-md border border-line bg-surface p-2 shadow-overlay data-[state=open]:animate-fade-in";
const MENU_BUTTON =
  "flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-left text-[13px] text-ink-soft hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted";

function useColumnAction(projectId: string) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const submit: Submit = (action, fields, success, onSuccess) => {
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      for (const [key, value] of Object.entries(fields)) data.set(key, value);
      try {
        const result = await action({}, data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(success);
        onSuccess?.();
        router.refresh();
      } catch {
        toast.error("Não foi possível concluir. Verifique sua conexão e tente novamente.");
      }
    });
  };

  return { pending, submit };
}

function AddPlanColumn({
  projectId,
  pending,
  submit,
  onCreated,
}: {
  projectId: string;
  pending: boolean;
  submit: Submit;
  onCreated: () => void;
}) {
  const [type, setType] = React.useState<PlanColumn["type"]>("TEXT");
  const [name, setName] = React.useState("");
  const [options, setOptions] = React.useState("");
  const ready = name.trim() !== "" && (type !== "SELECT" || options.trim() !== "");

  return (
    <form
      className="grid gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = type === "SELECT" ? options.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
        if (!ready || (type === "SELECT" && parsed.length === 0)) return;
        submit(createProjectPlanColumnAction, { projectId, name: name.trim(), type, options: JSON.stringify(parsed) }, "Coluna criada.", () => {
          setName("");
          setOptions("");
          setType("TEXT");
          onCreated();
        });
      }}
    >
      <p className="text-label font-semibold text-ink">Nova coluna</p>
      <Input aria-label="Nome da coluna" fieldSize="sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome, ex.: Documento" maxLength={80} required disabled={pending} autoFocus />
      <Select aria-label="Tipo da coluna" fieldSize="sm" value={type} onChange={(event) => setType(event.target.value as PlanColumn["type"])} disabled={pending}>
        {COLUMN_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
      {type === "SELECT" ? <Textarea aria-label="Opções" value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Uma opção por linha" className="min-h-16 text-[13px]" disabled={pending} /> : null}
      <Button type="submit" size="sm" variant="primary" disabled={pending || !ready}>Criar coluna</Button>
    </form>
  );
}

/** "+ Coluna" at the end of the header row: create a column, or show a hidden one again. */
export function PlanAddColumnMenu({ projectId, columns }: { projectId: string; columns: PlanColumn[] }) {
  const { pending, submit } = useColumnAction(projectId);
  const [open, setOpen] = React.useState(false);
  const hidden = columns.filter((column) => !column.visible);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-label font-medium whitespace-nowrap text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-brand data-[state=open]:bg-raised">
        <Plus className="size-4" aria-hidden />
        Coluna
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} collisionPadding={16} className={cn(POPOVER, "w-72")}>
          <AddPlanColumn projectId={projectId} pending={pending} submit={submit} onCreated={() => setOpen(false)} />
          {hidden.length > 0 ? (
            <div className="mt-2 border-t border-line-soft pt-2">
              <p className="px-2 pb-1 text-meta text-muted">Colunas ocultas</p>
              {hidden.map((column) => {
                const Icon = columnTypeIcon(column.type);
                return (
                  <button
                    key={column.id}
                    type="button"
                    className={MENU_BUTTON}
                    disabled={pending}
                    aria-label={`Mostrar ${column.name}`}
                    onClick={() => submit(updateProjectPlanColumnAction, { columnId: column.id, visible: "true" }, "Coluna exibida.")}
                  >
                    <Icon />
                    <span className="min-w-0 flex-1 truncate">{column.name}</span>
                    <Eye />
                  </button>
                );
              })}
            </div>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * A custom column's header is its own menu, as in Notion: rename, move, hide
 * or delete the column where you see it.
 */
export function PlanColumnMenu({
  projectId,
  column,
  columns,
  children,
}: {
  projectId: string;
  column: PlanColumn;
  columns: PlanColumn[];
  children: React.ReactNode;
}) {
  const { pending, submit } = useColumnAction(projectId);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(column.name);
  const visibleIds = columns.filter((item) => item.visible).map((item) => item.id);
  const position = visibleIds.indexOf(column.id);
  const typeLabel = COLUMN_TYPES.find((option) => option.value === column.type)?.label;
  const close = () => setOpen(false);

  const move = (direction: -1 | 1) => {
    const ids = columns.map((item) => item.id);
    const from = ids.indexOf(column.id);
    const to = ids.indexOf(visibleIds[position + direction]);
    if (from < 0 || to < 0) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    submit(reorderProjectPlanColumnsAction, { columnIds: JSON.stringify(ids) }, "Ordem atualizada.", close);
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setName(column.name);
      }}
    >
      <PopoverPrimitive.Trigger
        aria-label={`Opções da coluna ${column.name}`}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-3 text-left transition-colors hover:bg-raised/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand data-[state=open]:bg-raised"
      >
        {children}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={4} collisionPadding={16} className={cn(POPOVER, "w-64")}>
          <form
            className="p-1"
            onSubmit={(event) => {
              event.preventDefault();
              const next = name.trim();
              if (!next || next === column.name) return close();
              submit(updateProjectPlanColumnAction, { columnId: column.id, name: next }, "Coluna renomeada.", close);
            }}
          >
            <Input aria-label="Nome da coluna" fieldSize="sm" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} disabled={pending} autoFocus />
            <p className="mt-1.5 px-1 text-meta text-muted">Tipo: {typeLabel} · Enter para salvar</p>
          </form>
          <div className="mt-1 border-t border-line-soft pt-1">
            <button type="button" className={MENU_BUTTON} disabled={pending || position <= 0} onClick={() => move(-1)}>
              <ArrowLeft /> Mover para a esquerda
            </button>
            <button type="button" className={MENU_BUTTON} disabled={pending || position === visibleIds.length - 1} onClick={() => move(1)}>
              <ArrowRight /> Mover para a direita
            </button>
            <button
              type="button"
              className={MENU_BUTTON}
              disabled={pending}
              onClick={() => submit(updateProjectPlanColumnAction, { columnId: column.id, visible: "false" }, "Coluna oculta.", close)}
            >
              <EyeOff /> Ocultar coluna
            </button>
            <button
              type="button"
              className={cn(MENU_BUTTON, "text-risk hover:bg-risk-soft hover:text-risk [&_svg]:text-risk")}
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Excluir a coluna “${column.name}” e todos os valores preenchidos?`)) {
                  submit(deleteProjectPlanColumnAction, { columnId: column.id }, "Coluna excluída.", close);
                }
              }}
            >
              <Trash2 /> Excluir coluna
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
