"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/app/file-dropzone";
import { submitDocumentRequestAction } from "@/server/actions/documents";
import type { ActionState } from "@/server/actions/utils";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { interpolate } from "@/lib/i18n/dictionary";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      <Send />
      {pending ? "…" : label}
    </Button>
  );
}

/**
 * Upload plus optional note. Either one is enough to answer a request, so a
 * supplier can reply "the file is coming next week" without being blocked.
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
  const [state, setState] = React.useState<ActionState>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  const handleAction = async (formData: FormData) => {
    const result = await submitDocumentRequestAction(state, formData);
    setState(result);

    if (result.ok) {
      toast.success(dict.portal.requests.submitSuccess);
      formRef.current?.reset();
      router.refresh();
    }
  };

  return (
    <form ref={formRef} action={handleAction} className="space-y-5">
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
          accept={accept}
          maxSizeMb={maxSizeMb}
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
          placeholder={dict.portal.requests.replyPlaceholder}
        />
      </div>

      <div className="flex justify-end">
        <SubmitButton label={dict.common.submit} />
      </div>
    </form>
  );
}
