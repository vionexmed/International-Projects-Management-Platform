import * as React from "react";
import { cn } from "@/lib/utils";
import type { DerivedTaskStatus, Tone } from "@/lib/status";

const DOT_TONE: Record<Tone, string> = {
  ok: "bg-ok-dot",
  warn: "bg-warn-dot",
  risk: "bg-risk-dot",
  info: "bg-info-dot",
  neutral: "bg-faint",
};

/**
 * Status colour is for exceptions. "Em dia" used to be as loud a green as
 * "Bloqueado" was red; the ok dot stays green but its text is plain ink, so
 * only the problems on a screen are coloured.
 */
const TEXT_TONE: Record<Tone, string> = {
  ok: "text-ink-soft",
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

/** The bare dot, for places that carry a tone without a badge (summary lines, rows). */
export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      className={cn("inline-block size-[7px] shrink-0 rounded-full", DOT_TONE[tone], className)}
      aria-hidden
    />
  );
}

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
    <span className={cn("inline-flex items-center gap-2 text-body whitespace-nowrap", className)}>
      <StatusDot tone={tone} />
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

/* ---------------------------------------------------------------------------
   StatusIcon — status as a 16-px glyph for dense rows, cards and the board,
   where a text pill would crowd the line. Shape carries the state (so it
   survives colour blindness); colour comes from the status tokens.
--------------------------------------------------------------------------- */

export type StatusIconKind =
  | "open"
  | "in-progress"
  | "waiting"
  | "done"
  | "cancelled"
  | "blocked"
  | "milestone"
  | "milestone-done";

const ICON_TONE: Record<Tone, string> = {
  ok: "text-ok-dot",
  warn: "text-warn-dot",
  risk: "text-risk-dot",
  info: "text-info-dot",
  neutral: "text-faint",
};

/* Default colour per kind; "open" takes the brand, like a fresh task circle. */
const KIND_COLOR: Record<StatusIconKind, string> = {
  open: "text-brand",
  "in-progress": "text-info-dot",
  waiting: "text-warn-dot",
  done: "text-ok-dot",
  cancelled: "text-faint",
  blocked: "text-risk-dot",
  milestone: "text-brand-strong",
  "milestone-done": "text-ok-dot",
};

/** Maps a (derived) progress status onto a glyph. Overdue stays an open circle, tinted risk. */
export function statusIconKind(status: DerivedTaskStatus): StatusIconKind {
  switch (status) {
    case "IN_PROGRESS":
      return "in-progress";
    case "WAITING":
    case "DELAYED":
    case "SUSPENDED":
      return "waiting";
    case "BLOCKED":
      return "blocked";
    case "COMPLETED":
      return "done";
    case "CANCELLED":
      return "cancelled";
    default:
      return "open";
  }
}

function Glyph({ kind }: { kind: StatusIconKind }) {
  const ring = <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />;
  const onFill = "var(--color-surface)";
  switch (kind) {
    case "in-progress":
      return (
        <>
          {ring}
          <path d="M8 3.75a4.25 4.25 0 0 1 0 8.5z" fill="currentColor" />
        </>
      );
    case "waiting":
      return (
        <>
          {ring}
          <path d="M8 5v3.25l2.1 1.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "done":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.1 8.2 2 2 3.8-4.1" stroke={onFill} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "cancelled":
      return (
        <>
          {ring}
          <path d="m6 6 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case "blocked":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.9 5.9 4.2 4.2m0-4.2-4.2 4.2" stroke={onFill} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case "milestone":
    case "milestone-done":
      return (
        <path
          d="M8 1.9 14.1 8 8 14.1 1.9 8z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={kind === "milestone-done" ? "currentColor" : "none"}
        />
      );
    default:
      return ring;
  }
}

/**
 * `kind` picks the shape (or pass `status` and let `statusIconKind` decide);
 * `tone` overrides the kind's default colour. With `label` the icon is an
 * image with that accessible name (and a hover title); without it, it is
 * decorative — use that only when the status text sits right beside it.
 */
export function StatusIcon({
  kind,
  status,
  tone,
  label,
  size = 16,
  className,
}: {
  kind?: StatusIconKind;
  status?: DerivedTaskStatus;
  tone?: Tone;
  label?: string;
  size?: 12 | 14 | 16 | 20;
  className?: string;
}) {
  const resolved = kind ?? (status ? statusIconKind(status) : "open");
  const color = tone ?? (status === "OVERDUE" ? "risk" : undefined);
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", color ? ICON_TONE[color] : KIND_COLOR[resolved], className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {label ? <title>{label}</title> : null}
      <Glyph kind={resolved} />
    </svg>
  );
}
