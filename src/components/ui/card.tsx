import * as React from "react";
import { cn } from "@/lib/utils";

const PANEL_VARIANT = {
  default: "border-line bg-surface shadow-panel",
  /** The one block a page is about — the supplier's action card. */
  focal: "border-brand-line bg-brand-soft/60 shadow-panel",
  /** A blocker or overdue note. Tinted, unshadowed, tighter padding built in. */
  callout: "px-4 py-3",
} as const;

const CALLOUT_TONE = {
  risk: "border-risk/25 bg-risk-soft",
  warn: "border-warn/25 bg-warn-soft",
} as const;

export type PanelVariant = keyof typeof PANEL_VARIANT;

/**
 * A bordered surface on the darker canvas. The faint shadow is what lets two
 * panels 24px apart read as two things instead of one sheet.
 *
 * Panels are for tables, forms and a page's focal card — short lists and
 * summaries sit on the canvas under a `Section` instead, so a page is not a
 * column of identical rectangles. `tone` only applies to `callout`.
 */
export function Panel({
  className,
  variant = "default",
  tone = "risk",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: PanelVariant;
  tone?: keyof typeof CALLOUT_TONE;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        PANEL_VARIANT[variant],
        variant === "callout" && CALLOUT_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Title bar for a panel that carries a table plus its own actions. Anything
 * simpler takes a `Section` title above the panel instead of a bar inside it.
 */
export function PanelHeader({
  title,
  count,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  /** Shown after the title in quiet text, e.g. "Documentos 12". */
  count?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-title text-ink">
          {title}
          {count !== undefined && count !== null ? (
            <span className="ml-2 font-normal text-faint tabular-nums">{count}</span>
          ) : null}
        </h2>
        {description ? <p className="mt-0.5 text-meta text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * Label/value pair used across the detail screens. Prefer `PropertyList` for
 * new work; this stays for the grids that have not moved yet. The label is
 * sentence case now — an uppercase overline on every field made a detail
 * screen read as one noisy grid.
 */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="mt-1 text-body text-ink">{children ?? "—"}</dd>
    </div>
  );
}

export type PropertyItem = {
  label: string;
  /** `null`, `undefined`, `false` or `""` drop the item — blank beats "—". */
  value: React.ReactNode;
  /** Stable key when two items share a label. */
  key?: string;
};

/**
 * Record properties without a box around them. `inline` is the one row under
 * a record title (owner, start, launch…); `stacked` is the context rail next
 * to a workflow form; `grid` is for a record with seven or eight fields (a
 * study, a shipment), where an inline row wraps into a ragged second line and
 * the labels stop lining up. Empty values are left out rather than printed
 * as "—".
 */
export function PropertyList({
  items,
  layout = "inline",
  className,
}: {
  items: PropertyItem[];
  layout?: "inline" | "stacked" | "grid";
  className?: string;
}) {
  const visible = items.filter(
    (item) => item.value !== null && item.value !== undefined && item.value !== false && item.value !== "",
  );
  if (visible.length === 0) return null;

  return (
    <dl
      className={cn(
        layout === "inline"
          ? "flex flex-wrap gap-x-8 gap-y-2"
          : layout === "grid"
            ? "grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4"
            : "space-y-3",
        className,
      )}
    >
      {visible.map((item) => (
        <div key={item.key ?? item.label} className="min-w-0">
          <dt className="text-meta text-muted">{item.label}</dt>
          <dd className="mt-0.5 text-body font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
