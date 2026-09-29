"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTaskAction } from "@/server/actions/tasks";

/** A Notion-like task name: focus edits in place; blur or Enter saves it. */
export function InlineTaskTitleCell({ taskId, title, editable }: { taskId: string; title: string; editable: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(title);
  const [pending, startTransition] = React.useTransition();

  const save = () => {
    const next = draft.trim();
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    startTransition(async () => {
      const data = new FormData();
      data.set("taskId", taskId);
      data.set("title", next);
      const result = await updateTaskAction({}, data);
      if (result.error) {
        toast.error(result.error);
        setDraft(title);
        return;
      }
      router.refresh();
    });
  };

  if (!editable) return <span className="min-w-0 truncate text-body text-ink">{title}</span>;

  return <input aria-label={`Nome da tarefa: ${title}`} value={draft} disabled={pending} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(title); event.currentTarget.blur(); } }} className="relative z-10 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 text-body text-ink outline-none hover:border-line focus:border-brand focus:bg-surface disabled:opacity-60" />;
}
