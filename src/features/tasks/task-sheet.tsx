"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/dialog";

/**
 * The task side sheet opened by `?task=<id>`. The URL is the state: the
 * server renders the sheet when the param is present, and closing it
 * navigates to the same view without the param.
 */
export function TaskSheet({
  closeHref,
  aside,
  children,
}: {
  closeHref: string;
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.push(closeHref, { scroll: false });
      }}
    >
      <SheetContent size="lg" aside={aside}>
        {children}
      </SheetContent>
    </Sheet>
  );
}
