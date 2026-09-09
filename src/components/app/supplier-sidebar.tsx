"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FileText,
  Folder,
  Globe,
  Home,
  KeyRound,
  LogOut,
  MessageSquare,
  SquareCheck,
} from "lucide-react";
import { VionexLogo } from "@/components/app/logo";
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
import { setLanguageAction } from "@/server/actions/preferences";
import { ChangePasswordDialog } from "@/features/account/change-password-dialog";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

/**
 * The supplier's chrome is deliberately lighter than the internal one: fewer
 * destinations, larger targets, and no internal vocabulary.
 */
export function SupplierSidebar({
  user,
  dict,
  locale,
  actionRequiredCount,
  messageCount,
}: {
  user: SessionUser;
  dict: Dictionary;
  locale: Locale;
  actionRequiredCount: number;
  messageCount: number;
}) {
  const pathname = usePathname();
  const [passwordOpen, setPasswordOpen] = React.useState(false);

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
    {
      href: "/supplier/messages",
      label: dict.nav.messages,
      icon: MessageSquare,
      badge: messageCount,
    },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="px-6 pt-6 pb-7">
        <VionexLogo />
        <p className="mt-2 text-[10px] font-medium tracking-[0.14em] text-muted">
          {dict.portal.brandLine}
        </p>
      </div>

      <nav className="flex-1 px-3" aria-label={dict.nav.projects}>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-brand-soft/60 font-medium text-brand-deep"
                      : "text-ink-soft hover:bg-raised hover:text-ink",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-brand"
                      aria-hidden
                    />
                  ) : null}
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-brand" : "text-muted")} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-raised px-1.5 text-[11px] font-medium text-ink-soft tabular-nums">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 p-4">
        <LanguagePicker locale={locale} label={dict.nav.language} />

        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-sm p-1.5 text-left transition-colors hover:bg-raised"
            >
              <UserAvatar name={user.name} size="md" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
                <span className="block truncate text-[12px] text-muted">{user.supplierName}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent side="top" align="start" className="min-w-56">
            <DropdownLabel>{user.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem
              onSelect={(event) => {
                event.preventDefault();
                setPasswordOpen(true);
              }}
            >
              <KeyRound />
              {dict.account.changePassword}
            </DropdownItem>
            <DropdownSeparator />
            <form action={signOut}>
              <DropdownItem asChild destructive>
                <button type="submit" className="w-full">
                  <LogOut />
                  {dict.nav.logOut}
                </button>
              </DropdownItem>
            </form>
          </DropdownContent>
        </Dropdown>

        <ChangePasswordDialog
          open={passwordOpen}
          onOpenChange={setPasswordOpen}
          labels={{
            trigger: dict.account.changePassword,
            title: dict.account.changePassword,
            description: dict.account.changePasswordHint,
            current: dict.account.currentPassword,
            next: dict.account.newPassword,
            confirm: dict.account.confirmPassword,
            hint: dict.account.passwordRule,
            submit: dict.account.changePassword,
            success: dict.account.passwordChanged,
          }}
        />

        <div className="px-1.5 text-[12px]">
          <p className="text-muted">{dict.nav.needHelp}</p>
          <a
            href="mailto:projects@vionex.com"
            className="text-brand-strong underline-offset-4 hover:underline"
          >
            {dict.nav.contactTeam}
          </a>
        </div>

        <div className="h-px bg-line" />

        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-sm px-1.5 py-2 text-[13px] text-ink-soft transition-colors hover:text-ink"
          >
            <LogOut className="size-4 text-muted" />
            {dict.nav.logOut}
          </button>
        </form>
      </div>
    </aside>
  );
}

function LanguagePicker({ locale, label }: { locale: Locale; label: string }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex w-full items-center gap-2.5 rounded-sm border border-line bg-surface px-3 py-2.5 text-[13px] text-ink transition-colors hover:bg-raised"
        >
          <Globe className="size-4 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate text-left">{LOCALE_LABELS[locale]}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      </DropdownTrigger>
      <DropdownContent side="top" align="start" className="min-w-52">
        <DropdownLabel>{label}</DropdownLabel>
        {LOCALES.map((option) => (
          <form key={option} action={setLanguageAction}>
            <input type="hidden" name="locale" value={option} />
            <DropdownItem asChild>
              <button type="submit" className="w-full">
                {LOCALE_LABELS[option]}
                {option === locale ? (
                  <span className="ml-auto text-[11px] text-brand-strong">●</span>
                ) : null}
              </button>
            </DropdownItem>
          </form>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
