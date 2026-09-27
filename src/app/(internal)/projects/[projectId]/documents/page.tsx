import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listDocuments } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { DocumentsTable } from "@/features/documents/documents-table";
import { UploadDocumentDialog } from "@/features/documents/upload-document-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { ACCEPT_ATTRIBUTE, maxUploadMb } from "@/lib/upload";
import { OPTIONS, oneOf } from "@/lib/labels";

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { projectId } = await params;
  const { type } = await searchParams;
  const user = await requireInternalUser();
  await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const result = await listDocuments(user, {
    projectId,
    type: oneOf(type, OPTIONS.documentType),
    perPage: 100,
  });

  return (
    <Panel>
      <PanelHeader
        title="Documentos"
        count={result.total}
        action={
          can(user, "document:upload") ? (
            <UploadDocumentDialog
              projectId={projectId}
              accept={ACCEPT_ATTRIBUTE}
              maxSizeMb={maxUploadMb()}
            />
          ) : null
        }
      />
      <DocumentsTable
        documents={result.items}
        locale={locale}
        dict={dict}
        showProject={false}
        emptyTitle="Nenhum documento neste projeto."
        emptyDescription="Envie o primeiro documento ou solicite um ao fornecedor."
      />
    </Panel>
  );
}
