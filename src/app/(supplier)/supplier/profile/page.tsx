import type { Metadata } from "next";
import { requireSupplierUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { PageHeader } from "@/components/app/page-header";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
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
      <PageHeader title={dict.portal.profile.title} description={dict.portal.profile.subtitle} />

      <Panel className="mb-6">
        <PanelHeader
          title={account.name}
          description={account.email}
          action={
            <ProfileForm dict={dict} name={account.name} jobTitle={account.jobTitle} />
          }
        />
        <div className="flex items-start gap-5 px-5 pb-5">
          <UserAvatar name={account.name} size="lg" tone="brand" />
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            <Field label={dict.common.jobTitle}>{account.jobTitle ?? "—"}</Field>
            <Field label={dict.portal.profile.company}>{user.supplierName ?? "—"}</Field>
            <Field label={dict.common.role}>
              {account.role === "SUPPLIER_ADMIN"
                ? dict.portal.team.roleAdmin
                : dict.portal.team.roleUser}
            </Field>
            <Field label={dict.nav.account}>
              {account.lastLoginAt ? formatRelative(account.lastLoginAt, locale) : "—"}
            </Field>
          </dl>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title={dict.account.changePassword}
          description={dict.account.changePasswordHint}
          action={<ChangePasswordButton dict={dict} />}
        />
      </Panel>
    </>
  );
}
