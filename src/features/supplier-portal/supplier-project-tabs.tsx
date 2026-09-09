"use client";

import { usePathname } from "next/navigation";
import { TabsNav } from "@/components/app/tabs-nav";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function SupplierProjectTabs({
  projectId,
  dict,
  className,
}: {
  projectId: string;
  dict: Dictionary;
  className?: string;
}) {
  const pathname = usePathname();
  const base = `/supplier/projects/${projectId}`;

  const tabs = [
    { segment: "", label: dict.portal.project.overview },
    { segment: "documents", label: dict.portal.project.documents },
    { segment: "action-required", label: dict.portal.project.actionRequired },
    { segment: "messages", label: dict.portal.project.messages },
    { segment: "timeline", label: dict.portal.project.timeline },
  ];

  return (
    <TabsNav
      className={className}
      items={tabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        return { href, label: tab.label, active: pathname === href };
      })}
    />
  );
}
