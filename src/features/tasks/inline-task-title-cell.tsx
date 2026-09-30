"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveInlineDraft } from "@/features/tasks/inline-edit";
import { updateTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

/* Shared by the field and its invisible mirror, so both measure the same. */
const TEXT = "rounded-sm border border-transparent px-1.5 py-1.5 text-body leading-5 whitespace-pre-wrap break-words";

/**
 * A Notion-like task name: the whole title is visible and wraps; click to
 * edit in place. Enter or leaving the field saves, Escape restores. A failed
 * save keeps the typed text and marks the field.
 *
 * The field is only as wide as its text: an invisible copy of the text sits
 * in the same grid cell and sizes it, so `trailing` (an attention glyph)
 * always follows the end of the title, short or long, and the height follows
 * the wrapped lines without measuring anything in script.
 */
export function InlineTaskTitleCell({
  taskId,
  title,
  editable,
  trailing,
}: {
  taskId: string;
  title: string;
  editable: boolean;
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const cancelled = React.useRef(false);
  const [draft, setDraft] = React.useState(title);
  const [saved, setSaved] = React.useState(title);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (!editable) {
    return (
      <span className={cn("block min-w-0 text-ink", TEXT)}>
        {title}
        {trailing ? <span className="ml-1 inline-flex align-middle">{trailing}</span> : null}
      </span>
    );
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
      <span className="flex min-w-0 items-start">
        <span className="inline-grid max-w-full min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
          {/* The mirror: sizes the cell; a trailing space keeps a new last line from collapsing. */}
          <span aria-hidden className={cn("invisible", TEXT)}>
            {draft}{" "}
          </span>
          <textarea
            rows={1}
            // One column: the mirror, not the field's default width, sizes the cell.
            cols={1}
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
            className={cn(
              "relative z-10 h-full w-full min-w-0 resize-none overflow-hidden bg-transparent text-ink outline-none hover:bg-raised/70 focus:border-brand focus:bg-surface aria-[invalid=true]:border-risk",
              TEXT,
            )}
          />
        </span>
        {trailing ? <span className="mt-1 ml-0.5 shrink-0">{trailing}</span> : null}
      </span>
      {error ? <p role="alert" className="px-1.5 pb-1 text-meta text-risk">{error}</p> : null}
    </>
  );
}
