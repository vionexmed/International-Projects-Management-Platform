import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { WorkBlock } from "@/features/projects/work-block";
import { EmptyState } from "@/components/ui/empty-state";
import { CellStack, Table, TableScroll, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RegulatoryItemDialog } from "@/features/projects/regulatory-item-dialog";
import { StatusMenu, type StatusOption } from "@/components/app/status-menu";
import { updateRegulatoryItemAction } from "@/server/actions/stages";
import { orNotFound } from "@/server/authz/rsc";
import { StageDocumentList } from "@/features/projects/stage-document-list";
import { StageRequests } from "@/features/projects/stage-requests";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, meta } from "@/lib/labels";
import { formatDateShort, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ProjectRegulatoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  const project = await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [items, documents] = await Promise.all([
    db.task.findMany({
      // Mirror tasks of the requests above are the same pendency; listing
      // them again showed every request twice on this screen.
      where: { projectId, category: "REGULATORY", requests: { none: {} } },
      include: { assignedTo: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    db.document.findMany({
      where: { projectId, type: { in: ["REGULATORY", "CERTIFICATE", "IFU"] } },
      include: { currentVersion: true, createdBy: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const canManage = can(user, "regulatory:manage");
  const approved = items.filter((item) => item.status === "COMPLETED").length;
  // The authority most items answer to; a row repeats it only when it differs.
  const authority = items.find((item) => item.authority)?.authority ?? null;

  const statusOptions: StatusOption[] = OPTIONS.taskStatus.map((value) => ({
    value,
    ...meta.task(value, dict),
  }));

  return (
    <div className="space-y-6">
      <StageRequests
        user={user}
        projectId={projectId}
        supplierName={project.supplier.name}
        stage="REGULATORY"
        locale={locale}
        dict={dict}
      />

      {/*
        Regulatory checklist — real tasks (category REGULATORY) since Fase 3
        of the architecture-simplification plan. This is the same table
        `/tasks?category=REGULATORY` would show, filtered to this project,
        plus `authority`/`requestedFrom`: the two fields a task only carries
        for this category.
      */}
      <WorkBlock
        title="Itens regulatórios"
        count={items.length > 0 ? `${approved} de ${items.length} concluídos` : undefined}
        description={
          authority
            ? `Documentação exigida por ${authority}.`
            : "Documentação exigida pelo órgão regulatório."
        }
        action={
          canManage ? (
            <RegulatoryItemDialog projectId={projectId} supplierName={project.supplier.name} />
          ) : null
        }
      >
        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhum item regulatório cadastrado." compact />
        ) : (
          <TableScroll>
            <Table columnRules>
              <THead>
                <TR>
                  <TH className="min-w-64">Item</TH>
                  <TH className="w-px">Solicitado a</TH>
                  <TH className="w-px">Responsável</TH>
                  <TH className="w-px">Status</TH>
                  <TH className="w-px" align="right">Prazo</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => {
                  const remaining = daysUntil(item.dueDate);
                  const late =
                    remaining !== null &&
                    remaining < 0 &&
                    !["COMPLETED", "CANCELLED"].includes(item.status);

                  return (
                    <TR key={item.id}>
                      <TD>
                        <CellStack
                          title={
                            <Link href={`/tasks/${item.id}`} className="hover:underline">
                              {item.title}
                            </Link>
                          }
                          subtitle={item.authority !== authority ? item.authority : null}
                        />
                      </TD>
                      <TD label="Solicitado a">{item.requestedFrom}</TD>
                      <TD label="Responsável">{item.assignedTo?.name}</TD>
                      <TD label="Status">
                        <StatusMenu
                          action={updateRegulatoryItemAction}
                          hidden={{ projectId, itemId: item.id }}
                          name="status"
                          value={item.status}
                          options={statusOptions}
                          ariaLabel={`Status de ${item.title}`}
                          readOnly={!canManage}
                        />
                      </TD>
                      <TD label="Prazo" align="right" className={cn(late && "font-medium text-risk")}>
                        {item.dueDate ? formatDateShort(item.dueDate, locale) : "—"}
                        {late ? " · atrasado" : ""}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </WorkBlock>

      <WorkBlock
        title="Documentos regulatórios"
        count={documents.length || undefined}
        description="Regulatórios, certificados e instruções de uso."
        action={{ label: "Ver todos", href: `/projects/${projectId}/documents` }}
      >
        <StageDocumentList documents={documents} locale={locale} dict={dict} />
      </WorkBlock>
    </div>
  );
}
