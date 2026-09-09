"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-line !bg-surface !text-ink !shadow-[0_8px_24px_rgba(10,24,38,0.10)] !font-sans !text-[13px]",
          description: "!text-muted",
          actionButton: "!bg-brand-strong !text-white",
          cancelButton: "!bg-raised !text-ink-soft",
          success: "!text-ink",
          error: "!text-ink",
        },
      }}
    />
  );
}
