import type { ShipmentStage } from "@/generated/prisma";
import { Check } from "lucide-react";
import { SHIPMENT_STAGE_ORDER } from "@/lib/status";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Linear shipment tracker. Stages before the current one read as done (in
 * neutral ink — progress is not an exception), the current one carries the
 * brand ring as the one "you are here" mark, and the rest stay quiet.
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
                  "flex size-6 items-center justify-center rounded-full border text-meta font-semibold",
                  done && "border-ink-soft/60 bg-ink-soft/60 text-white",
                  active && "border-brand-strong bg-surface text-ink ring-2 ring-brand-soft",
                  !done && !active && "border-line bg-surface text-faint",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-center text-meta",
                  active ? "font-medium text-ink" : done ? "text-ink-soft" : "text-muted",
                )}
              >
                {label.shipmentStage(stage, dict)}
              </span>
            </div>

            {index < SHIPMENT_STAGE_ORDER.length - 1 ? (
              <span
                className={cn("mt-3 h-px min-w-4 flex-1", done ? "bg-ink-soft/60" : "bg-line")}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
