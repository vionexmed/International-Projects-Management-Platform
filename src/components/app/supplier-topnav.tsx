"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Globe, KeyRound, UserRound, Users } from "lucide-react";
import { VionexLogo } from "@/components/app/logo";
import { SupplierMobileNav } from "@/components/app/supplier-mobile-nav";
import { SearchTrigger } from "@/components/app/command-palette";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { SignOutItem } from "@/components/app/sign-out-item";
import { setLanguageAction } from "@/server/actions/preferences";
import { ChangePasswordDialog } from "@/features/account/change-password-dialog";
import { LOCALE_LABELS, SELECTABLE_LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

/**
 * A 44-px top nav, replacing the sidebar the supplier portal used to share
 * the shape of with the internal app. A supplier has five destinations, not
 * twelve, and Rocketlane's own customer portal makes the same call: no rail,
 * text tabs in a slim header, a stack of sections below.
 *
 * `<md` collapses the tabs into the existing drawer (`SupplierMobileNav`),
 * which already renders every destination plus language and sign-out.
 */
export function SupplierTopNav({
  user,
  dict,
  locale,
  actionRequiredCount,
  messageCount,
  notificationCount,
  manageUsers = false,
}: {
  user: SessionUser;
  dict: Dictionary;
  locale: Locale;
  actionRequiredCount: number;
  messageCount: number;
  notificationCount: number;
  /** Server-decided. The page refuses the request regardless of this flag. */
  manageUsers?: boolean;
}) {
  const pathname = usePathname();
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  const tabs = [
    { href: "/supplier", label: dict.nav.home, exact: true },
    { href: "/supplier/action-required", label: dict.nav.actionRequired, count: actionRequiredCount },
    { href: "/supplier/projects", label: dict.nav.projects },
    { href: "/supplier/documents", label: dict.nav.documents },
    { href: "/supplier/messages", label: dict.nav.messages, count: messageCount },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-1 border-b border-line bg-surface px-3 sm:px-5 lg:px-8">
      <SupplierMobileNav
        dict={dict}
        locale={locale}
        manageUsers={manageUsers}
        actionRequiredCount={actionRequiredCount}
        messageCount={messageCount}
      />

      <Link href="/supplier" className="shrink-0 rounded-sm px-1" aria-label="Vionex — Home">
        <VionexLogo width={92} subtitle={null} />
      </Link>

      <nav className="ml-2 hidden h-full items-center gap-0.5 md:flex" aria-label={dict.nav.projects}>
        {tabs.map((tab) => {
          const active = isActive(tab.href, tab.exact);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-full items-center gap-1.5 border-b-2 px-3 text-label font-medium whitespace-nowrap transition-colors",
                active
                  ? "border-brand text-ink"
                  : "border-transparent text-muted hover:border-line-strong hover:text-ink-soft",
              )}
            >
              {tab.label}
              {tab.count ? (
                <span
                  className={cn(
                    "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                    active ? "bg-brand-soft text-brand-deep" : "bg-raised text-muted",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <SearchTrigger label={dict.common.search} />
        <LanguagePicker locale={locale} label={dict.nav.language} />

        <Link
          href="/supplier/notifications"
          aria-label={dict.nav.notifications}
          className="relative inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Bell className="size-[18px]" />
          {notificationCount > 0 ? (
            <span
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand ring-2 ring-surface"
              aria-hidden
            />
          ) : null}
        </Link>

        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              aria-label={`${dict.nav.account}: ${user.name}`}
              className="ml-0.5 inline-flex items-center gap-1 rounded-sm p-1 transition-colors hover:bg-raised"
            >
              <UserAvatar name={user.name} size="sm" tone="brand" />
              <ChevronDown className="hidden size-3.5 shrink-0 text-muted sm:block" />
            </button>
          </DropdownTrigger>
          <DropdownContent side="bottom" align="end" className="min-w-56">
            <div className="px-2.5 pt-2 pb-1">
              <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[12px] text-muted">{user.supplierName}</p>
            </div>
            <DropdownLabel className="pt-0 normal-case tracking-normal">{user.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem asChild>
              <Link href="/supplier/profile">
                <UserRound />
                {dict.portal.profile.title}
              </Link>
            </DropdownItem>
            {manageUsers ? (
              <DropdownItem asChild>
                <Link href="/supplier/users">
                  <Users />
                  {dict.portal.team.title}
                </Link>
              </DropdownItem>
            ) : null}
            <DropdownItem
              onSelect={(event) => {
                // Let the menu close first, then open the dialog.
                event.preventDefault();
                setPasswordOpen(true);
              }}
            >
              <KeyRound />
              {dict.account.changePassword}
            </DropdownItem>
            <DropdownSeparator />
            <SignOutItem label={dict.nav.logOut} />
          </DropdownContent>
        </Dropdown>
      </div>

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
    </header>
  );
}

function LanguagePicker({ locale, label }: { locale: Locale; label: string }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Globe className="size-[18px]" />
        </button>
      </DropdownTrigger>
      <DropdownContent side="bottom" align="end" className="min-w-52">
        <DropdownLabel>{label}</DropdownLabel>
        {SELECTABLE_LOCALES.map((option) => (
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
