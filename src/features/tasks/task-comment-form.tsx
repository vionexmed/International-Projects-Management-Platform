"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addTaskCommentAction } from "@/server/actions/tasks";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Enviando…" : "Comentar"}
    </Button>
  );
}

export function TaskCommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);

  const handleAction = async (formData: FormData) => {
    const result = await addTaskCommentAction({}, formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    formRef.current?.reset();
    toast.success("Comentário adicionado.");
    router.refresh();
  };

  return (
    <form ref={formRef} action={handleAction} className="space-y-2.5">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea
        name="body"
        rows={3}
        required
        placeholder="Escreva um comentário para a equipe…"
        aria-label="Novo comentário"
      />
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
