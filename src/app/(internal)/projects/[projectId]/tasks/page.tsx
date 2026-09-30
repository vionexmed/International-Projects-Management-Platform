import Link from "next/link";
import { Layers } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { isNotFoundError } from "@/server/authz/errors";
import { listTasks } from "@/server/services/tasks";
import { listProjectPlanColumns } from "@/server/services/project-plan";
import { listInternalUserOptions } from "@/server/services/users";
import { orNotFound } from "@/server/authz/rsc";
import { db } from "@/server/db";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TableShell } from "@/components/ui/table";
import { NewTaskDialog } from "@/features/tasks/new-task-dialog";
import { PlanList } from "@/features/tasks/plan-list";
import { stageSegment } from "@/features/projects/stage-routes";
import { PLAN_CATEGORIES, buildPlanGroups, planHref, toPlanColumns } from "@/features/tasks/plan-data";
import { TaskWindow, loadTaskDetail } from "@/features/tasks/task-detail";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, oneOf } from "@/lib/labels";
import { cn } from "@/lib/utils";

type PlanSearch = { category?: string; assignee?: string; task?: string };


/**
 * "Plano": project tasks grouped by stage. Stage and assignee filters and
 * the open task live in the URL; older links with `view=board` show the list.
 */
export default async function ProjectPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<PlanSearch>;
}) {
  const { projectId } = await params;
  const search = await searchParams;
  const user = await requireInternalUser();
  const project = await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const category = oneOf(search.category, OPTIONS.taskCategory);

  const [owners, stages] = await Promise.all([
    listInternalUserOptions(user),
    db.projectStage.findMany({
      where: { projectId: project.id },
      select: { key: true, status: true },
    }),
  ]);
  // A URL value, so it is checked against the people who can hold work.
  const assignee = owners.some((owner) => owner.id === search.assignee) ? search.assignee : undefined;

  const [result, allTasks, sheet, planColumns] = await Promise.all([
    listTasks(user, { projectId, category, assignedToId: assignee, perPage: 100 }),
    // Everyone with work in the project, for the avatar filter — unfiltered on purpose.
    db.task.findMany({
      where: { projectId: project.id, assignedToId: { not: null } },
      select: { assignedTo: { select: { id: true, name: true } } },
      distinct: ["assignedToId"],
    }),
    search.task
      ? loadTaskDetail(user, search.task).catch((error) => {
          if (isNotFoundError(error)) return null;
          throw error;
        })
      : null,
    listProjectPlanColumns(user, projectId),
  ]);

  const columns = toPlanColumns(planColumns);

  const groups = buildPlanGroups({
    tasks: result.items,
    stages,
    projectId,
    categories: category ? [category] : PLAN_CATEGORIES,
    locale,
    dict,
  });

  const base = `/projects/${projectId}/tasks`;
  const current = { category, assignee };
  const href = (changes: Record<string, string | null>) => planHref(base, current, changes);
  const editable = can(user, "task:update");
  const people = allTasks
    .map((task) => task.assignedTo)
    .filter((person): person is { id: string; name: string } => person !== null);

  const viewLabel = category ? label.taskCategory(category, dict) : "Todas as tarefas";
  // A task from another project never opens over this plan.
  const openTask = sheet && sheet.task.projectId === projectId ? sheet : null;

  return (
    <div className="min-w-0">
      <TableShell variant="workspace" className="rounded-lg">
      {/*
        The table is the plan; "Ver por etapa" is the other way to read it —
        the stage pages, opened at the current stage, with their own switcher
        and a way back here.
      */}
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/projects/${projectId}/${stageSegment(project.currentStage)}`}>
              <Layers />
              Ver por etapa
            </Link>
          </Button>
          <span className="hidden shrink-0 text-meta text-muted tabular-nums sm:inline">
            {result.total} {result.total === 1 ? "tarefa" : "tarefas"}
            {category ? ` · ${viewLabel}` : ""}
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
            {people.length > 0 ? (
              <nav aria-label="Filtrar por responsável" className="hidden items-center gap-2 sm:flex">
                <span className="hidden text-label text-muted xl:inline">Responsável</span>
                <span className="flex items-center">
                  {people.slice(0, 6).map((person, index) => {
                    const active = person.id === assignee;
                    return (
                      <Link
                        key={person.id}
                        href={href({ assignee: active ? null : person.id })}
                        scroll={false}
                        title={person.name}
                        aria-label={`${active ? "Remover filtro" : "Filtrar"}: ${person.name}`}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "rounded-full ring-2 transition-transform hover:z-10 hover:-translate-y-px",
                          active ? "z-10 ring-brand" : "ring-surface",
                          index > 0 && "-ml-1",
                          assignee && !active && "opacity-50",
                        )}
                      >
                        <UserAvatar name={person.name} size="sm" />
                      </Link>
                    );
                  })}
                </span>
              </nav>
            ) : null}
            {can(user, "task:create") ? (
              <NewTaskDialog
                projectId={projectId}
                owners={owners}
                supplierName={project.supplier.name}
                defaultCategory={category ?? "GENERAL"}
                size="sm"
              />
            ) : null}
        </div>
      </div>

      {result.total > result.items.length ? (
        <p className="border-b border-line bg-warn-soft px-4 py-2 text-meta text-warn sm:px-6">
          Mostrando as primeiras {result.items.length} de {result.total} tarefas. Use os filtros para
          ver as demais.
        </p>
      ) : null}

      <PlanList groups={groups} owners={owners} editable={editable} canCreate={can(user, "task:create")} projectId={projectId} columns={columns} dict={dict} openHref={href({})} />
      </TableShell>

      {openTask ? (
        <TaskWindow data={openTask} owners={owners} locale={locale} dict={dict} closeHref={href({})} />
      ) : null}
    </div>
  );
}
