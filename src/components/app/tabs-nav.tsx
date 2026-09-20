"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = {
  href: string;
  label: string;
  count?: number;
  active: boolean;
};

/**
 * Link-based tabs. Because filtering happens on the server, each tab is a real
 * URL — shareable, bookmarkable, and correct on a hard refresh.
 *
 * On a phone the strip usually does not fit — a project page alone has nine
 * of these — and every fresh navigation starts scrolled to the left. Opening
 * a tab near the end (e.g. "Histórico") landed on a bar that *looked* stuck
 * on "Visão geral", with no hint that the active tab was off-screen to the
 * right until someone happened to swipe. The active tab now scrolls itself
 * into view; `"nearest"` so a tab already visible never jumps.
 */
export function TabsNav({ items, className }: { items: TabItem[]; className?: string }) {
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  const activeHref = items.find((item) => item.active)?.href;

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeHref]);

  return (
    <div className={cn("border-b border-line", className)}>
      <nav className="scroll-slim -mb-px flex items-center gap-1 overflow-x-auto" aria-label="Abas">
        {items.map((item) => (
          <Link
            key={item.href}
            ref={item.active ? activeRef : undefined}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              item.active
                ? "border-brand text-ink"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink-soft",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
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
        ))}
      </nav>
    </div>
  );
}
