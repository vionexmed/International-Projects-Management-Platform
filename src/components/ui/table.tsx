import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Composable table primitives. Filtering, sorting and pagination happen on
 * the server (search params), so the client ships no table runtime.
 */

/** Same radius and shadow as `Panel`, so a table and a panel side by side match. */
export function TableShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-surface shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

export function TableScroll({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("scroll-slim w-full overflow-x-auto", className)} {...props} />;
}

/**
 * On a phone a seven-column table is 1200px wide and every cell gets chopped
 * mid-word, so below `md` the rows collapse into stacked cards: the header is
 * dropped and each cell prints its own label from `data-label`. The switch is
 * pure CSS (`.table-stacked` in globals.css) — the markup stays a real table,
 * so it is still one accessible grid on a desktop and needs no second render.
 *
 * `stacked={false}` keeps the classic table for the rare grid that is narrow
 * enough to read as-is.
 */
export function Table({
  className,
  stacked = true,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { stacked?: boolean }) {
  return (
    <table
      className={cn("w-full border-collapse text-body", stacked && "table-stacked", className)}
      {...props}
    />
  );
}

/** No tinted header band — the overline labels are enough to mark the row. */
export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-transparent", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TR({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-line-soft last:border-b-0",
        // `relative` lets a single cell link stretch across the whole row.
        interactive && "relative transition-colors hover:bg-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "table-label h-9 border-b border-line bg-transparent px-4 whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Rows are 48px and single-line: every labelled (non-primary) cell is
 * `nowrap`, so a name or a stage never breaks onto a second line. The primary
 * cell — the one without a `label` — is the only one allowed to wrap.
 *
 * `label` is the column name this cell belongs to. It is invisible on a
 * desktop — the header row already says it — and becomes the cell's own label
 * once the table stacks on a phone. Leave it off the primary cell, which
 * carries the row's title and reads fine on its own.
 */
export function TD({
  className,
  label,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  return (
    <td
      data-label={label}
      className={cn(
        "h-12 px-4 py-2 align-middle text-body text-ink-soft",
        label !== undefined && "whitespace-nowrap",
        // Once stacked into a card the row has room to wrap and owns the
        // padding. Utilities, not the `.table-stacked` rules in globals.css,
        // because those sit in the components layer and lose to utilities.
        "max-md:in-[.table-stacked]:h-auto max-md:in-[.table-stacked]:p-0 max-md:in-[.table-stacked]:whitespace-normal",
        className,
      )}
      {...props}
    />
  );
}

/** Footer strip used for result counts and pagination. */
export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-meta text-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Primary cell: a strong title with a muted supporting line underneath. */
export function CellStack({
  title,
  subtitle,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-title font-medium text-ink">{title}</div>
      {subtitle ? <div className="mt-0.5 truncate text-meta text-muted">{subtitle}</div> : null}
    </div>
  );
}
