"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveInlineDraft, useAutoGrow } from "@/features/tasks/inline-edit";
import { updateTaskAction } from "@/server/actions/tasks";

/**
 * A Notion-like task name: the whole title is visible and wraps; click to
 * edit in place. Enter or leaving the field saves, Escape restores. A failed
 * save keeps the typed text and marks the field.
 */
export function InlineTaskTitleCell({ taskId, title, editable }: { taskId: string; title: string; editable: boolean }) {
  const router = useRouter();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const cancelled = React.useRef(false);
  const [draft, setDraft] = React.useState(title);
  const [saved, setSaved] = React.useState(title);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  useAutoGrow(ref, draft);

  if (!editable) {
    return <span className="block min-w-0 px-1.5 py-1.5 text-body whitespace-pre-wrap break-words text-ink">{title}</span>;
  }

  const save = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    if (!next) {
      setDraft(saved);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await saveInlineDraft(next, saved, (value) => {
        const data = new FormData();
        data.set("taskId", taskId);
        data.set("title", value);
        return updateTaskAction({}, data);
      });
      setDraft(result.draft);
      setSaved(result.saved);
      setError(result.error);
      if (result.error) toast.error(result.error);
      else if (result.saved !== saved) router.refresh();
    });
  };

  return (
    <>
      <textarea
        ref={ref}
        rows={1}
        aria-label={`Nome da tarefa: ${saved}`}
        aria-invalid={error ? true : undefined}
        value={draft}
        readOnly={pending}
        onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            cancelled.current = true;
            setDraft(saved);
            setError(null);
            event.currentTarget.blur();
          }
        }}
        className="relative z-10 block w-full min-w-0 resize-none overflow-hidden rounded-sm border border-transparent bg-transparent px-1.5 py-1.5 text-body leading-5 whitespace-pre-wrap break-words text-ink outline-none field-sizing-content hover:bg-raised/70 focus:border-brand focus:bg-surface aria-[invalid=true]:border-risk"
      />
      {error ? <p role="alert" className="px-1.5 pb-1 text-meta text-risk">{error}</p> : null}
    </>
  );
}
