import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Composable table primitives. Filtering, sorting and pagination happen on
 * the server (search params), so the client ships no table runtime.
 */

export function TableShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-line bg-surface", className)}
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
      className={cn("w-full border-collapse text-sm", stacked && "table-stacked", className)}
      {...props}
    />
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-subtle", className)} {...props} />;
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
        "table-label border-b border-line px-5 py-3 font-semibold whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

/**
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
      className={cn("px-5 py-3.5 align-middle text-ink", className)}
      {...props}
    />
  );
}

/** Footer strip used for result counts and pagination. */
export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted",
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
      <div className="truncate font-semibold text-ink">{title}</div>
      {subtitle ? <div className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</div> : null}
    </div>
  );
}
