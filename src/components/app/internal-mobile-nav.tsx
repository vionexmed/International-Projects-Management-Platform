"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { VionexMark } from "@/components/app/logo";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

/**
 * The internal environment is desktop-first, but the team still opens it on a
 * phone or a narrow tablet. Below `lg` the navy rail is replaced by this
 * drawer so the content keeps the full width.
 */
export function InternalMobileNav({
  user,
  roleLabel,
  notificationCount,
  taskCount,
}: {
  user: SessionUser;
  roleLabel: string;
  notificationCount: number;
  taskCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projetos", icon: FolderKanban },
    { href: "/tasks", label: "Tarefas", icon: ListChecks, badge: taskCount },
    { href: "/documents", label: "Documentos", icon: FileText },
    { href: "/suppliers", label: "Fornecedores", icon: Building2 },
    { href: "/regulatory", label: "Regulatório", icon: ShieldCheck },
    { href: "/reports", label: "Relatórios", icon: PieChart },
    { href: "/team", label: "Equipe", icon: Users },
    { href: "/notifications", label: "Notificações", icon: Bell, badge: notificationCount },
    { href: "/settings", label: "Configurações", icon: Settings },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
        <Menu />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-navy/40"
            onClick={() => setOpen(false)}
          />

          <div className="relative flex w-[264px] flex-col bg-navy">
            <div className="flex items-center justify-between px-4 py-5">
              <span className="flex items-center gap-2.5">
                <VionexMark className="size-7 text-brand" />
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold tracking-[0.14em] text-white">
                    VIONEX
                  </span>
                  <span className="block text-[10px] tracking-[0.1em] text-navy-ink">
                    INTERNATIONAL PROJECTS
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-sm p-1 text-navy-ink transition-colors hover:bg-navy-soft hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="scroll-slim flex-1 overflow-y-auto px-2.5 pb-4">
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "bg-navy-soft font-medium text-white"
                            : "text-navy-ink hover:bg-navy-soft/70 hover:text-white",
                        )}
                      >
                        <Icon className={cn("size-[18px]", active ? "text-brand" : "text-current")} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-line px-1.5 text-[11px] font-semibold text-white tabular-nums">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-navy-line p-3">
              <div className="flex items-center gap-2.5 px-1.5 py-1.5">
                <UserAvatar name={user.name} size="sm" tone="dark" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-white">{user.name}</span>
                  <span className="block truncate text-[11px] text-navy-ink">
                    {user.jobTitle ?? roleLabel}
                  </span>
                </span>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="mt-1 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] text-navy-ink transition-colors hover:bg-navy-soft hover:text-white"
                >
                  <LogOut className="size-4" />
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
