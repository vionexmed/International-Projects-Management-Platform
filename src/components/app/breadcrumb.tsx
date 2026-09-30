"use client";

import { ChevronRight } from "lucide-react";
import { BackLink, RememberedLink } from "@/components/app/nav-memory";
import { TRAIL_LABELS_PT, type TrailLabels } from "@/components/app/trail-labels";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; href?: string };
export type { TrailLabels };

/**
 * The level trail at the top-left of every page below the top level:
 * "← Projetos › Plano". The arrow goes one level up (the last linked item);
 * every link restores that page as it was left — tab, filters, search, page —
 * through `NavMemory`. The last item is the current page unless it has an href.
 */
export function Breadcrumb({
  items,
  labels = TRAIL_LABELS_PT,
  back = true,
  history = true,
  className,
}: {
  items: BreadcrumbItem[];
  labels?: TrailLabels;
  /** Hide the arrow where a page already offers its own way back. */
  back?: boolean;
  /**
   * The arrow steps back through history when it stays in the app — see
   * `BackLink` — so it returns to where you were, not merely one level up.
   * The trail's own links still go up a level.
   */
  history?: boolean;
  className?: string;
}) {
  const parent = [...items].reverse().find((item) => item.href);

  return (
    <nav aria-label={labels.trail} className={cn("mb-2 flex items-center gap-1", className)}>
      {back && parent?.href ? (
        <BackLink
          href={parent.href}
          label={`${labels.back}: ${parent.label}`}
          history={history}
          className="-ml-1.5"
        />
      ) : null}
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-meta text-muted">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
            {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden /> : null}
            {item.href ? (
              <RememberedLink href={item.href} className="truncate transition-colors hover:text-ink">
                {item.label}
              </RememberedLink>
            ) : (
              <span aria-current="page" className="truncate text-ink-soft">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
