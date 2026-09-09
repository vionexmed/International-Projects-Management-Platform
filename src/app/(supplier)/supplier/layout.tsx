import { Bell, Building2 } from "lucide-react";
import Link from "next/link";
import { requireSupplierUser } from "@/server/auth/current-user";
import { countUnread } from "@/server/services/notifications";
import { countUnreadMessages } from "@/server/services/messages";
import { db } from "@/server/db";
import { documentRequestScope } from "@/server/authz/scopes";
import { SupplierSidebar } from "@/components/app/supplier-sidebar";
import { SupplierMobileNav } from "@/components/app/supplier-mobile-nav";
import { CommandPalette } from "@/components/app/command-palette";
import { DemoBanner } from "@/components/app/demo-banner";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

/**
 * Server-side gate for the Supplier Portal. Internal users are redirected to
 * the Vionex environment, and everything below inherits a session whose
 * supplier link is guaranteed to exist.
 */
export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [actionRequired, unreadMessages, notifications] = await Promise.all([
    db.documentRequest.count({
      where: { AND: [documentRequestScope(user), { status: { in: ["PENDING", "REJECTED"] } }] },
    }),
    countUnreadMessages(user),
    countUnread(user.id),
  ]);

  return (
    <>
      <DemoBanner />
    <div className="flex min-h-dvh bg-surface">
      <SupplierSidebar
        user={user}
        dict={dict}
        locale={locale}
        actionRequiredCount={actionRequired}
        messageCount={unreadMessages}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-5 lg:px-8">
          <SupplierMobileNav
            dict={dict}
            actionRequiredCount={actionRequired}
            messageCount={unreadMessages}
          />

          <CommandPalette
            labels={{
              placeholder: dict.common.search,
              empty: dict.common.noResults,
              hint: dict.portal.projects.searchPlaceholder,
              groups: {
                project: dict.common.project,
                task: dict.nav.actionRequired,
                document: dict.common.type,
                supplier: dict.common.supplier,
              },
            }}
          />

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/supplier/action-required"
              aria-label={dict.nav.notifications}
              className="relative inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Bell className="size-[18px]" />
              {notifications > 0 ? (
                <span
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand ring-2 ring-surface"
                  aria-hidden
                />
              ) : null}
            </Link>

            <span className="h-5 w-px bg-line" aria-hidden />

            <span className="inline-flex items-center gap-2.5 rounded-md border border-line px-3 py-2 text-[13px] font-medium text-ink">
              <Building2 className="size-4 text-muted" />
              {user.supplierName}
            </span>
          </div>
        </header>

        <main className="flex-1 px-5 py-8 lg:px-8">
          <div className="mx-auto w-full max-w-[1160px]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-5 text-[12px] text-muted lg:px-8">
          <span>© {new Date().getFullYear()} Vionex. All rights reserved.</span>
          <span className="flex items-center gap-5">
            <a href="mailto:projects@vionex.com" className="hover:text-brand-strong">
              Privacy policy
            </a>
            <a href="mailto:projects@vionex.com" className="hover:text-brand-strong">
              Terms of use
            </a>
          </span>
        </footer>
      </div>
      </div>
    </>
  );
}
