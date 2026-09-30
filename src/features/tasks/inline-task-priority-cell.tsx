"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Dropdown, DropdownContent, DropdownTrigger } from "@/components/ui/dropdown";
import type { TaskPriority } from "@/generated/prisma";
import { setTaskPriorityAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

const OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Baixa" }, { value: "MEDIUM", label: "Média" }, { value: "HIGH", label: "Alta" }, { value: "URGENT", label: "Urgente" },
];

/** Soft tags, as a Notion select: the colour grows with the urgency. */
const TONE: Record<TaskPriority, string> = {
  LOW: "bg-raised text-muted",
  MEDIUM: "bg-info-soft text-info",
  HIGH: "bg-warn-soft text-warn",
  URGENT: "bg-risk-soft text-risk",
};

const MENU_ROW =
  "flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] text-ink-soft outline-none select-none data-[highlighted]:bg-raised data-[highlighted]:text-ink";

const labelOf = (priority: TaskPriority) => OPTIONS.find((option) => option.value === priority)?.label ?? "";

function PriorityTag({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-meta font-medium whitespace-nowrap", TONE[priority])}>
      {labelOf(priority)}
    </span>
  );
}

export function InlineTaskPriorityCell({
  taskId,
  priority,
  editable,
  title,
}: {
  taskId: string;
  priority: TaskPriority;
  editable: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [current, setCurrent] = React.useOptimistic(priority);

  if (!editable) {
    return (
      <span className="inline-flex h-8 items-center px-2">
        <PriorityTag priority={priority} />
      </span>
    );
  }

  const select = (next: TaskPriority) => {
    if (next === current) return;
    startTransition(async () => {
      setCurrent(next);
      const data = new FormData();
      data.set("taskId", taskId);
      data.set("priority", next);
      const result = await setTaskPriorityAction({}, data);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  };

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={`Prioridade${title ? ` de ${title}` : ""}: ${labelOf(current)}`}
        disabled={pending}
        className="relative z-10 inline-flex h-8 items-center rounded-sm px-2 transition-colors hover:bg-raised/70 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60 data-[state=open]:bg-raised"
      >
        <PriorityTag priority={current} />
      </DropdownTrigger>
      <DropdownContent align="start" className="min-w-40">
        {OPTIONS.map((option) => (
          <DropdownPrimitive.Item key={option.value} className={MENU_ROW} onSelect={() => select(option.value)}>
            <span className="flex-1">
              <PriorityTag priority={option.value} />
            </span>
            {option.value === current ? <Check className="size-4 text-ink-soft" aria-hidden /> : null}
          </DropdownPrimitive.Item>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
