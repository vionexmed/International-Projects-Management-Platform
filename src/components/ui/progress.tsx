import { cn } from "@/lib/utils";
import { toPercent } from "@/lib/utils";

/**
 * Progress reads as a number first and a bar second — the bar is a thin
 * reinforcement, matching the density of the rest of the tables.
 */
export function ProgressBar({
  value,
  className,
  barClassName,
  showValue = false,
  label,
}: {
  value: number;
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
          {label ? <span className="text-[13px] text-ink-soft">{label}</span> : null}
          <span className="text-[13px] font-semibold text-ink tabular-nums">{pct}%</span>
        </div>
      ) : null}
      <div
        className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line-soft", barClassName)}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progresso"}
      >
        <div
          className="h-full rounded-full bg-brand-strong transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
