import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The project tabs' one container: a hairline box with a 48-px title strip
 * (14/600 title, quiet count, actions right) and flush content. Tables and
 * 40-px row lists sit directly inside it, edge to edge.
 */
export function WorkBlock({
  title,
  count,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  count?: React.ReactNode;
  description?: React.ReactNode;
  /** `{ label, href }` renders the quiet "Ver todas" link; any node renders as-is. */
  action?: { label: string; href: string } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const linkAction =
    action && typeof action === "object" && !React.isValidElement(action) && "href" in action
      ? (action as { label: string; href: string })
      : null;

  return (
    <section className={cn("min-w-0 overflow-hidden rounded-sm border border-line bg-surface", className)}>
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <div className="min-w-0">
          <h2 className="text-title text-ink">
            {title}
            {count !== undefined && count !== null && count !== "" ? (
              <span className="ml-2 font-normal text-faint tabular-nums">{count}</span>
            ) : null}
          </h2>
          {description ? <p className="text-meta text-muted">{description}</p> : null}
        </div>
        {linkAction ? (
          <Link
            href={linkAction.href}
            className="shrink-0 text-label font-medium text-brand-strong hover:underline"
          >
            {linkAction.label}
          </Link>
        ) : action ? (
          <div className="flex shrink-0 items-center gap-2">{action as React.ReactNode}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** 40-px rows on a faint rule — the dense list used inside a `WorkBlock`. */
export function DenseList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-line-faint", className)}>{children}</ul>;
}

/**
 * One row: a leading glyph, the title (the row's link when `href` is set),
 * optional muted meta after it, and trailing cells. Trailing controls stay
 * clickable above the stretched link.
 */
export function DenseRow({
  leading,
  title,
  meta,
  trailing,
  href,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "relative flex min-h-10 items-center gap-3 px-4 py-1.5",
        href && "transition-colors hover:bg-subtle",
        className,
      )}
    >
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="min-w-0 truncate text-body text-ink">
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </span>
        {meta ? <span className="hidden min-w-0 truncate text-meta text-muted sm:inline">{meta}</span> : null}
      </span>
      {trailing ? (
        <span className="relative z-10 flex shrink-0 items-center gap-3 text-meta text-muted [&:not(:has(a,button))]:pointer-events-none">
          {trailing}
        </span>
      ) : null}
    </li>
  );
}

/** The empty line of a `WorkBlock`. */
export function DenseEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-body text-muted">{children}</p>;
}
