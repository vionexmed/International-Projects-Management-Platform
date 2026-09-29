import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listDocuments } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { ViewToolbar } from "@/components/app/view-toolbar";
import { DocumentsTable } from "@/features/documents/documents-table";
import { UploadDocumentDialog } from "@/features/documents/upload-document-dialog";
import { PROJECT_FLUSH } from "@/features/projects/project-frame";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { ACCEPT_ATTRIBUTE, maxUploadMb } from "@/lib/upload";
import { OPTIONS, label, oneOf } from "@/lib/labels";

/** The project's files as a flush grid under a 48-px toolbar (type filter left, upload right). */
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
  const selected = oneOf(type, OPTIONS.documentType);
  const result = await listDocuments(user, { projectId, type: selected, perPage: 100 });

  const base = `/projects/${projectId}/documents`;

  return (
    <div className={PROJECT_FLUSH}>
      <ViewToolbar
        className="px-4 sm:px-6"
        left={
          <>
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-2 px-2" trailingIcon={<ChevronDown />}>
                  <span className="text-muted">Tipo:</span>
                  <span className="text-ink">
                    {selected ? label.documentType(selected, dict) : "Todos os documentos"}
                  </span>
                </Button>
              </DropdownTrigger>
              <DropdownContent align="start" className="scroll-slim max-h-80 overflow-y-auto">
                {[undefined, ...OPTIONS.documentType].map((option) => (
                  <DropdownItem key={option ?? "all"} asChild>
                    <Link href={option ? `${base}?type=${option}` : base} scroll={false}>
                      <span className="flex-1">
                        {option ? label.documentType(option, dict) : "Todos os documentos"}
                      </span>
                      {option === selected ? <Check /> : null}
                    </Link>
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
            <span className="text-meta text-faint tabular-nums">{result.total}</span>
          </>
        }
        right={
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
    </div>
  );
}
