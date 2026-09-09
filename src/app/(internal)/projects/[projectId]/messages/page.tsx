import { requireInternalUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { ensureProjectThread, getThread, markThreadRead } from "@/server/services/messages";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { ThreadView } from "@/features/messages/thread-view";
import { localeFromLanguage } from "@/lib/i18n/config";

export default async function ProjectMessagesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  const project = await orNotFound(requireProjectAccess(user, projectId));

  const threadId = await ensureProjectThread(projectId, project.name);
  const { messages } = await getThread(user, threadId);
  await markThreadRead(user, threadId);

  return (
    <Panel className="flex h-[70vh] flex-col overflow-hidden">
      <PanelHeader
        title={`Conversa com ${project.supplier.name}`}
        description="Mensagens visíveis para o fornecedor no Supplier Portal."
      />
      <ThreadView
        threadId={threadId}
        messages={messages}
        currentUserId={user.id}
        locale={localeFromLanguage(user.language)}
        returnPath={`/projects/${projectId}/messages`}
        labels={{
          placeholder: "Escreva uma mensagem para o fornecedor…",
          send: "Enviar",
          sent: "Mensagem enviada.",
        }}
        emptyTitle="Nenhuma mensagem ainda."
        emptyDescription="Inicie a conversa com o fornecedor sobre este projeto."
      />
    </Panel>
  );
}
