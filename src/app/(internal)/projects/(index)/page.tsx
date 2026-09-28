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
import { StatusIcon, type StatusIconKind } from "@/components/ui/badge";
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
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta } from "@/lib/labels";
import { formatDate, daysUntil } from "@/lib/format";
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

/** Shape, not colour, carries the state — `tone` from `meta.project` supplies the colour. */
const STATUS_ICON: Record<ProjectStatus, StatusIconKind> = {
  ON_TRACK: "in-progress",
  AT_RISK: "waiting",
  BLOCKED: "blocked",
  COMPLETED: "done",
};

/** Mirrors `badge.tsx`'s private text-tone table so the label beside the icon reads the same. */
const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ink-soft",
  warn: "text-warn",
  risk: "text-risk",
  info: "text-info",
  neutral: "text-muted",
};

const STAGE_TONE: Record<ProjectStageSummary["status"], string> = {
  NOT_STARTED: "bg-line-soft",
  IN_PROGRESS: "bg-brand",
  COMPLETED: "bg-ok-dot",
  BLOCKED: "bg-risk-dot",
};

/** The row's "Etapas" cell: four small segments, one per stage, coloured by its own progress. */
function StageStrip({ stages, dict }: { stages: ProjectStageSummary[]; dict: Dictionary }) {
  return (
    <span className="inline-flex items-center gap-1">
      {stages.map((stage) => (
        <span
          key={stage.key}
          title={`${label.stageKey(stage.key, dict)} · ${stage.progress}%`}
          className={cn("h-1.5 w-4 shrink-0 rounded-full", STAGE_TONE[stage.status])}
        />
      ))}
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

      <TableShell variant="flush">
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
                    <TH className="min-w-64">Nome</TH>
                    <TH className="w-px">Status</TH>
                    <TH className="w-px">Etapa atual</TH>
                    <TH className="w-px">Progresso</TH>
                    <TH className="w-px">Etapas</TH>
                    <TH className="w-px" align="right">Lançamento</TH>
                    <TH className="w-px">Saúde</TH>
                    {activeTab.archived && canArchive ? <TH className="w-px" /> : null}
                  </TR>
                </THead>
                <TBody>
                  {result.items.map((project) => {
                    const status = meta.project(project.status, dict);
                    const remaining = daysUntil(project.nextMilestone?.dueDate ?? null);
                    const milestoneLate = project.nextMilestone !== null && remaining !== null && remaining < 0;

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
                        <TD label="Status">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <StatusIcon kind={STATUS_ICON[project.status]} tone={status.tone} />
                            <span className={cn(status.tone !== "neutral" && TONE_TEXT[status.tone])}>
                              {status.label}
                            </span>
                          </span>
                        </TD>
                        <TD label="Etapa atual">
                          <span className="inline-flex items-center rounded-xs bg-brand-soft px-2 py-1 text-xs font-medium whitespace-nowrap text-brand-deep">
                            {label.stageKey(project.currentStage, dict)}
                          </span>
                        </TD>
                        <TD label="Progresso">
                          {/* Number beside the bar, not above it: one line, like every other cell. */}
                          <div className="flex w-36 items-center gap-2.5 max-md:w-full">
                            <ProgressBar value={project.progress} label={`Progresso de ${project.name}`} />
                            <span className="w-9 shrink-0 text-right text-meta font-medium text-ink tabular-nums">
                              {project.progress}%
                            </span>
                          </div>
                        </TD>
                        <TD label="Etapas">
                          <StageStrip stages={project.stages} dict={dict} />
                        </TD>
                        <TD label="Lançamento" align="right">
                          {formatDate(project.targetLaunchDate, locale)}
                        </TD>
                        <TD label="Saúde">
                          {milestoneLate ? (
                            <span className="font-medium whitespace-nowrap text-risk">
                              marco atrasado · {Math.abs(remaining ?? 0)}d
                            </span>
                          ) : project.status === "AT_RISK" ? (
                            <span className="font-medium whitespace-nowrap text-warn">em risco</span>
                          ) : project.status === "BLOCKED" ? (
                            <span className="font-medium whitespace-nowrap text-risk">bloqueado</span>
                          ) : null}
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
