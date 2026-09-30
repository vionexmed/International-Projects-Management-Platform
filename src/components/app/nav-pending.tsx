"use client";

import { useLinkStatus } from "next/link";

/**
 * Immediate feedback for a sidebar link while its page loads: the item
 * lights up at once, and a thin bar runs along the top of the window. Both
 * wait 120ms before showing, so a fast navigation never flickers them.
 * Must sit inside the <Link> it reports on.
 */
export function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span aria-hidden className="vx-nav-pending pointer-events-none absolute inset-0 rounded-sm bg-white/8" />
      <span aria-hidden className="vx-nav-pending pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden">
        <span className="vx-nav-progress block h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-brand-line to-brand" />
      </span>
    </>
  );
}
