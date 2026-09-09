import type { Metadata } from "next";
import type { TaskCategory, TaskPriority, TaskStatus } from "@/generated/prisma";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { countTasksByStatus, listTasks } from "@/server/services/tasks";
import { listProjects } from "@/server/services/projects";
import { listInternalUserOptions } from "@/server/services/users";
import { listSupplierOptions } from "@/server/services/suppliers";
import { PageHeader } from "@/components/app/page-header";
import { TabsNav } from "@/components/app/tabs-nav";
import { Pagination } from "@/components/app/pagination";
import { FilterBar, FilterSelect, SearchInput } from "@/components/app/search-filters";
import { TableFooter, TableShell } from "@/components/ui/table";
import { TasksTable } from "@/features/tasks/tasks-table";
import { NewTaskDialog, TASK_CATEGORIES, TASK_PRIORITIES } from "@/features/tasks/new-task-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

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
      category: params.category as TaskCategory | undefined,
      priority: params.priority as TaskPriority | undefined,
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

  const buildTabHref = (key: string) => {
    const next = new URLSearchParams();
    for (const [param, value] of Object.entries(params)) {
      if (value && param !== "tab" && param !== "page") next.set(param, value);
    }
    if (key !== "ALL") next.set("tab", key);
    const query = next.toString();
    return query ? `/tasks?${query}` : "/tasks";
  };

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Gerencie e acompanhe as tarefas de todos os projetos."
        actions={
          can(user, "task:create") ? (
            <NewTaskDialog
              projects={projects.items.map((project) => ({ id: project.id, name: project.name }))}
              owners={owners}
            />
          ) : null
        }
      />

      <TabsNav
        className="mb-5"
        items={TABS.map((tab) => ({
          href: buildTabHref(tab.key),
          label: tab.label,
          count: tab.status ? counts[tab.status] : counts.ALL,
          active: tab.key === activeTab.key,
        }))}
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <SearchInput placeholder="Buscar tarefas…" className="w-full sm:w-80" />
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
