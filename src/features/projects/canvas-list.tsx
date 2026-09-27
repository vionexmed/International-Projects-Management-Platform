import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A short list sitting directly on the canvas, under a `Section` title — no
 * card around it. Rows are separated by hairlines only, so a page with three
 * short lists reads as one document instead of three stacked rectangles.
 *
 * Used by the record pages (project overview, stage pages, supplier detail)
 * and the dashboard deadlines: anything under ~8 rows that is not a table.
 */
export function CanvasList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-line border-y border-line", className)}>{children}</ul>;
}

/**
 * One row: primary text, an optional secondary line, and a trailing slot
 * (status, date, action). With `href` the whole row is the link; a `trailing`
 * control that must stay clickable on its own (a StatusMenu, a download link)
 * lifts itself above the row with `relative z-10`.
 */
export function CanvasRow({
  title,
  subtitle,
  leading,
  trailing,
  href,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <li className={cn("group relative flex items-center gap-x-4 gap-y-1 py-3", className)}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">
          {href ? (
            <Link
              href={href}
              className="underline-offset-4 group-hover:underline after:absolute after:inset-0"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {subtitle ? <p className="mt-0.5 truncate text-meta text-muted">{subtitle}</p> : null}
      </div>
      {trailing ? (
        <div className="relative z-10 flex shrink-0 items-center gap-4 [&:not(:has(a,button))]:pointer-events-none">
          {trailing}
        </div>
      ) : null}
    </li>
  );
}

/** The canvas counterpart of `EmptyState`: one quiet line, not a centred block. */
export function CanvasEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-y border-line py-4 text-body text-muted">{children}</p>
  );
}
