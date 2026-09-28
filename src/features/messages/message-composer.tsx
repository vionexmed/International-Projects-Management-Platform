"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useFormAction } from "@/components/app/use-form-action";
import { needsDirectUpload, useDirectUpload } from "@/components/app/use-direct-upload";
import { sendMessageAction } from "@/server/actions/messages";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS, maxUploadMb } from "@/lib/upload";
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
  maxSizeMb,
}: {
  threadId: string;
  labels: {
    placeholder: string;
    send: string;
    sent: string;
    attach: string;
    remove: string;
    /** The rest is optional so the internal screens keep their defaults. */
    sending?: string;
    /** Keyboard hint shown beside the send button. */
    shortcut?: string;
    /** Refusal for an empty send (no text, no file). */
    empty?: string;
    /** `{size}` is the limit in MB. */
    fileTooLarge?: string;
    fileType?: string;
    /** Progress of a large attachment; `{percent}` is 0–100. */
    uploading?: string;
    /** Direct-upload failures the browser sees itself; `{status}` is HTTP. */
    connectionFailed?: string;
    storageRefused?: string;
    /** Shown when the send could not reach the server at all. */
    unreachable?: string;
  };
  returnPath: string;
  /** Read on the server; checked here so an oversized file is refused before it is sent. */
  maxSizeMb?: number;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const tokenRef = React.useRef<HTMLInputElement>(null);
  const [file, setFileState] = React.useState<File | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  /**
   * Large files go straight to storage first, the way documents do: the
   * platform refuses any request above ~4.5 MB before our code runs. The form
   * then carries a receipt (`uploadToken`) instead of the bytes.
   */
  const { prepare, progress } = useDirectUpload(
    { connectionFailed: labels.connectionFailed, storageRefused: labels.storageRefused },
    "attachment",
  );

  // A receipt belongs to one file: choosing or removing a file voids it.
  const setFile = React.useCallback((next: File | null) => {
    if (tokenRef.current) tokenRef.current.value = "";
    setFileState(next);
  }, []);

  const clearFile = () => {
    if (fileRef.current) fileRef.current.value = "";
    setFile(null);
  };

  /** Type and size are checked on pick, in the viewer's language, before any upload. */
  const pickFile = (next: File | null) => {
    setLocalError(null);
    if (!next) return setFile(null);

    const lower = next.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      clearFile();
      setLocalError(labels.fileType ?? "Tipo de arquivo não permitido.");
      return;
    }
    if (maxSizeMb && next.size > maxSizeMb * 1024 * 1024) {
      clearFile();
      setLocalError(
        (labels.fileTooLarge ?? "O arquivo excede {size} MB.").replace("{size}", String(maxSizeMb)),
      );
      return;
    }
    setFile(next);
  };

  const handleSuccess = React.useCallback(
    (_result: ActionState, form: HTMLFormElement) => {
      form.reset();
      setFile(null);
      toast.success(labels.sent);
      router.refresh();
    },
    [labels.sent, router, setFile],
  );

  const { state, pending, onSubmit } = useFormAction(sendMessageAction, handleSuccess, {
    unreachableError: labels.unreachable,
  });
  const busy = pending || progress !== null;

  React.useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const body = (event.currentTarget.elements.namedItem("body") as HTMLTextAreaElement | null)
      ?.value;
    if (!body?.trim() && !file) {
      event.preventDefault();
      setLocalError(labels.empty ?? "Escreva uma mensagem ou anexe um arquivo.");
      return;
    }
    setLocalError(null);

    // Small files — and a file whose receipt is already in hand after a failed
    // send — travel exactly as before.
    const alreadyUploaded = Boolean(tokenRef.current?.value);
    if (!file || alreadyUploaded || !needsDirectUpload(file)) return onSubmit(event);

    event.preventDefault();
    const form = event.currentTarget;
    void (async () => {
      const prepared = await prepare(file, threadId);
      if (!prepared.ok) return setLocalError(prepared.error);

      if (prepared.token) {
        // Uploaded already: send the receipt and keep the bytes off the request.
        tokenRef.current!.value = prepared.token;
        if (fileRef.current) fileRef.current.value = "";
      }
      onSubmit({
        currentTarget: form,
        preventDefault: () => {},
      } as unknown as React.FormEvent<HTMLFormElement>);
    })();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2.5">
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <input ref={tokenRef} type="hidden" name="uploadToken" defaultValue="" />

      <Textarea
        name="body"
        rows={3}
        disabled={busy}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        aria-describedby={localError ? `${threadId}-composer-error` : undefined}
        className="bg-surface"
        onChange={() => {
          if (localError) setLocalError(null);
        }}
        onKeyDown={(event) => {
          // Ctrl/⌘ + Enter sends; a plain Enter stays a new line, because
          // messages here are often several paragraphs long.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />

      {progress !== null ? (
        <span role="status" aria-live="polite" className="sr-only">
          {(labels.uploading ?? "Enviando arquivo… {percent}%").replace("{percent}", String(progress))}
        </span>
      ) : null}

      {localError ? (
        <p id={`${threadId}-composer-error`} role="alert" className="text-[12px] font-medium text-risk">
          {localError}
        </p>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        name="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {file ? (
          <span className="flex min-w-0 items-center gap-2 rounded-sm border border-line bg-subtle px-2.5 py-1.5 text-[12px]">
            <Paperclip className="size-3.5 shrink-0 text-muted" aria-hidden />
            <span className="truncate text-ink">{file.name}</span>
            <span className="shrink-0 text-muted">{formatFileSize(file.size)}</span>
            <button
              type="button"
              disabled={busy}
              aria-label={labels.remove}
              onClick={clearFile}
              className="-my-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-md:h-10"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
            {labels.attach}
          </Button>
        )}

        <span className="ml-auto flex items-center gap-3">
          {labels.shortcut ? (
            <span className="text-[12px] text-faint max-md:hidden">{labels.shortcut}</span>
          ) : null}
          <Button type="submit" variant="primary" size="sm" disabled={busy} className="max-md:h-10">
            <Send />
            {progress !== null
              ? (labels.uploading ?? "Enviando arquivo… {percent}%").replace(
                  "{percent}",
                  String(progress),
                )
              : pending
                ? (labels.sending ?? labels.send)
                : labels.send}
          </Button>
        </span>
      </div>
    </form>
  );
}

/** The ceiling shown next to the attach control, read from configuration. */
export function attachmentLimitMb() {
  return maxUploadMb();
}
