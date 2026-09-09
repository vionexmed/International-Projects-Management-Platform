import { cn } from "@/lib/utils";

/**
 * The Vionex mark: a circle held by an open embrace. Drawn with `currentColor`
 * so it inherits the surrounding text colour — turquoise on light chrome,
 * white on the navy sidebar. The mask keeps the gap between the circle and
 * the embrace transparent rather than painting it white, so the mark sits
 * cleanly on any background.
 */
export function VionexMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1080 1080"
      className={cn("size-7", className)}
      role="img"
      aria-label="Vionex"
      fill="none"
    >
      <mask id="vionex-mark-cut">
        <rect width="1080" height="1080" fill="white" />
        <circle cx="540" cy="378" r="203" fill="black" />
      </mask>
      <path
        d="M248 512 L540 798 L832 512"
        stroke="currentColor"
        strokeWidth="152"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask="url(#vionex-mark-cut)"
      />
      <circle cx="540" cy="378" r="163" fill="currentColor" />
    </svg>
  );
}

/**
 * Mark plus wordmark. `tone` switches between the light chrome of the
 * Supplier Portal and the navy chrome of the internal environment.
 */
export function VionexLogo({
  className,
  markClassName,
  tone = "brand",
  wordmark = true,
}: {
  className?: string;
  markClassName?: string;
  tone?: "brand" | "light";
  wordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <VionexMark
        className={cn("size-7", tone === "light" ? "text-white" : "text-brand", markClassName)}
      />
      {wordmark ? (
        <span
          className={cn(
            "text-[19px] leading-none font-semibold tracking-[-0.02em]",
            tone === "light" ? "text-white" : "text-brand-deep",
          )}
        >
          vionex
        </span>
      ) : null}
    </span>
  );
}
