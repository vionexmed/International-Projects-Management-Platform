import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type SectionAction = { label: string; href: string };

function isLinkAction(action: unknown): action is SectionAction {
  return (
    typeof action === "object" &&
    action !== null &&
    !React.isValidElement(action) &&
    "href" in action &&
    "label" in action
  );
}

/**
 * The default block of a page: a title on the canvas and the content under
 * it, no box. Short lists, timelines, property lists and summaries live here;
 * a `Panel` is kept for tables, forms and the one focal card, which is what
 * lets the focal card stand out at all.
 *
 * `action` is either `{ label, href }` — rendered as the standard quiet link
 * ("Ver todas") — or any node, for the rare section that needs a button.
 */
export function Section({
  title,
  count,
  description,
  action,
  children,
  className,
  id,
}: {
  title: React.ReactNode;
  /** Folded into the title in quiet text: "Solicitações · 2 abertas" reads as one line. */
  count?: React.ReactNode;
  description?: React.ReactNode;
  action?: SectionAction | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;

  return (
    <section id={id} aria-labelledby={headingId} className={className}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={headingId} className="text-section text-ink">
            {title}
            {count !== undefined && count !== null ? (
              <span className="ml-2 font-normal text-faint tabular-nums">{count}</span>
            ) : null}
          </h2>
          {description ? <p className="mt-0.5 text-meta text-muted">{description}</p> : null}
        </div>
        {isLinkAction(action) ? (
          <Button asChild variant="link" size="sm" className="h-auto shrink-0 px-0">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : action ? (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
