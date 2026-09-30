import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Every list surface renders this instead of an empty container, so a screen
 * always explains itself rather than looking broken. The icon sits bare —
 * boxed, it read as one more card on a page that already had too many.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 text-center sm:px-6",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      {Icon ? (
        <Icon className="mb-2.5 size-5 text-faint" aria-hidden />
      ) : null}
      <p className="text-body font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-meta text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
