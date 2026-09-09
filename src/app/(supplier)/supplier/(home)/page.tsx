import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CircleCheck } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { documentRequestScope } from "@/server/authz/scopes";
import { listNotifications } from "@/server/services/notifications";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary, interpolate, plural } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };

function greetingKey(hour: number) {
  if (hour < 12) return "greetingMorning" as const;
  if (hour < 18) return "greetingAfternoon" as const;
  return "greetingEvening" as const;
}

/**
 * Intentionally not a dashboard (§25): the supplier's entry point states what
 * needs doing and routes them there. Project detail lives on its own page.
 */
export default async function SupplierHomePage() {
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [pendingCount, updates] = await Promise.all([
    db.documentRequest.count({
      where: { AND: [documentRequestScope(user), { status: { in: ["PENDING", "REJECTED"] } }] },
    }),
    listNotifications(user.id, 5),
  ]);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
        {interpolate(dict.portal[greetingKey(new Date().getHours())], { name: firstName })}
      </h1>
      <p className="mt-1.5 mb-8 text-[15px] text-muted">{dict.portal.welcome}</p>

      <Panel className="mb-6">
        <PanelHeader title={dict.portal.home.actionRequiredTitle} />
        <div className="p-5">
          {pendingCount === 0 ? (
            <div className="flex items-center gap-3">
              <CircleCheck className="size-5 shrink-0 text-ok" />
              <p className="text-sm text-ink">{dict.portal.home.actionRequiredEmpty}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink">
                {plural(dict.portal.home.actionRequiredCount, pendingCount)}
              </p>
              <Button variant="primary" className="mt-4" asChild>
                <Link href="/supplier/action-required">
                  {dict.portal.home.viewRequests}
                  <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={dict.portal.home.updatesTitle} />
        {updates.length === 0 ? (
          <EmptyState icon={Bell} title={dict.portal.home.updatesEmpty} compact />
        ) : (
          <ul className="divide-y divide-line-soft">
            {updates.map((update) => {
              const body = (
                <>
                  <p className="text-sm font-medium text-ink">{update.title}</p>
                  {update.description ? (
                    <p className="mt-0.5 text-[13px] text-muted">{update.description}</p>
                  ) : null}
                  <p className="mt-1 text-[12px] text-faint">
                    {formatRelative(update.createdAt, locale)}
                  </p>
                </>
              );

              return (
                <li key={update.id}>
                  {update.href ? (
                    <Link
                      href={update.href}
                      className="block px-5 py-4 transition-colors hover:bg-subtle"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-5 py-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
