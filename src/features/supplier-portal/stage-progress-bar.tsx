"use client";

import * as React from "react";
import Link from "next/link";
import type { StageKey } from "@/generated/prisma";
import { Tooltip } from "@/components/ui/tooltip";
import { interpolate } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

export type StageBarStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export type StageBarItem = {
  key: StageKey;
  status: StageBarStatus;
  /** 0–100, derived exactly like the stage bars on the project overview. */
  progress: number;
};

/** Built once on the server and shared by every row, so each row ships three numbers per stage. */
export type StageBarLabels = {
  /** Accessible name of the whole bar ("Progress by stage"). */
  group: string;
  /** Marks the stage the project is in now. */
  current: string;
  /** "{stage}: {status}, {percent}%" */
  segment: string;
  stages: Record<StageKey, string>;
  statuses: Record<StageBarStatus, string>;
};

const FILL: Record<StageBarStatus, string> = {
  NOT_STARTED: "bg-transparent",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-ok-dot",
  BLOCKED: "bg-risk-dot",
};

/** The dot beside the status in the tooltip — the tooltip is dark, so "not started" is a faint white. */
const DOT: Record<StageBarStatus, string> = {
  NOT_STARTED: "bg-white/40",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-ok-dot",
  BLOCKED: "bg-risk-dot",
};

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * The four stages of a project, in order, as one bar a supplier can read at a
 * glance and explore when they want to.
 *
 * Each segment is its own link to that stage on the project overview, with a
 * tooltip on hover and on focus. Keyboard use follows the toolbar pattern: the
 * bar is one Tab stop (landing on the current stage), and the arrow keys move
 * between stages — so a list of twenty projects is twenty Tab stops, not
 * eighty. Touch has no hover, so the row around the bar always states the
 * current stage in text as well.
 *
 * Only stage key, status and progress arrive here — the same three values the
 * supplier's project overview already shows, taken from the supplier-scoped
 * project list.
 */
export function StageProgressBar({
  projectId,
  stages,
  currentStage,
  labels,
  className,
}: {
  projectId: string;
  stages: StageBarItem[];
  currentStage: StageKey;
  labels: StageBarLabels;
  className?: string;
}) {
  const currentIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.key === currentStage),
  );
  const [focusIndex, setFocusIndex] = React.useState(currentIndex);
  const listRef = React.useRef<HTMLDivElement>(null);

  const moveTo = (index: number) => {
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-stage]");
    if (!links?.length) return;
    const next = (index + links.length) % links.length;
    setFocusIndex(next);
    links[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo(focusIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo(focusIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(stages.length - 1);
        break;
    }
  };

  return (
    <div
      ref={listRef}
      role="toolbar"
      aria-label={labels.group}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn("flex items-center gap-1", className)}
    >
      {stages.map((stage, index) => {
        const pct = clamp(stage.progress);
        const isCurrent = index === currentIndex;
        const stageName = labels.stages[stage.key];
        const statusName = labels.statuses[stage.status];
        const description = interpolate(labels.segment, {
          stage: stageName,
          status: statusName,
          percent: pct,
        });

        return (
          <Tooltip
            key={stage.key}
            delayDuration={120}
            content={
              <span className="block py-0.5">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{stageName}</span>
                  {isCurrent ? (
                    <span className="rounded-xs bg-white/15 px-1 text-[11px] font-medium">
                      {labels.current}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 font-normal">
                  <span className={cn("size-1.5 shrink-0 rounded-full", DOT[stage.status])} aria-hidden />
                  <span>{statusName}</span>
                  <span className="text-white/60"> · </span>
                  <span className="tabular-nums">{pct}%</span>
                </span>
              </span>
            }
          >
            <Link
              href={`/supplier/projects/${projectId}#stage-${stage.key}`}
              data-stage={stage.key}
              tabIndex={index === focusIndex ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              aria-label={isCurrent ? `${description} · ${labels.current}` : description}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                // 40 px tall on touch layouts, so a thumb can hit a segment;
                // the visible bar stays a thin line in the middle of it.
                "group/segment flex h-10 min-w-0 flex-1 items-center rounded-xs md:h-6",
              )}
            >
              <span
                className={cn(
                  "relative block w-full overflow-hidden rounded-full transition-[height,background-color] duration-150",
                  isCurrent
                    ? "h-2 bg-brand-soft ring-1 ring-brand-line"
                    : "h-1.5 bg-line-soft group-hover/segment:bg-line",
                  "group-hover/segment:h-2",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
                    FILL[stage.status],
                    isCurrent && stage.status === "IN_PROGRESS" && "bg-brand-strong",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </span>
            </Link>
          </Tooltip>
        );
      })}
    </div>
  );
}
