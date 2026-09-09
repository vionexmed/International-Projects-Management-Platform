import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = {
  href: string;
  label: string;
  count?: number;
  active: boolean;
};

/**
 * Link-based tabs. Because filtering happens on the server, each tab is a real
 * URL — shareable, bookmarkable, and correct on a hard refresh.
 */
export function TabsNav({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <div className={cn("border-b border-line", className)}>
      <nav className="scroll-slim -mb-px flex items-center gap-1 overflow-x-auto" aria-label="Abas">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              item.active
                ? "border-brand text-ink"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink-soft",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                  item.active ? "bg-brand-soft text-brand-deep" : "bg-raised text-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
