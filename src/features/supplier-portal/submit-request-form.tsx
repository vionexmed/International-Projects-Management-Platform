"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/app/file-dropzone";
import { flyFile } from "@/components/app/fly-to";
import { useFormAction } from "@/components/app/use-form-action";
import { useDirectUpload } from "@/components/app/use-direct-upload";
import { submitDocumentRequestAction } from "@/server/actions/documents";
import type { ActionState } from "@/server/actions/utils";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { interpolate } from "@/lib/i18n/dictionary";

/**
 * Upload plus optional note. Either one is enough to answer a request, so a
 * supplier can reply "the file is coming next week" without being blocked.
 *
 * This is the single most important form in the product: it is where a
 * manufacturer on the other side of the world, often on an unreliable
 * connection, hands Vionex the document it asked for. Three things follow from
 * that and are deliberate here — the fields survive a failure, the wait is
 * visible, and a success clears the field for real.
 *
 * Everything the browser can check is checked before a byte leaves it: the
 * file's type, size and emptiness in the drop zone, and "nothing to send" here
 * — each in the supplier's language, where the server would answer in ours.
 */
export function SubmitRequestForm({
  requestId,
  projectId,
  dict,
  accept,
  maxSizeMb,
  resubmission = false,
}: {
  requestId: string;
  /** Needed to authorise the upload before the file leaves the browser. */
  projectId: string;
  dict: Dictionary;
  accept: string;
  maxSizeMb: number;
  /** A new version after "changes requested" — only the wording differs. */
  resubmission?: boolean;
}) {
  const t = dict.portal.requests;
  const router = useRouter();
  const [clearedAt, setClearedAt] = React.useState(0);
  const [hasFile, setHasFile] = React.useState(false);
  const { prepare, progress } = useDirectUpload({
    connectionFailed: t.connectionFailed,
    storageRefused: t.storageRefused,
  });
  const [localError, setLocalError] = React.useState<string | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);
  // The name of the file being sent: a large one is taken out of the input once uploaded.
  const sending = React.useRef<string | null>(null);

  const handleSuccess = React.useCallback(
    (_result: ActionState, form: HTMLFormElement) => {
      // The file flies from the drop zone into Documents, before the zone is cleared.
      const zone = form.querySelector("[data-dropzone]");
      if (sending.current && zone) flyFile({ from: zone.getBoundingClientRect(), name: sending.current });
      sending.current = null;
      toast.success(t.submitSuccess);
      form.reset();
      // `form.reset()` empties the native input; the dropzone keeps its own
      // copy in React state, so it is remounted to clear both at once.
      setClearedAt((value) => value + 1);
      setHasFile(false);
      router.refresh();
      // The page is about to swap the form for the "under review" callout at
      // the top; take the reader there instead of leaving them facing the
      // space where the form used to be.
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [t, router],
  );

  const { state, pending, onSubmit } = useFormAction(submitDocumentRequestAction, handleSuccess, {
    unreachableError: t.sendFailed,
  });

  const busy = pending || progress !== null;
  const shownError = localError ?? (state.error ? state.error : null);

  React.useEffect(() => {
    if (shownError) errorRef.current?.focus();
  }, [shownError]);

  /**
   * The file goes to storage first when it is large, and the form then carries
   * a receipt instead of the bytes.
   *
   * Without this, a 5 MB document was rejected by the platform before the
   * application saw the request — the manufacturer got an error page with
   * nothing in it, on the one screen where being unable to deliver a document
   * is the whole problem.
   */
  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget;
      const input = form.elements.namedItem("file") as HTMLInputElement | null;
      const file = input?.files?.[0];
      const message = (form.elements.namedItem("message") as HTMLTextAreaElement | null)?.value;

      setLocalError(null);
      sending.current = file?.name ?? null;

      if (!file && !message?.trim()) {
        event.preventDefault();
        setLocalError(t.nothingToSend);
        return;
      }

      if (!file) return onSubmit(event);

      event.preventDefault();

      const prepared = await prepare(file, projectId);
      if (!prepared.ok) {
        setLocalError(prepared.error);
        return;
      }

      if (prepared.token) {
        // Uploaded already: send the receipt and drop the file from the form.
        const token = form.elements.namedItem("uploadToken") as HTMLInputElement;
        token.value = prepared.token;
        input!.value = "";
      }

      onSubmit({
        ...event,
        currentTarget: form,
        preventDefault: () => {},
      } as unknown as React.FormEvent<HTMLFormElement>);
    },
    [onSubmit, prepare, projectId, t],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="uploadToken" defaultValue="" />

      {shownError ? (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2.5 rounded-sm border border-risk/25 bg-risk-soft px-3 py-2.5 text-meta text-risk outline-none"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
          <span>
            {/* A server refusal can arrive in another language; our sentence
                says what to do, theirs says why. */}
            {localError ? (
              localError
            ) : (
              <>
                <span className="block font-medium">{t.sendFailed}</span>
                {state.error !== t.sendFailed ? (
                  <span className="mt-0.5 block">{state.error}</span>
                ) : null}
              </>
            )}
          </span>
        </div>
      ) : null}

      <div>
        {/* The panel title above already says "Upload document"; this names the field for assistive tech only. */}
        <Label className="sr-only">{t.uploadTitle}</Label>
        <FileDropzone
          key={clearedAt}
          accept={accept}
          maxSizeMb={maxSizeMb}
          disabled={busy}
          onFileChange={(next) => {
            setHasFile(Boolean(next));
            if (next) setLocalError(null);
          }}
          hint={interpolate(t.allowedTypes, { size: maxSizeMb })}
          labels={{
            title: t.uploadTitle,
            dropHint: t.uploadHint,
            choose: t.chooseFile,
            remove: dict.portal.messages.removeFile,
            typeError: t.fileTypeError,
            sizeError: t.fileSizeError,
            emptyError: t.fileEmptyError,
          }}
        />

        {progress !== null ? (
          <div className="mt-3" role="status" aria-live="polite">
            <p className="mb-1.5 text-meta text-ink-soft tabular-nums">
              {interpolate(t.uploadingPercent, { percent: progress })}
            </p>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-raised"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t.uploadTitle}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">{t.replyLabel}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          disabled={busy}
          placeholder={t.replyPlaceholder}
          onChange={() => {
            if (localError === t.nothingToSend) setLocalError(null);
          }}
        />
      </div>

      {/*
        A server action carries no upload progress events, so there is no honest
        percentage to show. What there is: a clear statement that the send is in
        flight, and a request not to close the tab. Silence — which is what a
        button reading "…" amounts to — is what makes people give up or submit
        twice.
      */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        {pending ? (
          <p
            role="status"
            aria-live="polite"
            className="mr-auto flex items-center gap-2.5 text-meta text-muted"
          >
            <span
              aria-hidden
              className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-brand"
            />
            <span>
              <span className="font-medium text-ink">{t.sending}</span> {t.sendingHint}
            </span>
          </p>
        ) : (
          <p className="mr-auto flex max-w-md items-start gap-2 text-meta text-muted">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-medium text-ink-soft">{t.nextStepsTitle}:</span> {t.nextSteps}
            </span>
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={busy} className="max-sm:w-full">
          <Send />
          {busy ? t.sending : resubmission && hasFile ? t.resubmit : t.sendToVionex}
        </Button>
      </div>
    </form>
  );
}
