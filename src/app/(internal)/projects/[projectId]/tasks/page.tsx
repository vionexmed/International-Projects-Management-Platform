import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { listTasks } from "@/server/services/tasks";
import { listInternalUserOptions } from "@/server/services/users";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { TasksTable } from "@/features/tasks/tasks-table";
import { NewTaskDialog } from "@/features/tasks/new-task-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  const project = await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [result, owners] = await Promise.all([
    listTasks(user, { projectId, perPage: 100 }),
    listInternalUserOptions(user),
  ]);

  return (
    <Panel>
      <PanelHeader
        title="Tarefas"
        description={`${result.total} tarefa(s) neste projeto.`}
        action={
          can(user, "task:create") ? (
            <NewTaskDialog
              projectId={projectId}
              owners={owners}
              supplierName={project.supplier.name}
              variant="secondary"
            />
          ) : null
        }
      />
      <TasksTable
        tasks={result.items}
        locale={locale}
        dict={dict}
        emptyTitle="Nenhuma tarefa neste projeto."
        emptyDescription="Crie uma tarefa para registrar o próximo passo."
      />
    </Panel>
  );
}
