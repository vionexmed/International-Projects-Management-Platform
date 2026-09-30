import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import type { StageKey } from "@/generated/prisma";
import { requireInternalUser, can } from "@/server/auth/current-user";
import {
  countProjectsByStatus,
  listProjectCountries,
  listProjects,
  type ProjectStageSummary,
  type ProjectStatus,
} from "@/server/services/projects";
import { listSupplierOptions } from "@/server/services/suppliers";
import { listInternalUserOptions } from "@/server/services/users";
import { PageHeader } from "@/components/app/page-header";
import { StatusFilter } from "@/components/app/status-filter";
import { Pagination } from "@/components/app/pagination";
import { FilterBar, FilterSelect, SearchInput } from "@/components/app/search-filters";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { stageSegment } from "@/features/projects/stage-routes";
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
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta, type StageProgress } from "@/lib/labels";
import { formatDate } from "@/lib/format";
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

const STAGE_TONE: Record<ProjectStageSummary["status"], string> = {
  NOT_STARTED: "bg-line-soft",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-ok-dot",
  BLOCKED: "bg-risk-dot",
};

/**
 * The row's "Etapas" cell: one segment per stage, coloured by its status.
 * Hovering (or focusing) a segment names the stage and how it stands; the
 * current stage is the wider one, and each segment opens its stage page.
 */
function StageStrip({
  projectId,
  stages,
  current,
  dict,
}: {
  projectId: string;
  stages: ProjectStageSummary[];
  current: StageKey;
  dict: Dictionary;
}) {
  return (
    <span className="relative z-10 inline-flex items-center gap-1">
      {stages.map((stage) => {
        const name = label.stageKey(stage.key, dict);
        const status = meta.stage(stage.status as StageProgress, dict).label;
        const isCurrent = stage.key === current;
        return (
          <Tooltip
            key={stage.key}
            content={
              <span className="block text-left">
                <span className="block font-semibold">{name}{isCurrent ? " · etapa atual" : ""}</span>
                <span className="block font-normal opacity-80">{status} · {stage.progress}%</span>
              </span>
            }
          >
            <Link
              href={`/projects/${projectId}/${stageSegment(stage.key)}`}
              aria-label={`${name}: ${status}, ${stage.progress}%${isCurrent ? " (etapa atual)" : ""}`}
              className="group/segment flex h-6 items-center rounded-sm px-0.5 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-transform group-hover/segment:scale-y-150",
                  isCurrent ? "w-7" : "w-4",
                  STAGE_TONE[stage.status],
                )}
              />
            </Link>
          </Tooltip>
        );
      })}
    </span>
  );
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
                    <TH className="w-[30%] min-w-60">Nome</TH>
                    <TH className="w-[20%]">Etapa atual</TH>
                    <TH className="w-[20%]">Progresso</TH>
                    <TH className="w-[14%]">Etapas</TH>
                    <TH className="w-[16%]" align="right">Lançamento</TH>
                    {activeTab.archived && canArchive ? <TH className="w-px" /> : null}
                  </TR>
                </THead>
                <TBody>
                  {result.items.map((project) => {

                    return (
                      <TR key={project.id} interactive>
                        <TD>
                          <Link
                            href={`/projects/${project.id}`}
                            className="flex items-center gap-2.5 after:absolute after:inset-0 after:content-['']"
                          >
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-brand-soft text-[10px] font-semibold text-brand-deep"
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
                        <TD label="Etapa atual">
                          <span className="inline-flex items-center rounded-xs bg-brand-soft px-2 py-1 text-xs font-medium whitespace-nowrap text-brand-deep">
                            {label.stageKey(project.currentStage, dict)}
                          </span>
                        </TD>
                        <TD label="Progresso">
                          {/* Number beside the bar, not above it: one line, like every other cell. */}
                          <div className="flex w-full max-w-52 items-center gap-2.5">
                            <ProgressBar value={project.progress} label={`Progresso de ${project.name}`} />
                            <span className="w-9 shrink-0 text-right text-meta font-medium text-ink tabular-nums">
                              {project.progress}%
                            </span>
                          </div>
                        </TD>
                        <TD label="Etapas">
                          <StageStrip projectId={project.id} stages={project.stages} current={project.currentStage} dict={dict} />
                        </TD>
                        <TD label="Lançamento" align="right">
                          {formatDate(project.targetLaunchDate, locale)}
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
