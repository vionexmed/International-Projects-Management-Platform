import * as React from "react";
import { Breadcrumb, type BreadcrumbItem } from "@/components/app/breadcrumb";
import type { TrailLabels } from "@/components/app/trail-labels";
import { PropertyList, type PropertyItem } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type { BreadcrumbItem };

/**
 * Every screen opens the same way: title, one line of context, actions on the
 * right. Consistency here is what makes the product feel like one system.
 *
 * Records use the optional slots: `breadcrumb` above the title, `status` (one
 * SolidBadge) beside it, `meta` for a due date or similar right under it, and
 * `properties` as a single unboxed row — the record header that used to be a
 * back link, a title, a meta line and a boxed Field strip. A breadcrumb
 * brings its own back arrow (one level up, state restored); pass
 * `trailLabels` from the dictionary on localised (supplier) pages.
 */
export function PageHeader({
  title,
  description,
  status,
  meta,
  properties,
  breadcrumb,
  trailLabels,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  meta?: React.ReactNode;
  properties?: PropertyItem[];
  breadcrumb?: BreadcrumbItem[];
  trailLabels?: TrailLabels;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-8", className)}>
      {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} labels={trailLabels} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-page text-ink">{title}</h1>
            {status ? <div className="shrink-0">{status}</div> : null}
          </div>
          {description ? <p className="mt-1 text-body text-muted">{description}</p> : null}
          {meta ? <div className="mt-1 text-meta text-muted">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {properties ? <PropertyList items={properties} layout="inline" className="mt-4" /> : null}
      {children}
    </div>
  );
}

/**
 * Section heading used inside a page, one level below the page title. Kept
 * for pages not yet on `Section` (components/ui/section.tsx), which also owns
 * the block's spacing and a count.
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-section text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-meta text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
