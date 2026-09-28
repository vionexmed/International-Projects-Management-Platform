import { requireSupplierUser } from "@/server/auth/current-user";
import { requireSharedProjectAccess } from "@/server/authz/access";
import { ensureProjectThread, getThread, markThreadRead } from "@/server/services/messages";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { ThreadView } from "@/features/messages/thread-view";
import { threadLabels } from "@/features/supplier-portal/portal-labels";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

export default async function SupplierProjectMessagesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSupplierUser();
  const project = await orNotFound(requireSharedProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const threadId = await ensureProjectThread(projectId, project.name);
  const { messages } = await getThread(user, threadId);
  await markThreadRead(user, threadId);

  return (
    <Panel className="flex h-[62vh] flex-col overflow-hidden">
      <PanelHeader title={dict.portal.messages.title} description="Vionex" />
      <ThreadView
        threadId={threadId}
        messages={messages}
        currentUserId={user.id}
        locale={locale}
        returnPath={`/supplier/projects/${projectId}/messages`}
        labels={threadLabels(dict)}
        emptyTitle={dict.portal.messages.empty}
        emptyDescription={dict.portal.messages.emptyDescription}
      />
    </Panel>
  );
}
