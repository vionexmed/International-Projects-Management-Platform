"use client";

import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, ListChecks, MessageSquare } from "lucide-react";
import { TabsNav } from "@/components/app/tabs-nav";
import { STAGE_SEGMENTS } from "@/features/projects/stage-routes";

/**
 * Four tabs with icons. "Plano" is the task plan (`/tasks`, kept for old
 * links) and also stays lit on the four stage pages, which are the plan's
 * stage details. The full history keeps "Visão geral" lit: it is the long
 * form of the overview's activity list.
 */
export function ProjectTabs({ projectId, className }: { projectId: string; className?: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const at = (segment: string) => pathname === `${base}/${segment}`;

  return (
    <TabsNav
      className={className}
      replace
      items={[
        {
          href: base,
          label: "Visão geral",
          icon: <LayoutDashboard />,
          active: pathname === base || at("timeline"),
        },
        {
          href: `${base}/tasks`,
          label: "Plano",
          icon: <ListChecks />,
          active: at("tasks") || STAGE_SEGMENTS.some(at),
        },
        { href: `${base}/documents`, label: "Documentos", icon: <FileText />, active: at("documents") },
        { href: `${base}/messages`, label: "Mensagens", icon: <MessageSquare />, active: at("messages") },
      ]}
    />
  );
}
