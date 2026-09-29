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
            "!rounded-md !border !border-line !bg-surface !text-ink !shadow-overlay !font-sans !text-[13px]",
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
