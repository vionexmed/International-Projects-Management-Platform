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

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
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

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-3.5 align-middle text-ink", className)} {...props} />;
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
