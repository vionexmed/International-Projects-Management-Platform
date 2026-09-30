"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, UserRound } from "lucide-react";
import { toast } from "sonner";
import { StatusIcon, statusIconKind } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown, DropdownContent, DropdownTrigger } from "@/components/ui/dropdown";
import {
  setTaskAssigneeAction,
  setTaskDueDateAction,
  setTaskStatusAction,
} from "@/server/actions/tasks";
import type { ActionState } from "@/server/actions/utils";
import type { DerivedTaskStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Inline cells for the plan grid, the board and the task sheet. Each one
 * posts the same FormData as the matching single-field server action and
 * refreshes the route, so the server stays the one source of truth.
 */

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function useCellSubmit(action: ServerAction, successMessage: string) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const submit = (fields: Record<string, string>, optimistic?: () => void) => {
    startTransition(async () => {
      optimistic?.();
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) formData.set(key, value);
      const result = await action({}, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  };

  return { pending, submit };
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em andamento",
  WAITING: "Aguardando",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const STATUS_VALUES = ["OPEN", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED"] as const;

/* Menu rows without DropdownItem's grey svg tint, which would repaint the status glyphs. */
const MENU_ROW =
  "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] text-ink-soft outline-none select-none data-[highlighted]:bg-raised data-[highlighted]:text-ink";

/** An empty-value hint that shows only on the hovered or focused grid row. */
const QUIET = "opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100";

/** Trigger chrome shared by every editable cell: quiet until hovered. */
const CELL_TRIGGER =
  "relative z-10 inline-flex min-w-0 items-center gap-1.5 rounded-sm transition-colors hover:bg-raised data-[state=open]:bg-raised disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand";

/**
 * Status as the 16-px glyph (the grid and the board), or glyph + label
 * (`showLabel`, the task sheet). `derived` tints an overdue open task red;
 * the stored `status` is what the menu edits.
 */
export function TaskStatusCell({
  taskId,
  status,
  derived,
  title,
  readOnly = false,
  showLabel = false,
  calm = false,
}: {
  taskId: string;
  status: string;
  derived: DerivedTaskStatus;
  title: string;
  readOnly?: boolean;
  showLabel?: boolean;
  /**
   * In a grid the glyph only says open / in progress / done: lateness is the
   * red date beside it and waiting has its own attention sign, so an unfinished
   * task keeps the colour it was created with.
   */
  calm?: boolean;
}) {
  const { pending, submit } = useCellSubmit(setTaskStatusAction, "Tarefa atualizada.");
  const [current, setCurrent] = React.useOptimistic(status);
  const derivedShown: DerivedTaskStatus = current === status ? derived : (current as DerivedTaskStatus);
  const shown: DerivedTaskStatus = calm && derivedShown === "OVERDUE" ? (current as DerivedTaskStatus) : derivedShown;
  const calmTone = calm && (shown === "WAITING" || shown === "OPEN") ? "text-brand" : undefined;
  const label = derived === "OVERDUE" && current === status ? "Atrasada" : TASK_STATUS_LABELS[current];

  const glyph = <StatusIcon status={shown} className={calmTone} />;

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-2">
        <StatusIcon status={shown} className={calmTone} label={showLabel ? undefined : `Status: ${label}`} />
        {showLabel ? <span className="text-body text-ink">{label}</span> : null}
      </span>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={`Alterar status de ${title}: ${label}`}
        disabled={pending}
        className={cn(CELL_TRIGGER, showLabel ? "-mx-2 h-8 px-2" : "size-6 justify-center")}
      >
        {glyph}
        {showLabel ? (
          <>
            <span className="text-body text-ink">{label}</span>
            <ChevronDown className="size-3.5 text-faint" aria-hidden />
          </>
        ) : null}
      </DropdownTrigger>
      <DropdownContent align="start" className="min-w-44">
        {STATUS_VALUES.map((value) => (
          <DropdownPrimitive.Item
            key={value}
            className={MENU_ROW}
            onSelect={() => {
              if (value === current) return;
              submit({ taskId, status: value }, () => setCurrent(value));
            }}
          >
            <StatusIcon kind={statusIconKind(value)} />
            <span className="flex-1">{TASK_STATUS_LABELS[value]}</span>
            {value === current ? <Check className="size-4 text-ink-soft" aria-hidden /> : null}
          </DropdownPrimitive.Item>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

export type OwnerOption = { id: string; name: string };

/** Avatar + name; the menu lists the organisation's active internal users. */
export function TaskAssigneeCell({
  taskId,
  assignee,
  owners,
  title,
  readOnly = false,
  avatarOnly = false,
  quietEmpty = false,
}: {
  taskId: string;
  assignee: OwnerOption | null;
  owners: OwnerOption[];
  title: string;
  readOnly?: boolean;
  /** Board cards show only the avatar. */
  avatarOnly?: boolean;
  /** In a grid, "Sem responsável" appears only on the hovered row. */
  quietEmpty?: boolean;
}) {
  const { pending, submit } = useCellSubmit(setTaskAssigneeAction, "Responsável atualizado.");
  const [current, setCurrent] = React.useOptimistic(assignee);

  const face = current ? (
    <>
      <UserAvatar name={current.name} size="xs" />
      {avatarOnly ? null : <span className="truncate text-body text-ink-soft">{current.name}</span>}
    </>
  ) : (
    <>
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-faint">
        <UserRound className="size-3" aria-hidden />
      </span>
      {avatarOnly ? null : <span className={cn("truncate text-body text-faint", quietEmpty && QUIET)}>Sem responsável</span>}
    </>
  );

  if (readOnly) {
    return (
      <span className="inline-flex min-w-0 items-center gap-2" title={current?.name}>
        {face}
      </span>
    );
  }

  const select = (next: OwnerOption | null) => {
    if ((next?.id ?? null) === (current?.id ?? null)) return;
    submit({ taskId, assignedToId: next?.id ?? "" }, () => setCurrent(next));
  };

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={`Alterar responsável de ${title}: ${current?.name ?? "sem responsável"}`}
        title={current?.name}
        disabled={pending}
        className={cn(CELL_TRIGGER, "h-8 max-w-full gap-2", avatarOnly ? "px-1" : "-mx-2 px-2")}
      >
        {face}
      </DropdownTrigger>
      <DropdownContent align="start" className="scroll-slim max-h-72 min-w-56 overflow-y-auto">
        <DropdownPrimitive.Item className={MENU_ROW} onSelect={() => select(null)}>
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-dashed border-line-strong text-faint">
            <UserRound className="size-3" aria-hidden />
          </span>
          <span className="flex-1">Sem responsável</span>
          {current === null ? <Check className="size-4 text-ink-soft" aria-hidden /> : null}
        </DropdownPrimitive.Item>
        {owners.map((owner) => (
          <DropdownPrimitive.Item key={owner.id} className={MENU_ROW} onSelect={() => select(owner)}>
            <UserAvatar name={owner.name} size="xs" />
            <span className="flex-1 truncate">{owner.name}</span>
            {current?.id === owner.id ? <Check className="size-4 text-ink-soft" aria-hidden /> : null}
          </DropdownPrimitive.Item>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

/**
 * A deadline cell. `label` is the pre-formatted date (formatted on the
 * server, in the user's locale); `value` is the `yyyy-mm-dd` the date input
 * edits. `late` paints it red.
 */
export function TaskDueCell({
  taskId,
  value,
  label,
  late = false,
  title,
  readOnly = false,
  quietEmpty = false,
  className,
}: {
  taskId: string;
  value: string;
  label: string;
  late?: boolean;
  title: string;
  readOnly?: boolean;
  /** In a grid, "Sem prazo" appears only on the hovered row. */
  quietEmpty?: boolean;
  className?: string;
}) {
  const { pending, submit } = useCellSubmit(setTaskDueDateAction, "Prazo atualizado.");
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  const text = (
    <span
      className={cn(
        "truncate tabular-nums",
        value ? (late ? "font-medium text-risk" : "text-ink-soft") : "text-faint",
        !value && quietEmpty && QUIET,
        className,
      )}
    >
      {value ? label : "Sem prazo"}
    </span>
  );

  if (readOnly) return text;

  const save = (next: string) => {
    setOpen(false);
    if (next === value) return;
    submit({ taskId, dueDate: next });
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(value);
      }}
    >
      <PopoverPrimitive.Trigger
        aria-label={`Alterar prazo de ${title}: ${value ? label : "sem prazo"}`}
        disabled={pending}
        className={cn(CELL_TRIGGER, "-mx-2 h-8 px-2")}
      >
        {text}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-md border border-line bg-surface p-3 shadow-overlay data-[state=open]:animate-fade-in"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save(draft);
            }}
            className="space-y-3"
          >
            <label className="block text-label font-medium text-ink-soft" htmlFor={`due-${taskId}`}>
              Prazo
            </label>
            <Input
              id={`due-${taskId}`}
              type="date"
              fieldSize="sm"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!value}
                onClick={() => save("")}
              >
                Remover
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Salvar
              </Button>
            </div>
          </form>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
