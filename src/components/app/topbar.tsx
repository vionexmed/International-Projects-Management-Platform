import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Thin top strip. It holds only what must be reachable from anywhere —
 * everything else lives in the page body.
 *
 * The bell shows only below `lg`, where the sidebar (and its Notificações
 * badge) is hidden: on desktop two indicators for the same unread count were
 * one too many. There is no messages icon — conversations live in each
 * project, and an icon that led to the project list promised an inbox that
 * does not exist.
 */
export function Topbar({
  breadcrumb,
  notificationCount,
  leading,
  className,
}: {
  breadcrumb?: React.ReactNode;
  notificationCount: number;
  /** Rendered before the breadcrumb — used for the mobile menu trigger. */
  leading?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/95 px-6 backdrop-blur",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-meta text-muted">
        {leading}
        {breadcrumb}
      </div>

      <div className="flex shrink-0 items-center gap-1 lg:hidden">
        <IconLink
          href="/notifications"
          label={`Notificações${notificationCount ? ` (${notificationCount} não lidas)` : ""}`}
          count={notificationCount}
        >
          <Bell className="size-[18px]" />
        </IconLink>
      </div>
    </header>
  );
}

function IconLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
      {count > 0 ? (
        <span
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand ring-2 ring-surface"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
