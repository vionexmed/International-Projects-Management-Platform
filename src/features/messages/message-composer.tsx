"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { sendMessageAction } from "@/server/actions/messages";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      <Send />
      {label}
    </Button>
  );
}

export function MessageComposer({
  threadId,
  labels,
  returnPath,
}: {
  threadId: string;
  labels: { placeholder: string; send: string; sent: string };
  returnPath: string;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);

  const handleAction = async (formData: FormData) => {
    const result = await sendMessageAction({}, formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    formRef.current?.reset();
    toast.success(labels.sent);
    router.refresh();
  };

  return (
    <form ref={formRef} action={handleAction} className="space-y-2.5">
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Textarea
        name="body"
        rows={3}
        required
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        className="bg-surface"
      />
      <div className="flex justify-end">
        <SubmitButton label={labels.send} />
      </div>
    </form>
  );
}
