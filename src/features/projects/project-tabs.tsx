"use client";

import { usePathname } from "next/navigation";
import { TabsNav } from "@/components/app/tabs-nav";

const TABS = [
  { segment: "", label: "Visão geral" },
  { segment: "clinical", label: "Clínico" },
  { segment: "regulatory", label: "Regulatório" },
  { segment: "import", label: "Importação e Logística" },
  { segment: "go-to-market", label: "Go-to-Market" },
  { segment: "documents", label: "Documentos" },
  { segment: "tasks", label: "Tarefas" },
  { segment: "messages", label: "Mensagens" },
  { segment: "timeline", label: "Histórico" },
];

export function ProjectTabs({ projectId, className }: { projectId: string; className?: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <TabsNav
      className={className}
      items={TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        return { href, label: tab.label, active: pathname === href };
      })}
    />
  );
}
