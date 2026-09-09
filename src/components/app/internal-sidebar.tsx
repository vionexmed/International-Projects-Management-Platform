"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { VionexMark } from "@/components/app/logo";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { signOut } from "@/server/actions/auth";
import {
  ChangePasswordDialog,
  PT_PASSWORD_LABELS,
} from "@/features/account/change-password-dialog";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

type NavEntry = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const STORAGE_KEY = "vionex.sidebar.collapsed";

/**
 * The collapsed preference lives in localStorage, which is outside React.
 * Reading it through `useSyncExternalStore` keeps the server render (always
 * expanded) and the client render consistent without an effect.
 */
const collapsedStore = {
  subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener("vionex:sidebar", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("vionex:sidebar", onChange);
    };
  },
  getSnapshot() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  },
  getServerSnapshot() {
    return false;
  },
};

export function InternalSidebar({
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
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const collapsed = React.useSyncExternalStore(
    collapsedStore.subscribe,
    collapsedStore.getSnapshot,
    collapsedStore.getServerSnapshot,
  );

  const toggle = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      // A browser blocking site data simply keeps the sidebar expanded.
    }
    window.dispatchEvent(new Event("vionex:sidebar"));
  };

  const primary: NavEntry[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projetos", icon: FolderKanban },
    { href: "/tasks", label: "Tarefas", icon: ListChecks, badge: taskCount },
    { href: "/documents", label: "Documentos", icon: FileText },
    { href: "/suppliers", label: "Fornecedores", icon: Building2 },
    { href: "/regulatory", label: "Regulatório", icon: ShieldCheck },
    { href: "/reports", label: "Relatórios", icon: PieChart },
  ];

  const secondary: NavEntry[] = [
    { href: "/team", label: "Equipe", icon: Users },
    { href: "/notifications", label: "Notificações", icon: Bell, badge: notificationCount },
    { href: "/settings", label: "Configurações", icon: Settings },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-navy-line bg-navy transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-[232px]",
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-4 py-5", collapsed && "justify-center px-0")}>
        <VionexMark className="size-7 shrink-0 text-brand" />
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-semibold tracking-[0.14em] text-white">VIONEX</div>
            <div className="mt-0.5 truncate text-[10px] tracking-[0.1em] text-navy-ink">
              INTERNATIONAL PROJECTS
            </div>
          </div>
        ) : null}
      </div>

      <nav className="scroll-slim flex-1 overflow-y-auto px-2.5 pb-3" aria-label="Navegação principal">
        <ul className="space-y-0.5">
          {primary.map((entry) => (
            <NavLink key={entry.href} entry={entry} active={isActive(entry.href)} collapsed={collapsed} />
          ))}
        </ul>

        <div className="my-3 h-px bg-navy-line" />

        <ul className="space-y-0.5">
          {secondary.map((entry) => (
            <NavLink key={entry.href} entry={entry} active={isActive(entry.href)} collapsed={collapsed} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-navy-line p-2.5">
        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-sm p-1.5 text-left transition-colors hover:bg-navy-soft",
                collapsed && "justify-center",
              )}
            >
              <UserAvatar name={user.name} size="sm" tone="dark" />
              {!collapsed ? (
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-white">{user.name}</span>
                  <span className="block truncate text-[11px] text-navy-ink">
                    {user.jobTitle ?? roleLabel}
                  </span>
                </span>
              ) : null}
            </button>
          </DropdownTrigger>

          <DropdownContent side="top" align="start" className="min-w-56">
            <DropdownLabel>{user.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem asChild>
              <Link href="/settings">
                <Settings />
                Configurações
              </Link>
            </DropdownItem>
            <DropdownItem
              onSelect={(event) => {
                // Let the menu close first, then open the dialog.
                event.preventDefault();
                setPasswordOpen(true);
              }}
            >
              <KeyRound />
              Alterar senha
            </DropdownItem>
            <DropdownSeparator />
            <form action={signOut}>
              <DropdownItem asChild destructive>
                <button type="submit" className="w-full">
                  <LogOut />
                  Sair
                </button>
              </DropdownItem>
            </form>
          </DropdownContent>
        </Dropdown>

        <ChangePasswordDialog
          labels={PT_PASSWORD_LABELS}
          open={passwordOpen}
          onOpenChange={setPasswordOpen}
        />

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "mt-1 flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[12px] text-navy-ink transition-colors hover:bg-navy-soft hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              Recolher
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  entry,
  active,
  collapsed,
}: {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = entry.icon;
  return (
    <li>
      <Link
        href={entry.href}
        title={collapsed ? entry.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors",
          active
            ? "bg-navy-soft font-medium text-white"
            : "text-navy-ink hover:bg-navy-soft/70 hover:text-white",
          collapsed && "justify-center px-0",
        )}
      >
        {active ? (
          <span className="absolute top-1.5 bottom-1.5 -left-2.5 w-[3px] rounded-r-full bg-brand" aria-hidden />
        ) : null}

        <Icon className={cn("size-[17px] shrink-0", active ? "text-brand" : "text-current")} />

        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.badge ? (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-navy-line px-1.5 text-[10px] font-semibold text-white tabular-nums">
                {entry.badge > 99 ? "99+" : entry.badge}
              </span>
            ) : null}
          </>
        ) : entry.badge ? (
          <span className="absolute top-1 right-2 size-1.5 rounded-full bg-brand" aria-hidden />
        ) : null}
      </Link>
    </li>
  );
}
