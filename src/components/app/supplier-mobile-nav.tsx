"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Folder, Home, Menu, MessageSquare, SquareCheck, X } from "lucide-react";
import { VionexLogo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

/**
 * Suppliers reach the portal from many devices, so the narrow layout gets a
 * real menu rather than a squeezed sidebar.
 */
export function SupplierMobileNav({
  dict,
  actionRequiredCount,
  messageCount,
}: {
  dict: Dictionary;
  actionRequiredCount: number;
  messageCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const items = [
    { href: "/supplier", label: dict.nav.home, icon: Home, exact: true },
    { href: "/supplier/projects", label: dict.nav.projects, icon: Folder },
    {
      href: "/supplier/action-required",
      label: dict.nav.actionRequired,
      icon: SquareCheck,
      badge: actionRequiredCount,
    },
    { href: "/supplier/documents", label: dict.nav.documents, icon: FileText },
    { href: "/supplier/messages", label: dict.nav.messages, icon: MessageSquare, badge: messageCount },
  ];

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
      >
        <Menu />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label={dict.common.close}
            className="absolute inset-0 bg-navy/25"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex w-[260px] flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between px-5 py-5">
              <VionexLogo />
              <Button variant="ghost" size="iconSm" onClick={() => setOpen(false)} aria-label={dict.common.close}>
                <X />
              </Button>
            </div>

            <nav className="px-3">
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm",
                          active
                            ? "bg-brand-soft/60 font-medium text-brand-deep"
                            : "text-ink-soft hover:bg-raised",
                        )}
                      >
                        <Icon className={cn("size-[18px]", active ? "text-brand" : "text-muted")} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-raised px-1.5 text-[11px] font-medium tabular-nums">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
