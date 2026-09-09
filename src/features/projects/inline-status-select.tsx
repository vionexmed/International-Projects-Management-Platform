"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/input";
import type { ActionState } from "@/server/actions/utils";

/**
 * A status cell that saves on change. Used inside dense tables where opening a
 * dialog to flip one field would be friction.
 */
export function InlineStatusSelect({
  action,
  hidden,
  name,
  value,
  options,
  ariaLabel,
  successMessage = "Status atualizado.",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  // The optimistic value reverts to the server value on its own if the
  // action fails, so no manual rollback bookkeeping is needed.
  const [current, setCurrent] = React.useOptimistic(value);

  const submit = (next: string) => {
    startTransition(async () => {
      setCurrent(next);

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
    <Select
      aria-label={ariaLabel}
      value={current}
      disabled={pending}
      onChange={(event) => submit(event.target.value)}
      className="h-8 w-auto min-w-32 text-[13px]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
