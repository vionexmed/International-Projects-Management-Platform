import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { can, requireSupplierUser } from "@/server/auth/current-user";
import { listPortalUsers } from "@/server/services/users";
import { PageHeader } from "@/components/app/page-header";
import { UserAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableFooter,
  TableScroll,
  TableShell,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import {
  AddPortalUserDialog,
  EditPortalUserDialog,
} from "@/features/supplier-portal/portal-user-dialogs";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "Users" };

/**
 * A supplier company managing its own accounts.
 *
 * The capability has existed since the role matrix was written and the only
 * screen that exercised it was inside the Vionex environment, which a supplier
 * cannot open. So a supplier administrator held a permission they could not
 * use, and adding a colleague meant asking Vionex to do it.
 *
 * `notFound()` for anyone without the capability: a plain portal user should
 * not learn that the page exists, and the actions refuse them regardless.
 */
export default async function SupplierUsersPage() {
  const user = await requireSupplierUser();
  if (!can(user, "portal:manage-users")) notFound();

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const users = await listPortalUsers(user);

  return (
    <>
      <PageHeader
        title={dict.portal.team.title}
        description={dict.portal.team.subtitle}
        actions={<AddPortalUserDialog dict={dict} />}
      />

      <TableShell>
        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={dict.portal.team.empty}
            description={dict.portal.team.emptyDescription}
          />
        ) : (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>{dict.common.name}</TH>
                    <TH>{dict.common.role}</TH>
                    <TH>{dict.common.jobTitle}</TH>
                    <TH>{dict.common.status}</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {users.map((member) => (
                    <TR key={member.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={member.name} size="sm" tone="brand" />
                          <CellStack title={member.name} subtitle={member.email} />
                        </div>
                      </TD>
                      <TD label={dict.common.role} className="text-[13px] text-ink-soft">
                        {member.role === "SUPPLIER_ADMIN"
                          ? dict.portal.team.roleAdmin
                          : dict.portal.team.roleUser}
                      </TD>
                      <TD label={dict.common.jobTitle} className="text-[13px] text-ink-soft">
                        {member.jobTitle ?? "—"}
                      </TD>
                      <TD label={dict.common.status}>
                        <StatusBadge tone={member.status === "ACTIVE" ? "ok" : "neutral"}>
                          {dict.enums.userStatus[member.status]}
                        </StatusBadge>
                      </TD>
                      <TD className="text-right">
                        <EditPortalUserDialog
                          dict={dict}
                          user={{
                            id: member.id,
                            name: member.name,
                            role: member.role,
                            jobTitle: member.jobTitle,
                            status: member.status,
                          }}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
            <TableFooter>
              <span>{users.length}</span>
            </TableFooter>
          </>
        )}
      </TableShell>
    </>
  );
}
