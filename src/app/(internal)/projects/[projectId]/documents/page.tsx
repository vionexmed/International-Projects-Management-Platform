import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listDocuments } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { DocumentsTable } from "@/features/documents/documents-table";
import { UploadDocumentDialog } from "@/features/documents/upload-document-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_MB } from "@/lib/upload";

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const result = await listDocuments(user, { projectId, perPage: 100 });

  return (
    <Panel>
      <PanelHeader
        title="Documentos"
        description={`${result.total} documento(s) vinculado(s) a este projeto.`}
        action={
          can(user, "document:upload") ? (
            <UploadDocumentDialog
              projectId={projectId}
              accept={ACCEPT_ATTRIBUTE}
              maxSizeMb={MAX_UPLOAD_MB}
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
