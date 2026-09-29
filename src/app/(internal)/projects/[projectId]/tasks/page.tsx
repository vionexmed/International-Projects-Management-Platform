import Link from "next/link";
import { Check, ChevronDown, Columns3, List, Maximize2 } from "lucide-react";
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
import { SheetBody, SheetHeader } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { SegmentedToggle, ViewToolbar } from "@/components/app/view-toolbar";
import { NewTaskDialog } from "@/features/tasks/new-task-dialog";
import { PlanList } from "@/features/tasks/plan-list";
import { PlanCustomColumnControls } from "@/features/tasks/plan-custom-column-controls";
import { PlanBoard } from "@/features/tasks/plan-board";
import { PLAN_CATEGORIES, buildPlanGroups, planHref, toPlanColumns } from "@/features/tasks/plan-data";
import { TaskSheet } from "@/features/tasks/task-sheet";
import {
  TaskComments,
  TaskDetailActions,
  TaskDetailMain,
  TaskEyebrow,
  loadTaskDetail,
} from "@/features/tasks/task-detail";
import { PROJECT_GUTTER } from "@/features/projects/project-frame";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, oneOf } from "@/lib/labels";
import { cn } from "@/lib/utils";

type PlanSearch = { category?: string; view?: string; assignee?: string; task?: string };

/**
 * "Plano": the project's tasks grouped by stage, as a list (default) or a
 * board. View, stage filter, assignee filter and the open task all live in
 * the URL, so every state is a link. The old `/tasks?category=` links from
 * the stage pages land on the matching stage filter.
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
  const view = search.view === "board" ? "board" : "list";

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
  const current = { view: view === "board" ? "board" : undefined, category, assignee };
  const href = (changes: Record<string, string | null>) => planHref(base, current, changes);
  const taskHref = (taskId: string) => href({ task: taskId });
  const editable = can(user, "task:update");
  const people = allTasks
    .map((task) => task.assignedTo)
    .filter((person): person is { id: string; name: string } => person !== null);

  const viewLabel = category ? label.taskCategory(category, dict) : "Todas as tarefas";
  // A task from another project never opens over this plan.
  const openTask = sheet && sheet.task.projectId === projectId ? sheet : null;

  return (
    <div className={PROJECT_GUTTER}>
      <ViewToolbar
        className="rounded-t-md border border-line bg-surface px-4 sm:px-6"
        left={
          <>
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-2 px-2" trailingIcon={<ChevronDown />}>
                  <span className="text-muted">Visão:</span>
                  <span className="text-ink">{viewLabel}</span>
                </Button>
              </DropdownTrigger>
              <DropdownContent align="start">
                {[undefined, ...PLAN_CATEGORIES].map((option) => (
                  <DropdownItem key={option ?? "all"} asChild>
                    <Link href={href({ category: option ?? null })} scroll={false}>
                      <span className="flex-1">
                        {option ? label.taskCategory(option, dict) : "Todas as tarefas"}
                      </span>
                      {option === category ? <Check /> : null}
                    </Link>
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
            <span className="text-meta text-faint tabular-nums">{result.total}</span>
          </>
        }
        center={
          <SegmentedToggle
            label="Modo de visualização"
            items={[
              { href: href({ view: null }), label: "Lista", icon: <List />, active: view === "list" },
              { href: href({ view: "board" }), label: "Quadro", icon: <Columns3 />, active: view === "board" },
            ]}
          />
        }
        right={
          <>
            {view === "list" && can(user, "task:update") ? (
              <PlanCustomColumnControls projectId={projectId} columns={columns} />
            ) : null}
            {people.length > 0 ? (
              <nav aria-label="Filtrar por responsável" className="hidden items-center gap-2 sm:flex">
                <span className="text-label text-muted">Responsável</span>
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
          </>
        }
      />

      {result.total > result.items.length ? (
        <p className="border-b border-line bg-warn-soft px-4 py-2 text-meta text-warn sm:px-6">
          Mostrando as primeiras {result.items.length} de {result.total} tarefas. Use os filtros para
          ver as demais.
        </p>
      ) : null}

      {view === "board" ? (
        <PlanBoard groups={groups} owners={owners} editable={editable} taskHref={taskHref} dict={dict} />
      ) : (
        <PlanList groups={groups} owners={owners} editable={editable} projectId={projectId} columns={columns} dict={dict} />
      )}

      {openTask ? (
        <TaskSheet
          closeHref={href({})}
          aside={<TaskComments data={openTask} locale={locale} />}
        >
          <SheetHeader
            eyebrow={<TaskEyebrow data={openTask} />}
            title={openTask.task.title}
            actions={
              <>
                <TaskDetailActions data={openTask} owners={owners} />
                <Button asChild variant="ghost" size="iconSm" aria-label="Abrir em página inteira">
                  <Link href={`/tasks/${openTask.task.id}`} title="Abrir em página inteira">
                    <Maximize2 />
                  </Link>
                </Button>
              </>
            }
          />
          <SheetBody>
            <TaskDetailMain data={openTask} owners={owners} locale={locale} dict={dict} />
          </SheetBody>
        </TaskSheet>
      ) : null}
    </div>
  );
}
