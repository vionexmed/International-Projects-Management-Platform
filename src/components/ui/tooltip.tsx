"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * A label on hover/focus, for icon-only controls (the rail, icon buttons).
 *
 * It carries its own Provider so no page can crash for lack of one.
 * `TooltipProvider` is re-exported for callers that use the raw primitives.
 */
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 250,
  className,
}: {
  content: React.ReactNode;
  /** A single focusable element; it becomes the trigger. */
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  className?: string;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={8}
            className={cn(
              "z-50 rounded-sm bg-ink px-2 py-1 text-[12px] leading-4 font-medium text-white shadow-overlay",
              "data-[state=delayed-open]:animate-fade-in",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
