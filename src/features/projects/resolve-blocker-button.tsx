"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveProjectBlockerAction } from "@/server/actions/projects";

/** "Resolver bloqueio", in two steps inside the notice: no browser dialog, no hidden form field. */
export function ResolveBlockerButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setConfirming(true)}>
        <Check />
        Resolver bloqueio
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-meta text-ink-soft">O bloqueio foi resolvido?</span>
      <Button
        type="button"
        size="sm"
        variant="primary"
        disabled={pending}
        autoFocus
        onClick={() =>
          startTransition(async () => {
            const data = new FormData();
            data.set("projectId", projectId);
            const result = await resolveProjectBlockerAction({}, data);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Bloqueio resolvido. O status do projeto foi recalculado.");
            setConfirming(false);
            router.refresh();
          })
        }
      >
        {pending ? "Resolvendo…" : "Sim, resolver"}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </span>
  );
}
