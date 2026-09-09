import Link from "next/link";
import { Bell, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Thin top strip. It holds only what must be reachable from anywhere —
 * everything else lives in the page body.
 */
export function Topbar({
  breadcrumb,
  notificationCount,
  messageCount,
  leading,
  className,
}: {
  breadcrumb?: React.ReactNode;
  notificationCount: number;
  messageCount?: number;
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
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
        {leading}
        {breadcrumb}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {typeof messageCount === "number" ? (
          <IconLink
            href="/projects"
            label={`Mensagens${messageCount ? ` (${messageCount} não lidas)` : ""}`}
            count={messageCount}
          >
            <MessageSquare className="size-[18px]" />
          </IconLink>
        ) : null}

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
