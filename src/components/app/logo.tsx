import * as React from "react";
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
 * The mark in its own colours, for the collapsed rail: the turquoise circle
 * and left arm, and the right arm folding from the deep teal of the fold up
 * to the turquoise — drawn right arm first, so the left one crosses over it
 * at the bottom, as in the logo artwork.
 */
export function VionexMarkColor({ className }: { className?: string }) {
  const id = React.useId();
  return (
    <svg viewBox="140 190 800 700" className={cn("size-8", className)} role="img" aria-label="Vionex" fill="none">
      <defs>
        <mask id={`${id}-cut`}>
          <rect x="0" y="0" width="1080" height="1080" fill="white" />
          <circle cx="540" cy="378" r="203" fill="black" />
        </mask>
        <linearGradient id={`${id}-fold`} x1="560" y1="760" x2="832" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#004e57" />
          <stop offset="0.55" stopColor="#007886" />
          <stop offset="1" stopColor="#00a3b5" />
        </linearGradient>
      </defs>
      <g mask={`url(#${id}-cut)`} strokeWidth="152" strokeLinecap="round">
        <path d="M540 798 L832 512" stroke={`url(#${id}-fold)`} />
        <path d="M248 512 L540 798" stroke="#00a3b5" />
      </g>
      <circle cx="540" cy="378" r="163" fill="#00a3b5" />
    </svg>
  );
}

/**
 * The full brand lockup — the official artwork, not a reproduction — with the
 * product name set beneath it.
 *
 * `tone="rail"` keeps the full-colour artwork on the deep-teal sidebar — the
 * turquoise mark reads at 5.06:1 there, the brand at its best — with the
 * subtitle in the rail's own ink. `tone="light"` is the white artwork, for
 * backgrounds the turquoise would sit too close to.
 */
export function VionexLogo({
  className,
  tone = "brand",
  subtitle = "INTERNATIONAL PROJECTS",
  width = 132,
}: {
  className?: string;
  tone?: "brand" | "light" | "rail";
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
            light || tone === "rail" ? "text-navy-ink" : "text-muted",
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </span>
  );
}
