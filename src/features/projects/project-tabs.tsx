"use client";

import { usePathname } from "next/navigation";
import type { StageKey } from "@/generated/prisma";
import { TabsNav } from "@/components/app/tabs-nav";
import { STAGE_SEGMENTS, stageSegment } from "@/features/projects/stage-routes";

/**
 * Five tabs, not nine. The four stage pages share one "Etapas" tab (they have
 * the same shape, and four look-alike tabs made the bar read as a wall), and
 * the full history is reached from the overview's activity section instead of
 * a tab of its own. The URLs underneath did not change.
 */
export function ProjectTabs({
  projectId,
  currentStage,
  className,
}: {
  projectId: string;
  /** "Etapas" opens where the project is now. */
  currentStage: StageKey;
  className?: string;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const at = (segment: string) => pathname === `${base}/${segment}`;

  return (
    <TabsNav
      className={className}
      items={[
        // The timeline is the overview's full history, so it keeps that tab lit.
        { href: base, label: "Visão geral", active: pathname === base || at("timeline") },
        {
          href: `${base}/${stageSegment(currentStage)}`,
          label: "Etapas",
          active: STAGE_SEGMENTS.some(at),
        },
        { href: `${base}/documents`, label: "Documentos", active: at("documents") },
        { href: `${base}/tasks`, label: "Tarefas", active: at("tasks") },
        { href: `${base}/messages`, label: "Mensagens", active: at("messages") },
      ]}
    />
  );
}
