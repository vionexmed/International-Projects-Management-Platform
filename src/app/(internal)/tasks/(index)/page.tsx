import type { Metadata } from "next";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { countTasksByStatus, listTasks, type TaskStatus } from "@/server/services/tasks";
import { listProjects } from "@/server/services/projects";
import { listInternalUserOptions } from "@/server/services/users";
import { listSupplierOptions } from "@/server/services/suppliers";
import { PageHeader } from "@/components/app/page-header";
import { StatusFilter } from "@/components/app/status-filter";
import { Pagination } from "@/components/app/pagination";
import { FilterBar, FilterSelect, SearchInput } from "@/components/app/search-filters";
import { TableFooter, TableShell } from "@/components/ui/table";
import { TasksTable } from "@/features/tasks/tasks-table";
import { NewTaskDialog, TASK_CATEGORIES, TASK_PRIORITIES } from "@/features/tasks/new-task-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, oneOf } from "@/lib/labels";

export const metadata: Metadata = { title: "Tarefas" };

const TABS: { key: string; label: string; status?: TaskStatus | "OVERDUE" }[] = [
  { key: "ALL", label: "Todas" },
  { key: "OPEN", label: "Abertas", status: "OPEN" },
  { key: "IN_PROGRESS", label: "Em andamento", status: "IN_PROGRESS" },
  { key: "WAITING", label: "Aguardando", status: "WAITING" },
  { key: "OVERDUE", label: "Atrasadas", status: "OVERDUE" },
  { key: "COMPLETED", label: "Concluídas", status: "COMPLETED" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const activeTab = TABS.find((tab) => tab.key === params.tab) ?? TABS[0];
  const page = Number(params.page ?? 1) || 1;

  const [result, counts, projects, owners, suppliers] = await Promise.all([
    listTasks(user, {
      query: params.q,
      status: activeTab.status,
      projectId: params.project,
      assignedToId: params.assignee,
      supplierId: params.waiting,
      category: oneOf(params.category, OPTIONS.taskCategory),
      priority: oneOf(params.priority, OPTIONS.priority),
      page,
    }),
    countTasksByStatus(user),
    listProjects(user, { perPage: 100 }),
    listInternalUserOptions(user),
    listSupplierOptions(user),
  ]);

  const activeFilters = ["project", "assignee", "waiting", "category", "priority"].filter(
    (key) => params[key],
  ).length;

  return (
    <>
      <PageHeader
        title="Tarefas"
        actions={
          can(user, "task:create") ? (
            <NewTaskDialog
              projects={projects.items.map((project) => ({
                id: project.id,
                name: project.name,
                projectCode: project.projectCode,
                supplier: { id: project.supplier.id, name: project.supplier.name },
              }))}
              owners={owners}
            />
          ) : null
        }
      />

      {/* Same toolbar as `/projects`: one row — status, search, the rest of the filters. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusFilter
          paramKey="tab"
          defaultValue="ALL"
          options={TABS.map((tab) => ({
            value: tab.key,
            label: tab.label,
            count: tab.status ? counts[tab.status] : counts.ALL,
            tone: tab.key === "OVERDUE" ? "risk" : undefined,
          }))}
        />
        <SearchInput
          placeholder="Buscar tarefas…"
          className="min-w-0 max-sm:order-first max-sm:basis-full sm:w-72"
        />
        <FilterBar activeCount={activeFilters}>
          <FilterSelect
            paramKey="project"
            label="Projeto"
            options={projects.items.map((project) => ({ value: project.id, label: project.name }))}
          />
          <FilterSelect
            paramKey="assignee"
            label="Responsável"
            options={owners.map((owner) => ({ value: owner.id, label: owner.name }))}
          />
          <FilterSelect
            paramKey="waiting"
            label="Aguardando"
            options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
          />
          <FilterSelect paramKey="category" label="Categoria" options={TASK_CATEGORIES} />
          <FilterSelect paramKey="priority" label="Prioridade" options={TASK_PRIORITIES} />
        </FilterBar>
      </div>

      <TableShell>
        <TasksTable
          tasks={result.items}
          locale={locale}
          dict={dict}
          emptyTitle={
            params.q || activeFilters > 0 ? "Nenhuma tarefa encontrada." : "Nenhuma tarefa ainda."
          }
          emptyDescription={
            params.q || activeFilters > 0
              ? "Ajuste a busca ou os filtros para ver outros resultados."
              : "Crie a primeira tarefa para começar a acompanhar as pendências."
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
              label="tarefas"
            />
          </TableFooter>
        ) : null}
      </TableShell>
    </>
  );
}
