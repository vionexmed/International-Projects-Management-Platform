import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FolderKanban } from "lucide-react";
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
import { UserAvatar } from "@/components/ui/avatar";
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

/** The fill of a stage segment: done is green, held up is red, work under way is the brand. */
const STAGE_FILL: Record<ProjectStageSummary["status"], string> = {
  NOT_STARTED: "bg-brand",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-ok-dot",
  BLOCKED: "bg-risk-dot",
};

/**
 * The row's "Etapas" cell: the four stages stretched across the column, each
 * filled as far as it has gone, with the current stage and the project's
 * overall progress under it. Hovering (or focusing) a segment names that
 * stage and how it stands; each segment opens its stage page.
 */
function StageTrack({
  projectId,
  stages,
  current,
  progress,
  dict,
}: {
  projectId: string;
  stages: ProjectStageSummary[];
  current: StageKey;
  progress: number;
  dict: Dictionary;
}) {
  const index = stages.findIndex((stage) => stage.key === current);
  return (
    <div className="min-w-0">
      <span className="relative z-10 flex items-center gap-1">
        {stages.map((stage) => {
          const name = label.stageKey(stage.key, dict);
          const status = meta.stage(stage.status as StageProgress, dict).label;
          const isCurrent = stage.key === current;
          const fill = stage.status === "COMPLETED" ? 100 : Math.max(0, Math.min(100, stage.progress));
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
                className="group/segment flex h-5 min-w-0 flex-1 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line-soft transition-[height] group-hover/segment:h-2">
                  <span className={cn("block h-full rounded-full", STAGE_FILL[stage.status])} style={{ width: `${fill}%` }} />
                </span>
              </Link>
            </Tooltip>
          );
        })}
      </span>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-meta">
        <span className="min-w-0 truncate">
          <span className="font-medium text-ink">{label.stageKey(current, dict)}</span>
          {index >= 0 ? <span className="text-muted"> · etapa {index + 1} de {stages.length}</span> : null}
        </span>
        <span className="shrink-0 font-medium text-ink tabular-nums">{progress}%</span>
      </div>
    </div>
  );
}

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
