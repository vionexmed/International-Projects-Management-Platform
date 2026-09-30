"use client";

import Link from "next/link";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type StageSegment = {
  key: string;
  name: string;
  status: string;
  progress: number;
  /** How much of the segment is filled, 0–100. */
  fill: number;
  /** Tailwind background class for the fill. */
  tone: string;
  href: string;
  current: boolean;
};

/**
 * The segments of a stage track, built here on the client. The tooltip's
 * trigger wraps a Link; composed in a server component, that Link could reach
 * Radix as a not-yet-loaded (lazy) element and the trigger failed to attach,
 * switching the whole page to client rendering.
 */
export function StageTrackSegments({ segments }: { segments: StageSegment[] }) {
  return (
    <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1">
      {segments.map((segment) => (
        <Tooltip
          key={segment.key}
          content={
            <span className="block text-left">
              <span className="block font-semibold">
                {segment.name}
                {segment.current ? " · etapa atual" : ""}
              </span>
              <span className="block font-normal opacity-80">
                {segment.status} · {segment.progress}%
              </span>
            </span>
          }
        >
          <Link
            href={segment.href}
            aria-label={`${segment.name}: ${segment.status}, ${segment.progress}%${segment.current ? " (etapa atual)" : ""}`}
            className="group/segment flex h-5 min-w-0 flex-1 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line-soft transition-[height] group-hover/segment:h-2">
              <span className={cn("block h-full rounded-full", segment.tone)} style={{ width: `${segment.fill}%` }} />
            </span>
          </Link>
        </Tooltip>
      ))}
    </span>
  );
}
