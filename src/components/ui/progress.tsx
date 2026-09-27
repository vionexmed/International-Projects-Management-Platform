import { cn } from "@/lib/utils";
import { toPercent } from "@/lib/utils";

export type ProgressTone = "neutral" | "ok" | "warn" | "risk";

const FILL_TONE: Record<ProgressTone, string> = {
  neutral: "bg-ink-soft/60",
  ok: "bg-ok-dot",
  warn: "bg-warn-dot",
  risk: "bg-risk-dot",
};

/**
 * Progress reads as a number first and a bar second — the bar is a thin
 * reinforcement, matching the density of the rest of the tables.
 *
 * The fill is neutral by default: turquoise on every bar made brand colour
 * mean nothing. A tone is for the exceptions only — `warn`/`risk` when a
 * stage is late, `ok` when it is done.
 */
export function ProgressBar({
  value,
  tone = "neutral",
  className,
  barClassName,
  showValue = false,
  label,
}: {
  value: number;
  tone?: ProgressTone;
  className?: string;
  barClassName?: string;
  showValue?: boolean;
  label?: string;
}) {
  const pct = toPercent(value);
  return (
    <div className={cn("w-full", className)}>
      {showValue ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? <span className="text-meta text-ink-soft">{label}</span> : null}
          <span className="text-meta font-semibold text-ink tabular-nums">{pct}%</span>
        </div>
      ) : null}
      <div
        className={cn("h-1 w-full overflow-hidden rounded-full bg-line-soft", barClassName)}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progresso"}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", FILL_TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
