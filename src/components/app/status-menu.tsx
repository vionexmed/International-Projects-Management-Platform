"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, StatusDot } from "@/components/ui/badge";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import type { Tone } from "@/lib/status";
import type { ActionState } from "@/server/actions/utils";
import { cn } from "@/lib/utils";

export type StatusOption = { value: string; label: string; tone: Tone };

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * An editable status that looks like every other status: the same
 * `StatusBadge`, inside a quiet dropdown trigger. It replaces the inline
 * `<select>`, which put a form control in the middle of a table and showed
 * the same concept two ways depending on who was looking.
 *
 * Submits exactly like `InlineStatusSelect` — pass the same `action`,
 * `hidden` fields and `name`, and the server action receives the same
 * FormData — so a page swaps one for the other without touching the server.
 * `onSelect` is the escape hatch for a caller that saves some other way.
 *
 * `readOnly` renders the bare badge, so a page can hand one component the
 * permission check instead of branching between two.
 */
export function StatusMenu({
  options,
  value,
  ariaLabel,
  action,
  hidden = {},
  name = "status",
  onSelect,
  successMessage = "Status atualizado.",
  readOnly = false,
  align = "start",
  className,
}: {
  options: StatusOption[];
  value: string;
  ariaLabel: string;
  action?: ServerAction;
  hidden?: Record<string, string>;
  name?: string;
  onSelect?: (value: string) => void | Promise<void>;
  successMessage?: string;
  readOnly?: boolean;
  align?: "start" | "end";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  // Reverts to the server value on its own if the action fails.
  const [current, setCurrent] = React.useOptimistic(value);

  const selected = options.find((option) => option.value === current) ?? {
    value: current,
    label: current,
    tone: "neutral" as Tone,
  };

  if (readOnly || (!action && !onSelect)) {
    return (
      <StatusBadge tone={selected.tone} className={className}>
        {selected.label}
      </StatusBadge>
    );
  }

  const submit = (next: string) => {
    if (next === current) return;
    startTransition(async () => {
      setCurrent(next);

      if (onSelect) {
        await onSelect(next);
        return;
      }
      if (!action) return;

      const formData = new FormData();
      for (const [key, hiddenValue] of Object.entries(hidden)) formData.set(key, hiddenValue);
      formData.set(name, next);

      const result = await action({}, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  };

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={`${ariaLabel}: ${selected.label}`}
        disabled={pending}
        className={cn(
          // `relative z-10` lifts the trigger above a row's stretched link.
          "relative z-10 -mx-2 inline-flex h-8 items-center gap-1.5 rounded-sm px-2 transition-colors",
          "hover:bg-raised data-[state=open]:bg-raised disabled:opacity-60",
          className,
        )}
      >
        <StatusBadge tone={selected.tone}>{selected.label}</StatusBadge>
        <ChevronDown className="size-3.5 text-faint" aria-hidden />
      </DropdownTrigger>
      <DropdownContent align={align} className="min-w-44">
        {options.map((option) => (
          <DropdownItem key={option.value} onSelect={() => submit(option.value)}>
            <StatusDot tone={option.tone} />
            <span className="flex-1">{option.label}</span>
            {option.value === current ? <Check className="text-ink-soft" aria-hidden /> : null}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
