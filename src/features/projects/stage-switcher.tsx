"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StageKey } from "@/generated/prisma";
import { STAGE_ROUTES } from "@/features/projects/stage-routes";
import { StatusDot } from "@/components/ui/badge";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

export type StageSwitcherItem = {
  key: StageKey;
  /** Stage status, for the dot and the accessible name. */
  statusLabel: string;
  tone: Tone;
};

/**
 * Rendered by the project layout under the tabs; it shows itself only on the
 * four stage routes, so the stage pages open with it without each one
 * fetching the stage statuses again.
 */
export function StageSwitcher({
  projectId,
  stages,
  className,
}: {
  projectId: string;
  stages: StageSwitcherItem[];
  className?: string;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const active = STAGE_ROUTES.find((stage) => pathname === `${base}/${stage.segment}`);
  if (!active) return null;

  return (
    <nav aria-label="Etapas do projeto" className={cn("scroll-slim overflow-x-auto", className)}>
      <ul className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 shadow-panel">
        {STAGE_ROUTES.map((stage) => {
          const status = stages.find((item) => item.key === stage.key);
          const current = stage.segment === active.segment;
          return (
            <li key={stage.key}>
              <Link
                href={`${base}/${stage.segment}`}
                aria-current={current ? "page" : undefined}
                title={status ? `${stage.label}: ${status.statusLabel}` : stage.label}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-sm px-3 text-body whitespace-nowrap transition-colors",
                  current
                    ? "bg-raised font-medium text-ink"
                    : "text-muted hover:bg-subtle hover:text-ink-soft",
                )}
              >
                {status ? <StatusDot tone={status.tone} /> : null}
                {stage.label}
                {status ? <span className="sr-only">({status.statusLabel})</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
