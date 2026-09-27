import * as React from "react";
import Link from "next/link";
import { StatusDot } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

export type SummaryItem = {
  label: string;
  value: React.ReactNode;
  /** A dot before the item. Give it only to the exceptions (warn/risk). */
  tone?: Tone;
  href?: string;
};

/**
 * A portfolio in one sentence: "6 projetos · ● 2 em risco · ● 1 bloqueado".
 *
 * It replaces the KPI strip, which gave "Total 6" the same weight as
 * "Bloqueados 1". As a line of text the exceptions carry the only colour,
 * and each item still leads to the list it counts.
 */
export function SummaryLine({ items, className }: { items: SummaryItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-soft", className)}>
      {items.map((item, index) => {
        const content = (
          <>
            {item.tone ? <StatusDot tone={item.tone} /> : null}
            <span className="font-semibold text-ink tabular-nums">{item.value}</span>
            <span>{item.label}</span>
          </>
        );

        return (
          <React.Fragment key={item.label}>
            {index > 0 ? (
              <span className="text-faint" aria-hidden>
                ·
              </span>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {content}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5">{content}</span>
            )}
          </React.Fragment>
        );
      })}
    </p>
  );
}

const DELTA_TONE: Record<Tone, string> = {
  ok: "text-ink-soft",
  warn: "text-warn",
  risk: "text-risk",
  info: "text-info",
  neutral: "text-muted",
};

/**
 * One headline number, for the reports page only — the one screen whose job
 * is comparing figures. Everywhere else a count belongs in a `SummaryLine`
 * or a section title, not a card.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** A short comparison under the number, e.g. "+2 este mês". */
  delta?: React.ReactNode;
  deltaTone?: Tone;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="text-meta text-muted">{label}</div>
      <div className="mt-1 text-kpi text-ink tabular-nums">{value}</div>
      {delta ? <div className={cn("mt-1 text-meta", DELTA_TONE[deltaTone])}>{delta}</div> : null}
    </>
  );

  return (
    <Panel className={cn("px-5 py-4", href && "transition-colors hover:border-line-strong", className)}>
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </Panel>
  );
}
