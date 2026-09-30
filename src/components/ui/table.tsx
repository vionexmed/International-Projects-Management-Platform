import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Composable table primitives. Filtering, sorting and pagination happen on
 * the server (search params), so the client ships no table runtime.
 */

/**
 * A quiet surface with a hairline border. `flush` drops the radius and side
 * borders; `workspace` leaves overflow visible so toolbar menus can expand.
 */
export function TableShell({
  className,
  variant = "card",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "card" | "flush" | "workspace" }) {
  return (
    <div
      className={cn(
        variant === "workspace" ? "bg-surface" : "overflow-hidden bg-surface",
        variant === "flush" ? "border-y border-line-soft" : "rounded-md border border-line-soft",
        className,
      )}
      {...props}
    />
  );
}

export function TableScroll({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("scroll-slim w-full overflow-x-auto", className)} {...props} />;
}

export type TableDensity = "compact" | "comfortable";

/**
 * On a phone a seven-column table is 1200px wide and every cell gets chopped
 * mid-word, so below `md` the rows collapse into stacked cards: the header is
 * dropped and each cell prints its own label from `data-label`. The switch is
 * pure CSS (`.table-stacked` in globals.css) — the markup stays a real table,
 * so it is still one accessible grid on a desktop and needs no second render.
 *
 * `stacked={false}` keeps the classic table for the rare grid that is narrow
 * enough to read as-is.
 *
 * `density="compact"` (default) is the dense grid: 40-px rows on a faint
 * rule, a 38-px tinted header in 13/600. `comfortable` restores the older
 * 48-px rows and overline headers. `columnRules` adds 1-px vertical rules.
 * Both are marker classes the cells read through Tailwind `in-*` variants,
 * because the cells render on the server and cannot read React context.
 */
export function Table({
  className,
  stacked = true,
  density = "compact",
  columnRules = false,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  stacked?: boolean;
  density?: TableDensity;
  columnRules?: boolean;
}) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-body",
        stacked && "table-stacked",
        density === "comfortable" && "table-comfortable",
        columnRules && "table-rules",
        className,
      )}
      {...props}
    />
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
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
        "border-b border-line-faint last:border-b-0 in-[.table-comfortable]:border-line-soft",
        // `relative` lets a single cell link stretch across the whole row.
        interactive && "relative transition-colors hover:bg-subtle",
        className,
      )}
      {...props}
    />
  );
}

/* Shared by TH and TD: optional vertical rules between columns. */
const COLUMN_RULE =
  "in-[.table-rules]:border-r in-[.table-rules]:border-line-soft in-[.table-rules]:last:border-r-0";

export function TH({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "h-[38px] border-b border-line-soft bg-subtle px-3 text-label font-semibold whitespace-nowrap text-ink-soft first:pl-4 last:pr-4",
        // The older overline header, kept for `density="comfortable"`.
        "in-[.table-comfortable]:h-9 in-[.table-comfortable]:bg-transparent in-[.table-comfortable]:px-4 in-[.table-comfortable]:text-[11px] in-[.table-comfortable]:font-medium in-[.table-comfortable]:tracking-[0.06em] in-[.table-comfortable]:text-muted in-[.table-comfortable]:uppercase",
        COLUMN_RULE,
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Rows are 40px (48px when comfortable) and single-line: every labelled
 * (non-primary) cell is `nowrap`, so a name or a stage never breaks onto a
 * second line. The primary cell — the one without a `label` — is the only one
 * allowed to wrap; a two-line primary cell simply makes its row taller.
 *
 * `label` is the column name this cell belongs to. It is invisible on a
 * desktop — the header row already says it — and becomes the cell's own label
 * once the table stacks on a phone. Leave it off the primary cell, which
 * carries the row's title and reads fine on its own.
 *
 * `align="right"` is for dates and numbers, matching a right-aligned `TH`.
 * Once stacked the value goes back to the left, next to its label.
 */
export function TD({
  className,
  label,
  align = "left",
  ...props
}: Omit<React.TdHTMLAttributes<HTMLTableCellElement>, "align"> & {
  label?: string;
  align?: "left" | "right";
}) {
  return (
    <td
      data-label={label}
      className={cn(
        "h-10 px-3 py-1.5 align-middle text-body text-ink-soft first:pl-4 last:pr-4",
        "in-[.table-comfortable]:h-12 in-[.table-comfortable]:px-4 in-[.table-comfortable]:py-2",
        COLUMN_RULE,
        label !== undefined && "whitespace-nowrap",
        align === "right" && "text-right tabular-nums max-md:in-[.table-stacked]:text-left",
        // Once stacked into a card the row has room to wrap and owns the
        // padding. Utilities, not the `.table-stacked` rules in globals.css,
        // because those sit in the components layer and lose to utilities.
        // `p-0!` also has to beat the `first:pl-4`/`last:pr-4` edge padding.
        "max-md:in-[.table-stacked]:h-auto max-md:in-[.table-stacked]:border-r-0 max-md:in-[.table-stacked]:p-0! max-md:in-[.table-stacked]:whitespace-normal",
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
