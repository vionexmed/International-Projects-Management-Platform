import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { requireTaskAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { listInternalUserOptions } from "@/server/services/users";
import {
  TaskComments,
  TaskDetailActions,
  TaskDetailMain,
  loadTaskDetail,
} from "@/features/tasks/task-detail";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  try {
    const user = await requireInternalUser();
    const task = await requireTaskAccess(user, taskId);
    return { title: task.title };
  } catch {
    return { title: "Tarefa" };
  }
}

/**
 * The full-page fallback of the plan's task sheet (notifications and old
 * links point here): the same record, the same split — details on the left,
 * comments in the right column.
 */
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const user = await requireInternalUser();

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [data, owners] = await Promise.all([
    orNotFound(loadTaskDetail(user, taskId)),
    listInternalUserOptions(user),
  ]);
  const { task } = data;

  return (
    <div className="-mx-4 -mt-5 -mb-5 flex min-h-[calc(100dvh-3rem)] flex-col bg-surface sm:-mx-6 sm:-mt-6 sm:-mb-6 lg:min-h-dvh">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1 px-4 pt-5 pb-8 sm:px-6">
          <nav aria-label="Navegação estrutural" className="mb-1 flex items-center gap-1 text-label">
            <Link href={`/projects/${task.project.id}`} className="text-brand-strong hover:underline">
              {task.project.name}
            </Link>
            <ChevronRight className="size-3.5 text-faint" aria-hidden />
            <Link href={`/projects/${task.project.id}/tasks`} className="text-brand-strong hover:underline">
              Plano
            </Link>
          </nav>
          <div className="mb-5 flex items-start justify-between gap-4">
            <h1 className="min-w-0 text-[22px] leading-8 font-semibold text-ink">{task.title}</h1>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <TaskDetailActions data={data} owners={owners} />
            </div>
          </div>
          <TaskDetailMain data={data} owners={owners} locale={locale} dict={dict} />
        </div>

        <aside className="flex flex-col border-t border-line bg-subtle lg:sticky lg:top-0 lg:h-dvh lg:w-[32%] lg:max-w-[420px] lg:shrink-0 lg:border-t-0 lg:border-l">
          <TaskComments data={data} locale={locale} />
        </aside>
      </div>
    </div>
  );
}
