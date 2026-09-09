import type { Metadata } from "next";
import type { DocumentStatus, DocumentType } from "@/generated/prisma";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { listDocuments } from "@/server/services/documents";
import { listProjects } from "@/server/services/projects";
import { listSupplierOptions } from "@/server/services/suppliers";
import { listInternalUserOptions } from "@/server/services/users";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { FilterBar, FilterSelect, SearchInput } from "@/components/app/search-filters";
import { TableFooter, TableShell } from "@/components/ui/table";
import { DocumentsTable } from "@/features/documents/documents-table";
import { UploadDocumentDialog } from "@/features/documents/upload-document-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label } from "@/lib/labels";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_MB } from "@/lib/upload";

export const metadata: Metadata = { title: "Documentos" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const page = Number(params.page ?? 1) || 1;

  const [result, projects, suppliers, uploaders] = await Promise.all([
    listDocuments(user, {
      query: params.q,
      projectId: params.project,
      supplierId: params.supplier,
      type: params.type as DocumentType | undefined,
      status: params.status as DocumentStatus | undefined,
      uploadedById: params.uploader,
      page,
    }),
    listProjects(user, { perPage: 100 }),
    listSupplierOptions(user),
    listInternalUserOptions(user),
  ]);

  const activeFilters = ["project", "supplier", "type", "status", "uploader"].filter(
    (key) => params[key],
  ).length;

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Todos os documentos vinculados aos projetos do portfólio."
        actions={
          can(user, "document:upload") ? (
            <UploadDocumentDialog
              projects={projects.items.map((project) => ({ id: project.id, name: project.name }))}
              accept={ACCEPT_ATTRIBUTE}
              maxSizeMb={MAX_UPLOAD_MB}
            />
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <SearchInput placeholder="Buscar documentos…" className="w-full sm:w-80" />
        <FilterBar activeCount={activeFilters}>
          <FilterSelect
            paramKey="project"
            label="Projeto"
            options={projects.items.map((project) => ({ value: project.id, label: project.name }))}
          />
          <FilterSelect
            paramKey="supplier"
            label="Fornecedor"
            options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
          />
          <FilterSelect
            paramKey="type"
            label="Tipo"
            options={OPTIONS.documentType.map((type) => ({
              value: type,
              label: label.documentType(type, dict),
            }))}
          />
          <FilterSelect
            paramKey="status"
            label="Status"
            options={OPTIONS.documentStatus.map((status) => ({
              value: status,
              label: dict.status.document[status],
            }))}
          />
          <FilterSelect
            paramKey="uploader"
            label="Enviado por"
            options={uploaders.map((uploader) => ({ value: uploader.id, label: uploader.name }))}
          />
        </FilterBar>
      </div>

      <TableShell>
        <DocumentsTable
          documents={result.items}
          locale={locale}
          dict={dict}
          emptyTitle={
            params.q || activeFilters > 0 ? "Nenhum documento encontrado." : "Nenhum documento ainda."
          }
          emptyDescription={
            params.q || activeFilters > 0
              ? "Ajuste a busca ou os filtros para ver outros resultados."
              : "Envie o primeiro documento ou solicite um ao fornecedor."
          }
        />
        {result.items.length > 0 ? (
          <TableFooter>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              perPage={result.perPage}
              searchParams={params}
              label="documentos"
            />
          </TableFooter>
        ) : null}
      </TableShell>
    </>
  );
}
