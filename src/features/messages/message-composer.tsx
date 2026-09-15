"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useFormAction } from "@/components/app/use-form-action";
import { sendMessageAction } from "@/server/actions/messages";
import { ACCEPT_ATTRIBUTE, maxUploadMb } from "@/lib/upload";
import { formatFileSize } from "@/lib/format";
import type { ActionState } from "@/server/actions/utils";

/**
 * Writing a message, with or without a file.
 *
 * Driven from `onSubmit` like every other form here, so a failed send does not
 * take the text with it — see `useFormAction`. The attachment is chosen with a
 * plain file input rather than the drop zone: a composer is a single line of
 * chrome under a conversation, and a drop target that size is a worse target
 * than a button.
 */
export function MessageComposer({
  threadId,
  labels,
  returnPath,
}: {
  threadId: string;
  labels: { placeholder: string; send: string; sent: string; attach: string; remove: string };
  returnPath: string;
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);

  const handleSuccess = React.useCallback(
    (_result: ActionState, form: HTMLFormElement) => {
      form.reset();
      setFile(null);
      toast.success(labels.sent);
      router.refresh();
    },
    [labels.sent, router],
  );

  const { state, pending, onSubmit } = useFormAction(sendMessageAction, handleSuccess);

  React.useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="returnPath" value={returnPath} />

      <Textarea
        name="body"
        rows={3}
        disabled={pending}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        className="bg-surface"
      />

      <input
        ref={fileRef}
        type="file"
        name="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {file ? (
          <span className="flex min-w-0 items-center gap-2 rounded-sm border border-line bg-subtle px-2.5 py-1.5 text-[12px]">
            <Paperclip className="size-3.5 shrink-0 text-muted" />
            <span className="truncate text-ink">{file.name}</span>
            <span className="shrink-0 text-muted">{formatFileSize(file.size)}</span>
            <button
              type="button"
              disabled={pending}
              aria-label={labels.remove}
              onClick={() => {
                if (fileRef.current) fileRef.current.value = "";
                setFile(null);
              }}
              className="rounded-sm p-0.5 text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
            {labels.attach}
          </Button>
        )}

        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          <Send />
          {labels.send}
        </Button>
      </div>
    </form>
  );
}

/** The ceiling shown next to the attach control, read from configuration. */
export function attachmentLimitMb() {
  return maxUploadMb();
}
