import type { ShipmentStage } from "@/generated/prisma";
import { Check } from "lucide-react";
import { SHIPMENT_STAGE_ORDER } from "@/lib/status";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Linear shipment tracker. Stages before the current one read as done, the
 * current one is marked, and the rest stay quiet.
 */
export function ShipmentProgress({ current, dict }: { current: ShipmentStage; dict: Dictionary }) {
  const currentIndex = SHIPMENT_STAGE_ORDER.indexOf(current);

  return (
    <ol className="scroll-slim flex items-start gap-0 overflow-x-auto px-5 py-5">
      {SHIPMENT_STAGE_ORDER.map((stage, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li key={stage} className="flex min-w-0 flex-1 items-start gap-0">
            <div className="flex min-w-24 flex-col items-center gap-2 px-1">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-brand bg-brand text-white",
                  active && "border-brand bg-brand-soft text-brand-deep",
                  !done && !active && "border-line bg-surface text-faint",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-center text-[12px] leading-tight",
                  active ? "font-medium text-ink" : done ? "text-ink-soft" : "text-muted",
                )}
              >
                {label.shipmentStage(stage, dict)}
              </span>
            </div>

            {index < SHIPMENT_STAGE_ORDER.length - 1 ? (
              <span
                className={cn("mt-3 h-px min-w-4 flex-1", done ? "bg-brand" : "bg-line")}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
