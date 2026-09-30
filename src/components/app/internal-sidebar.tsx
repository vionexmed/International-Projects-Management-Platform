"use client";

import * as React from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronsUpDown,
  KeyRound,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { VionexLogo, VionexMarkColor } from "@/components/app/logo";
import { SidebarSearch } from "@/components/app/sidebar-search";
import { NavPending } from "@/components/app/nav-pending";
import { UserAvatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { SignOutItem } from "@/components/app/sign-out-item";
import {
  ChangePasswordDialog,
  PT_PASSWORD_LABELS,
} from "@/features/account/change-password-dialog";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

type NavEntry = {
  href: string;
  /** The section the entry stands for, when `href` carries a filter. */
  match?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

type NavGroup = { label: string; entries: NavEntry[] };

type SidebarProps = {
  user: SessionUser;
  roleLabel: string;
  notificationCount: number;
  taskCount: number;
};

/*
  The default is a 48-px icon rail — work pages get the width back. "Pinning"
  restores the labelled 232-px sidebar. A new key, not the old `collapsed`
  one: the default flipped, so an old "0" must not be read as "pinned".
*/
const STORAGE_KEY = "vionex.sidebar.pinned";
const CHANGE_EVENT = "vionex:sidebar";

/**
 * The preference lives in localStorage, which is outside React. Reading it
 * through `useSyncExternalStore` keeps the server render (always the rail)
 * and the client render consistent without an effect.
 */
const pinnedStore = {
  subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
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

function setPinned(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // A browser blocking site data simply keeps the rail.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function badgeText(value: number) {
  return value > 99 ? "99+" : String(value);
}

export function InternalSidebar({ user, roleLabel, notificationCount, taskCount }: SidebarProps) {
  const pathname = usePathname();
  const pinned = React.useSyncExternalStore(
    pinnedStore.subscribe,
    pinnedStore.getSnapshot,
    pinnedStore.getServerSnapshot,
  );

  /*
    The badge counts *my* open tasks, so the entry opens that same view —
    landing on the portfolio-wide list made the number and the page answer
    two different questions.
  */
  const primary: NavGroup[] = [
    {
      label: "Trabalho",
      entries: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/projects", label: "Projetos", icon: FolderKanban },
        {
          href: `/tasks?assignee=${user.id}`,
          match: "/tasks",
          label: "Tarefas",
          icon: ListChecks,
          badge: taskCount,
        },
        { href: "/documents", label: "Documentos", icon: FileText },
      ],
    },
    {
      label: "Gestão",
      entries: [
        { href: "/suppliers", label: "Fornecedores", icon: Building2 },
        { href: "/regulatory", label: "Regulatório", icon: ShieldCheck },
        { href: "/reports", label: "Relatórios", icon: PieChart },
      ],
    },
  ];
  /*
    Only the seven work areas live in the navigation. Equipe and
    Configurações are about the organisation, not the work, and Configurações
    was listed twice (here and in the account menu) — both now live in the
    account menu alone.
  */
  const notifications: NavEntry = {
    href: "/notifications",
    label: "Notificações",
    icon: Bell,
    badge: notificationCount,
  };

  const isActive = (entry: NavEntry) => {
    const href = entry.match ?? entry.href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col bg-[linear-gradient(180deg,#15191d_0,#15191d_340px,#0c0e10_100%)] lg:flex print:hidden",
        pinned ? "w-[236px]" : "w-14",
      )}
    >
      {pinned ? (
        <ExpandedSidebar
          {...{ user, roleLabel, primary, isActive }}
          secondary={[notifications]}
        />
      ) : (
        <Rail {...{ user, primary, isActive, notifications }} />
      )}
    </aside>
  );
}

/* --------------------------------------------------------------- shared -- */

/*
  The active item's highlight is one element with a view-transition name:
  moving to another section, the browser slides it from the old item to the
  new one instead of switching it off here and on there.
*/
function ActivePill({ rail = false }: { rail?: boolean }) {
  return (
    <ViewTransition name="sidebar-active" share="sidebar-pill" default="none">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-r from-white/[0.11] to-white/[0.035] ring-1 ring-white/[0.07] ring-inset"
      >
        <span
          className={cn(
            "absolute w-[3px] rounded-r-full bg-[#4cc3cf] shadow-[0_0_10px_rgba(76,195,207,0.75)]",
            rail ? "top-2.5 bottom-2.5 -left-2" : "top-2 bottom-2 -left-3",
          )}
        />
      </span>
    </ViewTransition>
  );
}

const ICON_ACTIVE = "text-[#5fd0da]";

/* ---------------------------------------------------------------- rail -- */

function Rail({
  user,
  primary,
  notifications,
  isActive,
}: {
  user: SessionUser;
  primary: NavGroup[];
  notifications: NavEntry;
  isActive: (entry: NavEntry) => boolean;
}) {
  return (
    <>
      <div className="relative flex h-16 shrink-0 items-center justify-center">
        <Link href="/dashboard" className="rounded-md" aria-label="Vionex — Dashboard">
          <VionexMarkColor className="size-9" />
        </Link>
      </div>

      <nav
        className="scroll-slim relative flex flex-1 flex-col items-center overflow-y-auto py-1"
        aria-label="Navegação principal"
      >
        {primary.map((group, index) => (
          <div key={group.label} className="flex flex-col items-center gap-1">
            {index > 0 ? <span aria-hidden className="my-2 h-px w-6 bg-white/[0.08]" /> : null}
            {group.entries.map((entry) => (
              <RailLink key={entry.href} entry={entry} active={isActive(entry)} />
            ))}
          </div>
        ))}
      </nav>

      <div className="relative flex shrink-0 flex-col items-center gap-1 border-t border-white/[0.06] py-2.5">
        {/* The same magnifier as the full sidebar: it opens into a field that grows out over the page. */}
        <SidebarSearch variant="rail" />
        <RailLink entry={notifications} active={isActive(notifications)} />
        <Tooltip content="Fixar menu expandido" side="right">
          <button
            type="button"
            onClick={() => setPinned(true)}
            aria-label="Expandir menu"
            className={RAIL_ITEM}
          >
            <PanelLeftOpen className="size-[18px]" />
          </button>
        </Tooltip>
        <AccountMenu user={user} side="right">
          <button
            type="button"
            aria-label={`Conta de ${user.name}`}
            className="mt-1 inline-flex size-10 items-center justify-center rounded-full ring-1 ring-white/10 transition-shadow hover:ring-white/25"
          >
            <UserAvatar name={user.name} size="sm" tone="dark" />
          </button>
        </AccountMenu>
      </div>
    </>
  );
}

const RAIL_ITEM =
  "relative inline-flex size-10 shrink-0 items-center justify-center rounded-md text-navy-ink transition-colors duration-200 hover:bg-white/[0.05] hover:text-white";

function RailLink({ entry, active }: { entry: NavEntry; active: boolean }) {
  const Icon = entry.icon;
  const count = entry.badge ?? 0;
  const label = count ? `${entry.label} (${badgeText(count)})` : entry.label;
  return (
    <Tooltip content={label} side="right">
      <Link
        href={entry.href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        transitionTypes={["nav-page"]}
        className={cn(RAIL_ITEM, active && "text-white hover:bg-transparent")}
      >
        {active ? <ActivePill rail /> : null}
        <NavPending />
        <Icon className={cn("relative size-[18px]", active && ICON_ACTIVE)} />
        {count ? (
          <span
            className="absolute top-0.5 right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-none font-bold text-white ring-2 ring-[#121518] tabular-nums"
            aria-hidden
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Link>
    </Tooltip>
  );
}

/* ------------------------------------------------------------ expanded -- */

function ExpandedSidebar({
  user,
  roleLabel,
  primary,
  secondary,
  isActive,
}: {
  user: SessionUser;
  roleLabel: string;
  primary: NavGroup[];
  secondary: NavEntry[];
  isActive: (entry: NavEntry) => boolean;
}) {
  return (
    <>
      {/* The logo centred in the rail, as the mark is when it is collapsed. */}
      <div className="relative flex justify-center px-4 pt-6 pb-5">
        <Link href="/dashboard" aria-label="Vionex — Dashboard" className="rounded-md">
          <VionexLogo tone="rail" width={128} className="items-center" />
        </Link>
      </div>

      {/* A magnifier that opens into a field where it sits; ⌘K still opens the full palette. */}
      <div className="relative px-3 pb-1">
        <SidebarSearch />
      </div>

      <nav className="scroll-slim relative flex-1 overflow-y-auto px-3 pb-3" aria-label="Navegação principal">
        {primary.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pt-4 pb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-white/30 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.entries.map((entry) => (
                <ExpandedLink key={entry.href} entry={entry} active={isActive(entry)} />
              ))}
            </ul>
          </div>
        ))}
        <div className="mx-2.5 my-4 h-px bg-white/[0.07]" />
        <ul className="space-y-0.5">
          {secondary.map((entry) => (
            <ExpandedLink key={entry.href} entry={entry} active={isActive(entry)} />
          ))}
        </ul>
      </nav>

      <div className="relative flex items-center gap-1.5 border-t border-white/[0.06] p-3">
        <AccountMenu user={user} side="top">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg bg-white/[0.03] p-2 text-left ring-1 ring-white/[0.06] transition-colors ring-inset hover:bg-white/[0.06]"
          >
            <UserAvatar name={user.name} size="sm" tone="dark" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-white">{user.name}</span>
              <span className="block truncate text-[11px] text-navy-ink">
                {user.jobTitle ?? roleLabel}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-white/35" aria-hidden />
          </button>
        </AccountMenu>

        <Tooltip content="Recolher menu" side="top">
          <button
            type="button"
            onClick={() => setPinned(false)}
            aria-label="Recolher menu"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-navy-ink transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </Tooltip>
      </div>
    </>
  );
}

function ExpandedLink({ entry, active }: { entry: NavEntry; active: boolean }) {
  const Icon = entry.icon;
  return (
    <li>
      <Link
        href={entry.href}
        aria-current={active ? "page" : undefined}
        transitionTypes={["nav-page"]}
        className={cn(
          "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] transition-colors duration-200",
          active ? "font-medium text-white" : "text-navy-ink hover:bg-white/[0.045] hover:text-white",
        )}
      >
        {active ? <ActivePill /> : null}
        <NavPending />
        <Icon
          className={cn(
            "relative size-[17px] shrink-0 transition-transform duration-200",
            active ? ICON_ACTIVE : "text-current group-hover:translate-x-px",
          )}
        />
        <span className="relative min-w-0 flex-1 truncate">{entry.label}</span>
        {entry.badge ? (
          <span className="relative inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white tabular-nums">
            {badgeText(entry.badge)}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------- account -- */

function AccountMenu({
  user,
  side,
  children,
}: {
  user: SessionUser;
  side: "top" | "right";
  children: React.ReactElement;
}) {
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>{children}</DropdownTrigger>
        <DropdownContent side={side} align={side === "right" ? "end" : "start"} className="min-w-56">
          <div className="px-2.5 pt-2 pb-1">
            <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
          </div>
          <DropdownLabel className="pt-0 normal-case tracking-normal">{user.email}</DropdownLabel>
          <DropdownSeparator />
          <DropdownItem asChild>
            <Link href="/team">
              <Users />
              Equipe
            </Link>
          </DropdownItem>
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
          <SignOutItem label="Sair" />
        </DropdownContent>
      </Dropdown>

      <ChangePasswordDialog
        labels={PT_PASSWORD_LABELS}
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </>
  );
}
