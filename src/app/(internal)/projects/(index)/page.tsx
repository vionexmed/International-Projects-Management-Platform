import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FolderKanban } from "lucide-react";
import type { StageKey } from "@/generated/prisma";
import { requireInternalUser, can } from "@/server/auth/current-user";
import {
  countProjectsByStatus,
  listProjectCountries,
  listProjects,
  type ProjectStatus,
} from "@/server/services/projects";
import { listSupplierOptions } from "@/server/services/suppliers";
import { listInternalUserOptions } from "@/server/services/users";
import { PageHeader } from "@/components/app/page-header";
import { TabsNav } from "@/components/app/tabs-nav";
import { Pagination } from "@/components/app/pagination";
import { FilterBar, FilterSelect, SearchInput } from "@/components/app/search-filters";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
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
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { ProjectActionsMenu } from "@/features/projects/project-actions-menu";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Projetos" };

/**
 * `ARCHIVED` is a different list, not another status filter: it asks the scope
 * for the other half of the portfolio. Kept as a tab because that is where
 * somebody looks for a project they cannot find.
 */
const TABS: {
  key: string;
  label: string;
  status?: ProjectStatus;
  attention?: boolean;
  archived?: boolean;
}[] = [
  { key: "ALL", label: "Todos" },
  { key: "ATTENTION", label: "Precisam de atenção", attention: true },
  { key: "ON_TRACK", label: "Em dia", status: "ON_TRACK" },
  { key: "AT_RISK", label: "Em risco", status: "AT_RISK" },
  { key: "BLOCKED", label: "Bloqueados", status: "BLOCKED" },
  { key: "COMPLETED", label: "Concluídos", status: "COMPLETED" },
  { key: "ARCHIVED", label: "Arquivados", archived: true },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const activeTab = TABS.find((tab) => tab.key === params.tab) ?? TABS[0];
  const canArchive = can(user, "project:archive");
  const page = Number(params.page ?? 1) || 1;

  const [result, counts, suppliers, owners, countries] = await Promise.all([
    listProjects(user, {
      query: params.q,
      status: activeTab.status,
      attention: activeTab.attention,
      supplierId: params.supplier,
      ownerId: params.owner,
      stage: params.stage as StageKey | undefined,
      country: params.country,
      archived: activeTab.archived,
      page,
    }),
    countProjectsByStatus(user),
    listSupplierOptions(user),
    listInternalUserOptions(user),
    listProjectCountries(user),
  ]);

  const activeFilters = ["supplier", "owner", "stage", "country"].filter((key) => params[key]).length;
  const suggestedCode = `VX-${String(counts.ALL + 1).padStart(3, "0")}`;

  const buildTabHref = (key: string) => {
    const next = new URLSearchParams();
    for (const [param, value] of Object.entries(params)) {
      if (value && param !== "tab" && param !== "page") next.set(param, value);
    }
    if (key !== "ALL") next.set("tab", key);
    const query = next.toString();
    return query ? `/projects?${query}` : "/projects";
  };

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Gerencie e acompanhe todos os projetos do portfólio."
        actions={
          can(user, "project:create") ? (
            <NewProjectDialog suppliers={suppliers} owners={owners} suggestedCode={suggestedCode} />
          ) : null
        }
      />

      <TabsNav
        className="mb-5"
        items={TABS.map((tab) => ({
          href: buildTabHref(tab.key),
          label: tab.label,
          count: tab.archived || tab.attention ? undefined : tab.status ? counts[tab.status] : counts.ALL,
          active: tab.key === activeTab.key,
        }))}
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <SearchInput placeholder="Buscar projetos…" className="w-full sm:w-80" />
        <FilterBar activeCount={activeFilters}>
          <FilterSelect
            paramKey="supplier"
            label="Fornecedor"
            options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
          />
          <FilterSelect
            paramKey="owner"
            label="Responsável"
            options={owners.map((owner) => ({ value: owner.id, label: owner.name }))}
          />
          <FilterSelect
            paramKey="stage"
            label="Etapa"
            options={OPTIONS.stageKey.map((stage) => ({
              value: stage,
              label: label.stageKey(stage, dict),
            }))}
          />
          <FilterSelect
            paramKey="country"
            label="País"
            options={countries.map((country) => ({ value: country, label: country }))}
          />
        </FilterBar>
      </div>

      <TableShell>
        {result.items.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={params.q || activeFilters > 0 ? "Nenhum projeto encontrado." : "Nenhum projeto ainda."}
            description={
              params.q || activeFilters > 0
                ? "Ajuste a busca ou os filtros para ver outros resultados."
                : "Crie o primeiro projeto para começar a acompanhar o portfólio."
            }
          />
        ) : (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Projeto</TH>
                    <TH>Fornecedor</TH>
                    <TH>Etapa</TH>
                    <TH>Responsável</TH>
                    <TH>Status</TH>
                    <TH className="w-40">Progresso</TH>
                    <TH>Lançamento</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {result.items.map((project) => {
                    const status = meta.project(project.status, dict);
                    return (
                      <TR key={project.id} interactive>
                        <TD>
                          <Link
                            href={`/projects/${project.id}`}
                            className="block after:absolute after:inset-0 after:content-['']"
                          >
                            <CellStack title={project.name} subtitle={project.projectCode} />
                          </Link>
                        </TD>
                        <TD label="Fornecedor" className="text-[13px] text-ink-soft">
                          <CellStack
                            title={<span className="font-normal">{project.supplier.name}</span>}
                            subtitle={project.supplier.country}
                          />
                        </TD>
                        <TD label="Etapa" className="text-[13px] text-ink-soft">
                          {label.stageKey(project.currentStage, dict)}
                        </TD>
                        <TD label="Responsável" className="text-[13px] text-ink-soft">{project.owner.name}</TD>
                        <TD label="Status">
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </TD>
                        <TD label="Progresso">
                          <div className="w-32">
                            <div className="mb-1 text-[13px] font-semibold text-ink tabular-nums">
                              {project.progress}%
                            </div>
                            <ProgressBar value={project.progress} />
                          </div>
                        </TD>
                        <TD label="Lançamento" className="text-[13px] whitespace-nowrap text-ink-soft">
                          {formatDate(project.targetLaunchDate, locale)}
                        </TD>
                        <TD className="text-right max-md:hidden">
                          {activeTab.archived && canArchive ? (
                            <span className="relative z-10 inline-flex">
                              <ProjectActionsMenu
                                projectId={project.id}
                                archived
                                canArchive
                              />
                            </span>
                          ) : (
                            <ChevronRight className="inline size-4 text-faint" />
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>

            <TableFooter>
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                total={result.total}
                perPage={result.perPage}
                searchParams={params}
                label="projetos"
              />
            </TableFooter>
          </>
        )}
      </TableShell>
    </>
  );
}
