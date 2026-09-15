"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/app/file-dropzone";
import { useFormAction } from "@/components/app/use-form-action";
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
 */
export function SubmitRequestForm({
  requestId,
  dict,
  accept,
  maxSizeMb,
}: {
  requestId: string;
  dict: Dictionary;
  accept: string;
  maxSizeMb: number;
}) {
  const router = useRouter();
  const [clearedAt, setClearedAt] = React.useState(0);

  const handleSuccess = React.useCallback(
    (_result: ActionState, form: HTMLFormElement) => {
      toast.success(dict.portal.requests.submitSuccess);
      form.reset();
      // `form.reset()` empties the native input; the dropzone keeps its own
      // copy in React state, so it is remounted to clear both at once.
      setClearedAt((value) => value + 1);
      router.refresh();
    },
    [dict, router],
  );

  const { state, pending, onSubmit } = useFormAction(
    submitDocumentRequestAction,
    handleSuccess,
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="requestId" value={requestId} />

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-sm border border-risk/25 bg-risk-soft px-3 py-2.5 text-[13px] text-risk"
        >
          <AlertCircle className="mt-px size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div>
        <Label className="mb-2 block">{dict.portal.requests.uploadTitle}</Label>
        <FileDropzone
          key={clearedAt}
          accept={accept}
          maxSizeMb={maxSizeMb}
          disabled={pending}
          hint={interpolate(dict.portal.requests.allowedTypes, { size: maxSizeMb })}
          labels={{
            title: dict.portal.requests.uploadTitle,
            dropHint: dict.portal.requests.uploadHint,
            choose: dict.portal.requests.chooseFile,
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">{dict.portal.requests.replyLabel}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          disabled={pending}
          placeholder={dict.portal.requests.replyPlaceholder}
        />
      </div>

      {/*
        A server action carries no upload progress events, so there is no honest
        percentage to show. What there is: a clear statement that the send is in
        flight, and a request not to close the tab. Silence — which is what a
        button reading "…" amounts to — is what makes people give up or submit
        twice.
      */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {pending ? (
          <p
            role="status"
            aria-live="polite"
            className="mr-auto flex items-center gap-2.5 text-[13px] text-muted"
          >
            <span
              aria-hidden
              className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-brand"
            />
            <span>
              <span className="font-medium text-ink">{dict.portal.requests.sending}</span>{" "}
              {dict.portal.requests.sendingHint}
            </span>
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          <Send />
          {pending ? dict.portal.requests.sending : dict.common.submit}
        </Button>
      </div>
    </form>
  );
}
