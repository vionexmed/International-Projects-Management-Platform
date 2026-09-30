import * as React from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/card";
import { StatusIcon, type StatusIconKind } from "@/components/ui/badge";
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

/** The glyph each exception kind reads as — shape carries the state, `severity` its tone. */
const KIND_ICON: Record<AttentionItem["kind"], StatusIconKind> = {
  TASK_OVERDUE: "open",
  REQUEST_OVERDUE: "waiting",
  REVIEW_WAITING: "waiting",
  MILESTONE_DELAYED: "milestone",
  PROJECT_BLOCKED: "blocked",
  SHIPMENT_LATE: "waiting",
};

/**
 * The exceptions, rendered as a short list — never as a table.
 *
 * A table invites reading every row and comparing columns, which is the
 * behaviour `/projects` and `/tasks` are for. This is a triage strip: read the
 * top few, click the one that is yours, leave. The shape is the argument.
 *
 * The per-kind "view all" counts belong to the caller's section header: the
 * items are of mixed kinds, so one link would pick a destination wrong for
 * most of them, and a footer of counts under the rows repeated the rows.
 */
export function AttentionList({
  items,
  locale,
  emptyTitle,
  emptyDescription,
  bare = false,
}: {
  items: AttentionItem[];
  locale: Locale;
  emptyTitle: string;
  emptyDescription?: string;
  /** Without its own panel, for a caller that already draws the card. */
  bare?: boolean;
}) {
  const Frame = bare ? React.Fragment : Panel;
  if (items.length === 0) {
    return (
      <Frame>
        <EmptyState
          icon={CircleCheck}
          title={emptyTitle}
          description={emptyDescription}
          compact
        />
      </Frame>
    );
  }

  // The service already ranks this way; sorting again here keeps the promise
  // ("the worst thing sits on top") for any caller that merges or slices.
  // `sort` is stable, so the service's deadline order survives within a tier.
  const ranked = [...items].sort(
    (a, b) => Number(a.severity !== "risk") - Number(b.severity !== "risk"),
  );

  return (
    <Frame>
      <ul className={cn("divide-y divide-line-soft", bare && "border-t border-line-faint")}>
        {ranked.map((item) => {
          const remaining = daysUntil(item.dueDate);
          const late = remaining !== null && remaining < 0;

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-x-4 px-5 py-2.5 transition-colors hover:bg-subtle"
              >
                <StatusIcon
                  kind={KIND_ICON[item.kind]}
                  tone={item.severity === "risk" ? "risk" : "warn"}
                  size={16}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">
                    {item.description}
                  </span>
                  <span className="mt-0.5 block truncate text-meta text-muted">
                    {KIND_LABEL[item.kind]} · {item.project.name}
                    {item.responsible ? ` · ${item.responsible}` : ""}
                  </span>
                </span>

                {item.dueDate ? (
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-right text-meta whitespace-nowrap tabular-nums",
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
    </Frame>
  );
}
