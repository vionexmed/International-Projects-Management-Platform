import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

const DOT_TONE: Record<Tone, string> = {
  ok: "bg-ok-dot",
  warn: "bg-warn-dot",
  risk: "bg-risk-dot",
  info: "bg-info-dot",
  neutral: "bg-faint",
};

const TEXT_TONE: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  risk: "text-risk",
  info: "text-info",
  neutral: "text-muted",
};

const SOFT_TONE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  risk: "bg-risk-soft text-risk",
  info: "bg-info-soft text-info",
  neutral: "bg-raised text-muted",
};

/**
 * The product's default status indicator: a small coloured dot plus plain
 * text. Deliberately not a filled pill — colour stays at the level of a
 * signal rather than decoration.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] whitespace-nowrap", className)}>
      <span className={cn("size-[7px] shrink-0 rounded-full", DOT_TONE[tone])} aria-hidden />
      <span className={TEXT_TONE[tone]}>{children}</span>
    </span>
  );
}

/** Used where a status needs more weight, e.g. a project header. */
export function SolidBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium whitespace-nowrap",
        SOFT_TONE[tone],
        className,
      )}
    >
      <span className={cn("size-[6px] shrink-0 rounded-full", DOT_TONE[tone])} aria-hidden />
      {children}
    </span>
  );
}

/** Neutral counter used by navigation items and tabs. */
export function CountBadge({ value, className }: { value: number; className?: string }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
        className,
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function PriorityBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("text-[13px] font-medium whitespace-nowrap", TEXT_TONE[tone])}>
      {children}
    </span>
  );
}
