import type { Metadata } from "next";
import { requireSupplierUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { PageHeader } from "@/components/app/page-header";
import { trailLabels } from "@/components/app/trail-labels";
import { Panel, PropertyList } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { ProfileForm } from "@/features/account/profile-form";
import { ChangePasswordButton } from "@/features/account/change-password-button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Profile" };

/**
 * The supplier's own account.
 *
 * Until now a portal user could change their password and their language from
 * a dropdown in the sidebar, and nothing else — their own name, if it was
 * typed wrong when Vionex created the account, stayed wrong.
 *
 * Company and role are shown and not editable. They are the identity the
 * isolation rules are built on, and a person editing their own tenancy is the
 * one thing this screen must never allow.
 */
export default async function SupplierProfilePage() {
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const account = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, jobTitle: true, role: true, lastLoginAt: true },
  });

  return (
    <>
      {/* Reached from the account menu, not the sidebar: a trail back home. */}
      <PageHeader
        breadcrumb={[{ label: dict.nav.home, href: "/supplier" }, { label: dict.portal.profile.title }]}
        trailLabels={trailLabels(locale, dict.common.back)}
        title={dict.portal.profile.title}
        description={dict.portal.profile.subtitle}
      />

      <div className="max-w-3xl space-y-10">
        <div className="grid gap-4 md:grid-cols-[240px_1fr] md:gap-8">
          <div>
            <h2 className="text-section text-ink">{account.name}</h2>
            <p className="mt-1 text-meta text-muted">{account.email}</p>
          </div>

          <Panel className="p-5">
            <div className="flex items-start gap-5">
              <UserAvatar name={account.name} size="lg" tone="brand" />
              <PropertyList
                className="flex-1 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3"
                items={[
                  { label: dict.common.jobTitle, value: account.jobTitle },
                  { label: dict.portal.profile.company, value: user.supplierName },
                  {
                    label: dict.common.role,
                    value:
                      account.role === "SUPPLIER_ADMIN"
                        ? dict.portal.team.roleAdmin
                        : dict.portal.team.roleUser,
                  },
                  {
                    label: dict.portal.profile.lastSignIn,
                    value: account.lastLoginAt ? formatRelative(account.lastLoginAt, locale) : null,
                  },
                ]}
              />
            </div>
            <div className="mt-5 flex justify-end border-t border-line pt-4">
              <ProfileForm dict={dict} name={account.name} jobTitle={account.jobTitle} />
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-[240px_1fr] md:gap-8">
          <div>
            <h2 className="text-section text-ink">{dict.account.changePassword}</h2>
            <p className="mt-1 text-meta text-muted">{dict.account.changePasswordHint}</p>
          </div>

          <Panel className="flex items-center justify-end p-5">
            <ChangePasswordButton dict={dict} />
          </Panel>
        </div>
      </div>
    </>
  );
}
