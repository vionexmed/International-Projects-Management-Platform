import { requireInternalUser } from "@/server/auth/current-user";
import { orNotFound } from "@/server/authz/rsc";
import { listInternalUserOptions } from "@/server/services/users";
import { TaskWindow, loadTaskDetail } from "@/features/tasks/task-detail";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

/**
 * `/tasks/[taskId]` opened from inside the app: the task shows as a window
 * over the page you were on, and closing it goes back there. A refresh or a
 * shared link renders the full page (`tasks/[taskId]/page.tsx`) instead.
 */
export default async function TaskWindowRoute({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [data, owners] = await Promise.all([
    orNotFound(loadTaskDetail(user, taskId)),
    listInternalUserOptions(user),
  ]);

  return <TaskWindow data={data} owners={owners} locale={locale} dict={dict} />;
}
