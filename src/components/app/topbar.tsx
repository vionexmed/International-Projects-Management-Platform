import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Slim header for phones and narrow tablets only (`lg:hidden`). From `lg`
 * up there is no global top bar at all: the page header sits flush under
 * the viewport edge, and search, notifications and the account live in the
 * icon rail.
 *
 * `leading` holds the menu trigger and the brand; `actions` sits before the
 * bell (the search trigger). No `backdrop-blur`: it would make the bar a
 * containing block for `position: fixed` descendants (see the mobile nav).
 */
export function Topbar({
  breadcrumb,
  notificationCount,
  leading,
  actions,
  className,
}: {
  breadcrumb?: React.ReactNode;
  notificationCount: number;
  /** Rendered before the breadcrumb — used for the mobile menu trigger. */
  leading?: React.ReactNode;
  /** Icon buttons placed before the bell. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-line bg-surface px-2 sm:px-4 lg:hidden print:hidden",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-meta text-muted">
        {leading}
        {breadcrumb}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {actions}
        <Link
          href="/notifications"
          aria-label={`Notificações${notificationCount ? ` (${notificationCount} não lidas)` : ""}`}
          className="relative inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Bell className="size-[18px]" />
          {notificationCount > 0 ? (
            <span
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand ring-2 ring-surface"
              aria-hidden
            />
          ) : null}
        </Link>
      </div>
    </header>
  );
}
