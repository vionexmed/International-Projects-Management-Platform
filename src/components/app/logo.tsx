import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Vionex mark alone: a circle held by an open embrace.
 *
 * Drawn rather than loaded so it inherits `currentColor` — it appears at 17px
 * in a collapsed sidebar, where a raster asset would be muddy, and it has to
 * work in turquoise on light chrome and in white on the navy rail.
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
 * The full brand lockup — the official artwork, not a reproduction — with the
 * product name set beneath it.
 *
 * `tone="light"` swaps in the white artwork for the navy sidebar; the
 * turquoise original would sit too close to that background.
 */
export function VionexLogo({
  className,
  tone = "brand",
  subtitle = "INTERNATIONAL PROJECTS",
  width = 132,
}: {
  className?: string;
  tone?: "brand" | "light";
  /** Set to null to show the logo on its own. */
  subtitle?: string | null;
  width?: number;
}) {
  const light = tone === "light";

  return (
    <span className={cn("inline-flex flex-col items-start gap-1.5", className)}>
      <Image
        src={light ? "/brand/vionex-white.png" : "/brand/vionex.png"}
        alt="Vionex"
        width={width}
        height={Math.round((width * 198) / 720)}
        priority
        className="h-auto"
      />
      {subtitle ? (
        <span
          className={cn(
            "text-[10px] leading-none font-medium tracking-[0.16em]",
            light ? "text-navy-ink" : "text-muted",
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </span>
  );
}
