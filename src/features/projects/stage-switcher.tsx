"use client";

import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { StageKey } from "@/generated/prisma";
import { RememberedLink } from "@/components/app/nav-memory";
import { STAGE_ROUTES } from "@/features/projects/stage-routes";
import { StatusIcon } from "@/components/ui/badge";
import { SegmentedToggle, ViewToolbar } from "@/components/app/view-toolbar";
import type { StageProgress } from "@/lib/labels";

export type StageSwitcherItem = {
  key: StageKey;
  status: StageProgress;
  /** Stage status, for the accessible name. */
  statusLabel: string;
};

/**
 * The stage pages are the plan's stage details. Rendered by the project
 * layout, it shows itself only on the four stage routes: a way back to the
 * plan and a segmented switch between the stages, each with its status glyph.
 */
export function StageSwitcher({
  projectId,
  stages,
}: {
  projectId: string;
  stages: StageSwitcherItem[];
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const active = STAGE_ROUTES.find((stage) => pathname === `${base}/${stage.segment}`);
  if (!active) return null;

  return (
    <ViewToolbar
      className="px-4 sm:px-6"
      left={
        // Back to the plan in its remembered view (list/board, stage, assignee).
        <RememberedLink
          href={`${base}/tasks`}
          transitionTypes={["nav-back"]}
          className="inline-flex items-center gap-1.5 text-label font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Plano
        </RememberedLink>
      }
      center={
        <SegmentedToggle
          label="Etapas do projeto"
          className="scroll-slim max-w-full overflow-x-auto"
          items={STAGE_ROUTES.map((stage) => {
            const status = stages.find((item) => item.key === stage.key);
            return {
              href: `${base}/${stage.segment}`,
              label: stage.label,
              icon: <StatusIcon status={status?.status ?? "NOT_STARTED"} label={status?.statusLabel} />,
              active: stage.segment === active.segment,
            };
          })}
        />
      }
    />
  );
}
