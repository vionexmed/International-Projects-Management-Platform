import { requireSupplierUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listDocuments } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { SupplierDocumentsTable } from "@/features/supplier-portal/supplier-documents-table";
import { SupplierUploadDialog } from "@/features/supplier-portal/upload-document-dialog";
import { ACCEPT_ATTRIBUTE, maxUploadMb } from "@/lib/upload";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

export default async function SupplierProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSupplierUser();
  await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const result = await listDocuments(user, { projectId, perPage: 100 });

  return (
    <Panel>
      <PanelHeader
        title={dict.portal.documents.title}
        description={dict.portal.documents.subtitle}
        action={
          <SupplierUploadDialog
            projectId={projectId}
            dict={dict}
            accept={ACCEPT_ATTRIBUTE}
            maxSizeMb={maxUploadMb()}
          />
        }
      />
      <SupplierDocumentsTable
        documents={result.items}
        locale={locale}
        dict={dict}
        showProject={false}
        emptyTitle={dict.portal.documents.empty}
      />
    </Panel>
  );
}
