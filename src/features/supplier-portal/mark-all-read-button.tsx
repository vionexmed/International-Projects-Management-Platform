"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/server/actions/notifications";

/**
 * "Mark all as read", with the result visible at once.
 *
 * The action revalidates the internal notification paths, not the portal's,
 * so on its own the list and the bell in the header could keep showing unread
 * rows after the click. Refreshing here updates both, whatever the action
 * chooses to revalidate.
 */
export function MarkAllReadButton({ label, done }: { label: string; done: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsReadAction();
          router.refresh();
          toast.success(done);
        })
      }
    >
      <CheckCheck />
      {label}
    </Button>
  );
}
