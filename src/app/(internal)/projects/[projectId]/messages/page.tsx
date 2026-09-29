import { requireInternalUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { ensureProjectThread, getThread, markThreadRead } from "@/server/services/messages";
import { orNotFound } from "@/server/authz/rsc";
import { PROJECT_FLUSH } from "@/features/projects/project-frame";
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

  // The thread fills the tab under a one-line context strip, edge to edge.
  return (
    <div className={`${PROJECT_FLUSH} flex h-[calc(100dvh-9.5rem)] min-h-[420px] flex-col lg:h-[calc(100dvh-6.5rem)]`}>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line px-4 py-2 sm:px-6">
        <h2 className="text-title text-ink">Conversa com {project.supplier.name}</h2>
        <p className="text-meta text-muted">
          Tudo o que for escrito aqui aparece para o fornecedor no Supplier Portal.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
      </div>
    </div>
  );
}
