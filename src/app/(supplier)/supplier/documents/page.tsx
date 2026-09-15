import type { Metadata } from "next";
import type { DocumentType } from "@/generated/prisma";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listDocuments } from "@/server/services/documents";
import { listProjects } from "@/server/services/projects";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/app/search-filters";
import { TableFooter, TableShell } from "@/components/ui/table";
import { Pagination } from "@/components/app/pagination";
import { SupplierDocumentsTable } from "@/features/supplier-portal/supplier-documents-table";
import { SupplierUploadDialog } from "@/features/supplier-portal/upload-document-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label } from "@/lib/labels";
import { ACCEPT_ATTRIBUTE, maxUploadMb } from "@/lib/upload";

export const metadata: Metadata = { title: "Documents" };

export default async function SupplierDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [result, projects] = await Promise.all([
    listDocuments(user, {
      query: params.q,
      projectId: params.project,
      type: params.type as DocumentType | undefined,
      // Paged rather than capped: a cap with no pager silently hides the rest,
      // and a supplier who cannot find a file they sent has no way to tell
      // whether it is missing or merely beyond an invisible limit.
      page: Number(params.page ?? 1) || 1,
      perPage: 25,
    }),
    listProjects(user, { perPage: 100 }),
  ]);

  const activeFilters = ["project", "type"].filter((key) => params[key]).length;

  return (
    <>
      <PageHeader
        title={dict.portal.documents.title}
        description={dict.portal.documents.subtitle}
        actions={
          <SupplierUploadDialog
            projects={projects.items.map((project) => ({ id: project.id, name: project.name }))}
            dict={dict}
            accept={ACCEPT_ATTRIBUTE}
            maxSizeMb={maxUploadMb()}
          />
        }
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <SearchInput placeholder={dict.common.search} className="w-full sm:w-[320px]" />
        <FilterBar activeCount={activeFilters}>
          <FilterSelect
            paramKey="project"
            label={dict.common.project}
            options={projects.items.map((project) => ({ value: project.id, label: project.name }))}
          />
          <FilterSelect
            paramKey="type"
            label={dict.common.type}
            options={OPTIONS.documentType.map((type) => ({
              value: type,
              label: label.documentType(type, dict),
            }))}
          />
        </FilterBar>
      </div>

      <TableShell>
        <SupplierDocumentsTable
          documents={result.items}
          locale={locale}
          dict={dict}
          emptyTitle={
            params.q || activeFilters > 0 ? dict.common.noResults : dict.portal.documents.empty
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
              label={dict.portal.documents.title.toLowerCase()}
            />
          </TableFooter>
        ) : null}
      </TableShell>
    </>
  );
}
