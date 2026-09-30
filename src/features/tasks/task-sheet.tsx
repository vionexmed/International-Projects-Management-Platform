"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/dialog";

/**
 * A task opened as a centred window over the page it was opened from.
 *
 * Two ways in, one look. From the plan, `?task=<id>` is the state: closing
 * replaces the URL with `closeHref` (`replace`, so Back does not reopen it).
 * From anywhere else, `/tasks/<id>` is intercepted into this window and
 * closing steps back through history — to the page underneath.
 */
export function TaskSheet({
  closeHref,
  openPath,
  aside,
  children,
}: {
  /** Omit to close by going back (the intercepted `/tasks/<id>` route). */
  closeHref?: string;
  /**
   * The intercepted route's own path. A parallel slot keeps its last content
   * across client navigations, so the window hides itself once the URL has
   * moved on (Back, or a link inside it).
   */
  openPath?: string;
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (openPath && pathname !== openPath) return null;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (open) return;
        if (closeHref) router.replace(closeHref, { scroll: false });
        else router.back();
      }}
    >
      <SheetContent size="modal" aside={aside}>
        {children}
      </SheetContent>
    </Sheet>
  );
}
