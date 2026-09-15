"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Folder,
  Globe,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  SquareCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { VionexLogo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";
import { setLanguageAction } from "@/server/actions/preferences";
import { LOCALE_LABELS, SELECTABLE_LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

/**
 * Suppliers reach the portal from many devices, so the narrow layout gets a
 * real menu rather than a squeezed sidebar.
 */
export function SupplierMobileNav({
  dict,
  locale,
  actionRequiredCount,
  messageCount,
  manageUsers = false,
}: {
  dict: Dictionary;
  locale: Locale;
  actionRequiredCount: number;
  messageCount: number;
  /** Server-decided. The page refuses the request regardless of this flag. */
  manageUsers?: boolean;
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
    { href: "/supplier/profile", label: dict.portal.profile.title, icon: UserRound },
    ...(manageUsers
      ? [{ href: "/supplier/users", label: dict.portal.team.title, icon: Users }]
      : []),
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
              <VionexLogo subtitle={dict.portal.brandLine} />
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

            {/*
              Language and sign-out live here as well as in the sidebar. The
              sidebar is `hidden md:flex`, so on a phone these were the two
              things a supplier simply could not do: change the language of a
              portal they may not read, or log out of a shared device.
            */}
            <div className="mt-auto space-y-3 border-t border-line px-3 py-4">
              <div className="space-y-1.5">
                <p className="px-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                  {dict.nav.language}
                </p>
                <ul className="space-y-0.5">
                  {SELECTABLE_LOCALES.map((option) => (
                    <li key={option}>
                      <form action={setLanguageAction}>
                        <input type="hidden" name="locale" value={option} />
                        <button
                          type="submit"
                          aria-current={option === locale ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
                            option === locale
                              ? "bg-brand-soft/60 font-medium text-brand-deep"
                              : "text-ink-soft hover:bg-raised",
                          )}
                        >
                          <Globe
                            className={cn(
                              "size-[18px]",
                              option === locale ? "text-brand" : "text-muted",
                            )}
                          />
                          <span className="flex-1 text-left">{LOCALE_LABELS[option]}</span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="h-px bg-line" />

              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-raised hover:text-ink"
                >
                  <LogOut className="size-[18px] text-muted" />
                  {dict.nav.logOut}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
