import { cn } from "@/lib/utils";
import { formatDate, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";

export type TimelineItem = {
  id: string;
  description: string;
  createdAt: Date;
  actorName: string | null;
  context?: string | null;
};

/**
 * Project history. Rendered as a rail rather than a list of cards so a long
 * history stays scannable. Dots are neutral; only the newest entry is marked
 * in brand, so the rail says "this is where things stand" and nothing else.
 */
export function Timeline({
  items,
  locale = "pt-BR",
  emptyTitle,
  emptyDescription,
  className,
}: {
  items: TimelineItem[];
  locale?: Locale;
  emptyTitle: string;
  emptyDescription?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <EmptyState icon={History} title={emptyTitle} description={emptyDescription} compact />;
  }

  // Resolved by date rather than position: callers sort either way.
  const newestId = items.reduce((newest, item) =>
    item.createdAt.getTime() > newest.createdAt.getTime() ? item : newest,
  ).id;

  return (
    <ol className={cn("relative", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 ? (
            <span className="absolute top-[18px] bottom-0 left-[3.5px] w-px bg-line" aria-hidden />
          ) : null}

          <span
            className={cn(
              "relative mt-[6px] size-2 shrink-0 rounded-full",
              item.id === newestId ? "bg-brand" : "bg-line-strong",
            )}
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            <p className="text-body text-ink">{item.description}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-muted">
              <span>{formatDate(item.createdAt, locale)}</span>
              <span aria-hidden>·</span>
              <span>{formatRelative(item.createdAt, locale)}</span>
              {item.actorName ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{item.actorName}</span>
                </>
              ) : null}
              {item.context ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{item.context}</span>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
