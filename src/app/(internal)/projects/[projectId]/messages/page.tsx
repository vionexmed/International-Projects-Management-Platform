import { requireInternalUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { ensureProjectThread, getThread, markThreadRead } from "@/server/services/messages";
import { orNotFound } from "@/server/authz/rsc";
import { Panel } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
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

  // The thread is the page's one box; its title sits on the canvas above it.
  return (
    <Section
      title={`Conversa com ${project.supplier.name}`}
      description="Tudo o que for escrito aqui aparece para o fornecedor no Supplier Portal."
    >
      <Panel className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden">
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
            attach: "Anexar arquivo",
            removeFile: "Remover arquivo",
            attachments: "Anexos",
          }}
          emptyTitle="Nenhuma mensagem ainda."
          emptyDescription="Inicie a conversa com o fornecedor sobre este projeto."
        />
      </Panel>
    </Section>
  );
}
