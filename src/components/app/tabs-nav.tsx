"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  /**
   * Optional icon before the label, as an element (`<ListChecks />`) — a
   * component reference could not cross from a server page to this client
   * component. Sized to 16 px here.
   */
  icon?: React.ReactNode;
};

/**
 * Link-based tabs. Because filtering happens on the server, each tab is a real
 * URL — shareable, bookmarkable, and correct on a hard refresh.
 *
 * Pass `items` for one flat strip, or `groups` to set related tabs apart with
 * a thin divider (e.g. the record's own tabs vs. the cross-cutting ones).
 * A count of 0 is not shown — a row of zeros is noise, not information.
 *
 * On a phone the strip usually does not fit, and every fresh navigation
 * starts scrolled to the left. Opening a tab near the end landed on a bar
 * that *looked* stuck on the first tab, with no hint that the active tab was
 * off-screen to the right until someone happened to swipe. The active tab
 * now scrolls itself into view; `"nearest"` so a tab already visible never
 * jumps.
 *
 * Geometry: 40-px tabs, 13-px labels, a 2-px turquoise indicator.
 */
export function TabsNav({
  items,
  groups,
  className,
}: (
  | { items: TabItem[]; groups?: never }
  | { groups: TabItem[][]; items?: never }
) & { className?: string }) {
  const sets = groups ?? [items ?? []];
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  const activeHref = sets.flat().find((item) => item.active)?.href;

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeHref]);

  return (
    <div className={cn("relative border-b border-line", className)}>
      {/*
        On a phone the tabs are wider than the screen. The fade says "there is
        more this way"; the trailing padding lets the last tab scroll clear of it.
      */}
      <span
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-canvas sm:hidden"
        aria-hidden
      />
      <nav
        className="scroll-slim -mb-px flex items-center gap-0.5 overflow-x-auto pr-10 sm:pr-0"
        aria-label="Abas"
      >
        {sets.map((set, index) => (
          <React.Fragment key={set[0]?.href ?? index}>
            {index > 0 && set.length > 0 ? (
              <span className="mx-2 h-4 w-px shrink-0 bg-line" aria-hidden />
            ) : null}
            {set.map((item) => {
              return (
                <Link
                  key={item.href}
                  ref={item.active ? activeRef : undefined}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-label font-medium whitespace-nowrap transition-colors sm:px-3",
                    item.active
                      ? "border-brand text-ink"
                      : "border-transparent text-muted hover:border-line-strong hover:text-ink-soft",
                  )}
                >
                  {item.icon ? (
                    <span
                      className={cn(
                        "inline-flex shrink-0 [&_svg]:size-4",
                        item.active ? "text-brand-strong" : "text-faint",
                      )}
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                  ) : null}
                  {item.label}
                  {item.count ? (
                    <span
                      className={cn(
                        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                        item.active ? "bg-brand-soft text-brand-deep" : "bg-raised text-muted",
                      )}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
}
