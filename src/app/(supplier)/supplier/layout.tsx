import { can, requireSupplierUser } from "@/server/auth/current-user";
import { countUnread } from "@/server/services/notifications";
import { countUnreadMessages } from "@/server/services/messages";
import { countSupplierQueue } from "@/server/services/supplier-queue";
import { SupplierTopNav } from "@/components/app/supplier-topnav";
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

  /**
   * The badge counts the same things Action Required lists — documents *and*
   * tasks. It used to count only document requests, so a supplier with three
   * open tasks and nothing else saw a portal that looked idle.
   */
  const [queue, unreadMessages, notifications] = await Promise.all([
    countSupplierQueue(user),
    countUnreadMessages(user),
    countUnread(user.id),
  ]);
  const actionRequired = queue.open;

  return (
    <>
      <DemoBanner />
      <div className="flex min-h-dvh flex-col bg-canvas">
        <SupplierTopNav
          user={user}
          dict={dict}
          locale={locale}
          actionRequiredCount={actionRequired}
          messageCount={unreadMessages}
          notificationCount={notifications}
          manageUsers={can(user, "portal:manage-users")}
        />

        {/* One palette for the whole portal; the header's search icon opens it. */}
        <CommandPalette
          trigger="none"
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

        <main className="flex-1 px-4 py-7 sm:px-5 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-[1120px]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-5 text-meta text-muted sm:px-5 lg:px-8">
          <span>© {new Date().getFullYear()} Vionex. All rights reserved.</span>
          {/*
            One honest link. "Privacy policy" and "Terms of use" both opened an
            email draft — labels promising pages that do not exist yet.
          */}
          <a href="mailto:projects@vionex.com" className="hover:text-brand-strong">
            projects@vionex.com
          </a>
        </footer>
      </div>
    </>
  );
}
