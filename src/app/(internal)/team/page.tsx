import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { listTeam } from "@/server/services/users";
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
import { EditMemberDialog } from "@/features/team/edit-member-dialog";
import { InviteMemberDialog } from "@/features/team/invite-member-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label } from "@/lib/labels";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage() {
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const members = await listTeam(user);
  const manageable = can(user, "user:manage");

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Membros da equipe Vionex e sua carga de trabalho atual."
        actions={manageable ? <InviteMemberDialog /> : null}
      />

      <TableShell>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum membro cadastrado." />
        ) : (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Nome</TH>
                    <TH>Papel</TH>
                    <TH>Departamento</TH>
                    <TH>Projetos</TH>
                    <TH>Tarefas abertas</TH>
                    <TH>Último acesso</TH>
                    <TH>Status</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {members.map((member) => (
                    <TR key={member.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={member.name} size="sm" />
                          <CellStack title={member.name} subtitle={member.email} />
                        </div>
                      </TD>
                      <TD label="Papel" className="text-[13px] text-ink-soft">{label.role(member.role, dict)}</TD>
                      <TD label="Departamento" className="text-[13px] text-ink-soft">{member.department ?? "—"}</TD>
                      <TD label="Projetos" className="text-[13px] text-ink-soft tabular-nums">{member.projectCount}</TD>
                      <TD label="Tarefas abertas" className="text-[13px] text-ink-soft tabular-nums">{member.openTaskCount}</TD>
                      <TD label="Último acesso" className="text-[13px] text-ink-soft">
                        {member.lastLoginAt ? formatRelative(member.lastLoginAt, locale) : "—"}
                      </TD>
                      <TD label="Status">
                        <StatusBadge tone={member.status === "ACTIVE" ? "ok" : "neutral"}>
                          {dict.enums.userStatus[member.status]}
                        </StatusBadge>
                      </TD>
                      <TD className="text-right">
                        {manageable ? (
                          <EditMemberDialog
                            member={{
                              id: member.id,
                              name: member.name,
                              role: member.role,
                              jobTitle: member.jobTitle ?? null,
                              department: member.department ?? null,
                              status: member.status,
                            }}
                          />
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
            <TableFooter>
              <span>
                {members.length} membro{members.length === 1 ? "" : "s"}
              </span>
            </TableFooter>
          </>
        )}
      </TableShell>
    </>
  );
}
