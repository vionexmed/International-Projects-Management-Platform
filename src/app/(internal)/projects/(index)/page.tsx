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
import { StatusFilter } from "@/components/app/status-filter";
import { Pagination } from "@/components/app/pagination";
import { FilterBar, FilterSelect, SearchInput } from "@/components/app/search-filters";
import { UserAvatar } from "@/components/ui/avatar";
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
import { StageTrack } from "@/features/projects/stage-track";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { ProjectActionsMenu } from "@/features/projects/project-actions-menu";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/format";
import { initials, cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

export const metadata: Metadata = { title: "Projetos" };

/**
 * The status filter's options; `key` is the `tab` param value. `ARCHIVED`
 * asks the scope for the other half of the portfolio — kept in the same
 * menu because that is where somebody looks for a project they cannot find.
 */
const TABS: {
  key: string;
  label: string;
  status?: ProjectStatus;
  attention?: boolean;
  archived?: boolean;
  tone?: Tone;
}[] = [
  { key: "ALL", label: "Todos" },
  { key: "ATTENTION", label: "Precisam de atenção", attention: true, tone: "warn" },
  { key: "ON_TRACK", label: "Em dia", status: "ON_TRACK" },
  { key: "AT_RISK", label: "Em risco", status: "AT_RISK", tone: "warn" },
  { key: "BLOCKED", label: "Bloqueados", status: "BLOCKED", tone: "risk" },
  { key: "COMPLETED", label: "Concluídos", status: "COMPLETED" },
  { key: "ARCHIVED", label: "Arquivados", archived: true },
];

/** "em 45 dias", "12 dias de atraso": how far the launch is. */
function launchDistance(date: Date | null) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"} de atraso`, late: true };
  if (days === 0) return { text: "hoje", late: false };
  return { text: `em ${days} ${days === 1 ? "dia" : "dias"}`, late: false };
}

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

  return (
    <>
      <PageHeader
        title="Projetos"
        actions={
          can(user, "project:create") ? (
            <NewProjectDialog suppliers={suppliers} owners={owners} suggestedCode={suggestedCode} />
          ) : null
        }
      />

      {/*
        One toolbar row. The status used to be said three times — five KPI
        cards, seven tabs with the same counts, and the table — so it is now
        one filter, with each count inside its menu option. It writes the
        same `tab` param the tabs wrote.
      */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusFilter
          paramKey="tab"
          defaultValue="ALL"
          options={TABS.map((tab) => ({
            value: tab.key,
            label: tab.label,
            count: tab.archived || tab.attention ? undefined : tab.status ? counts[tab.status] : counts.ALL,
            tone: tab.tone,
          }))}
        />
        <SearchInput
          placeholder="Buscar projetos…"
          className="min-w-0 max-sm:order-first max-sm:basis-full sm:w-60"
        />
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
                    {/* Shares, not "name takes the slack": the columns spread evenly across the row. */}
                    <TH className="w-[30%] min-w-60">Projeto</TH>
                    <TH className="w-[34%] min-w-64">Etapas</TH>
                    <TH className="w-[16%]">Responsável</TH>
                    <TH className="w-[16%]" align="right">Lançamento</TH>
                    <TH className="w-8 max-md:hidden" />
                    {activeTab.archived && canArchive ? <TH className="w-px" /> : null}
                  </TR>
                </THead>
                <TBody>
                  {result.items.map((project) => {
                    const launch = launchDistance(project.targetLaunchDate);
                    return (
                      <TR key={project.id} interactive className="group">
                        <TD>
                          <Link
                            href={`/projects/${project.id}`}
                            className="flex items-center gap-2.5 after:absolute after:inset-0 after:content-['']"
                          >
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-raised text-[11px] font-semibold text-ink-soft"
                              aria-hidden
                            >
                              {initials(project.name)}
                            </span>
                            <CellStack
                              title={project.name}
                              subtitle={`${project.projectCode} · ${project.supplier.name}`}
                            />
                          </Link>
                        </TD>
                        <TD label="Etapas">
                          <StageTrack
                            projectId={project.id}
                            stages={project.stages}
                            current={project.currentStage}
                            progress={project.progress}
                            dict={dict}
                          />
                        </TD>
                        <TD label="Responsável">
                          <span className="inline-flex max-w-full items-center gap-2">
                            <UserAvatar name={project.owner.name} size="xs" />
                            <span className="truncate text-ink-soft">{project.owner.name}</span>
                          </span>
                        </TD>
                        <TD label="Lançamento" align="right">
                          {project.targetLaunchDate ? (
                            <CellStack
                              title={<span className="font-normal text-ink-soft">{formatDate(project.targetLaunchDate, locale)}</span>}
                              subtitle={
                                launch ? <span className={cn(launch.late && "font-medium text-risk")}>{launch.text}</span> : null
                              }
                            />
                          ) : (
                            <span className="text-faint">Sem data</span>
                          )}
                        </TD>
                        <TD className="w-8 pl-0 text-right max-md:hidden" aria-hidden>
                          <ChevronRight className="inline size-4 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                        </TD>
                        {activeTab.archived && canArchive ? (
                          <TD className="text-right max-md:hidden">
                            <span className="relative z-10 inline-flex">
                              <ProjectActionsMenu projectId={project.id} archived canArchive />
                            </span>
                          </TD>
                        ) : null}
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
