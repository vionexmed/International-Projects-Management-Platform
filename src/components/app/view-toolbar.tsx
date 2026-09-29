import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The 48-px strip under a page or project header: what you are looking at on
 * the left (a "View: …" label or dropdown), how (List/Board toggle) in the
 * middle, and filters/actions on the right. Controls inside use the 32-px
 * sizes (`Button size="sm"`, `fieldSize="sm"`).
 *
 * From `md` up the three slots sit on a 1fr/auto/1fr grid, so the toggle is
 * truly centred whatever the sides hold; on a phone they wrap.
 */
export function ViewToolbar({
  left,
  center,
  right,
  className,
}: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 flex-wrap items-center gap-2 border-b border-line py-2",
        "md:grid md:h-12 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3 md:py-0",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="flex items-center justify-center">{center}</div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 md:ml-0">
        {right}
      </div>
    </div>
  );
}

export type SegmentedItem = {
  href: string;
  label: string;
  /** An element, e.g. `<List />`; sized to 16 px. */
  icon?: React.ReactNode;
  active: boolean;
};

/**
 * A segmented List/Board switch made of links, so the view lives in the URL
 * (shareable, survives a refresh, no client state). `iconOnly` keeps the
 * label for screen readers and as a hover title.
 */
export function SegmentedToggle({
  items,
  label,
  iconOnly = false,
  className,
}: {
  items: SegmentedItem[];
  /** Accessible name of the group, e.g. "Modo de visualização". */
  label: string;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          title={iconOnly ? item.label : undefined}
          className={cn(
            "inline-flex h-[26px] items-center gap-1.5 rounded-[3px] text-label font-medium whitespace-nowrap transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
            iconOnly ? "w-8 justify-center" : "px-2.5",
            item.active
              ? "bg-brand-soft text-brand-deep"
              : "text-muted hover:bg-raised hover:text-ink",
          )}
        >
          {item.icon}
          <span className={iconOnly ? "sr-only" : undefined}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
