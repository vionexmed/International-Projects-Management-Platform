import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/card";
import type { AttentionItem } from "@/server/services/attention";
import type { Locale } from "@/lib/i18n/config";
import { daysUntil, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<AttentionItem["kind"], string> = {
  TASK_OVERDUE: "Tarefa atrasada",
  REQUEST_OVERDUE: "Documento atrasado",
  REVIEW_WAITING: "Aguardando análise",
  MILESTONE_DELAYED: "Marco atrasado",
  PROJECT_BLOCKED: "Projeto bloqueado",
  SHIPMENT_LATE: "Embarque atrasado",
};

/**
 * The exceptions, rendered as a short list — never as a table.
 *
 * A table invites reading every row and comparing columns, which is the
 * behaviour `/projects` and `/tasks` are for. This is a triage strip: read the
 * top few, click the one that is yours, leave. The shape is the argument.
 */
export function AttentionList({
  items,
  locale,
  links,
  emptyTitle,
  emptyDescription,
}: {
  items: AttentionItem[];
  locale: Locale;
  /**
   * One "view all" per kind rather than one for the list.
   *
   * The items are of mixed kinds, and a single link would have to pick a
   * destination that is wrong for most of them. Each count instead leads to
   * the canonical page that lists exactly those rows, already filtered.
   */
  links: { label: string; href: string }[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={CircleCheck}
          title={emptyTitle}
          description={emptyDescription}
          compact
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <ul className="divide-y divide-line-soft">
        {items.map((item) => {
          const remaining = daysUntil(item.dueDate);
          const late = remaining !== null && remaining < 0;

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-subtle"
              >
                <span
                  className={cn(
                    "size-[7px] shrink-0 rounded-full",
                    item.severity === "risk" ? "bg-risk-dot" : "bg-warn-dot",
                  )}
                  aria-hidden
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {item.description}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted">
                    {KIND_LABEL[item.kind]} · {item.project.name}
                    {item.responsible ? ` · ${item.responsible}` : ""}
                  </span>
                </span>

                {item.dueDate ? (
                  <span
                    className={cn(
                      "shrink-0 text-[12px] whitespace-nowrap tabular-nums",
                      late ? "font-medium text-risk" : "text-muted",
                    )}
                  >
                    {late ? `${Math.abs(remaining)}d atrasado` : formatDate(item.dueDate, locale)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {links.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line px-5 py-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 text-[13px] text-brand-strong hover:underline"
            >
              {link.label}
              <ArrowRight className="size-3.5" />
            </Link>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
