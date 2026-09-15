import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { getThread, listThreads, markThreadRead } from "@/server/services/messages";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ThreadView } from "@/features/messages/thread-view";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

/**
 * Conversations are contextual: one thread per project, listed on the left and
 * read on the right.
 */
export default async function SupplierMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const threads = await listThreads(user);
  const selectedId =
    threads.find((thread) => thread.id === params.thread)?.id ?? threads[0]?.id ?? null;

  const conversation = selectedId ? await getThread(user, selectedId) : null;
  if (selectedId) await markThreadRead(user, selectedId);

  return (
    <>
      <PageHeader title={dict.portal.messages.title} description={dict.portal.messages.subtitle} />

      {threads.length === 0 ? (
        <Panel>
          <EmptyState
            icon={MessageSquare}
            title={dict.portal.messages.empty}
            description={dict.portal.messages.emptyDescription}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <Panel className="h-fit overflow-hidden">
            <ul className="divide-y divide-line-soft">
              {threads.map((thread) => {
                const active = thread.id === selectedId;
                return (
                  <li key={thread.id}>
                    <Link
                      href={`/supplier/messages?thread=${thread.id}`}
                      className={cn(
                        "block px-4 py-3.5 transition-colors",
                        active ? "bg-brand-soft/50" : "hover:bg-subtle",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            active ? "font-semibold text-brand-deep" : "font-medium text-ink",
                          )}
                        >
                          {thread.project.name}
                        </p>
                        {thread.unreadCount > 0 ? (
                          <span className="inline-flex size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                        ) : null}
                      </div>
                      {thread.lastMessage ? (
                        <>
                          <p className="mt-0.5 truncate text-[13px] text-muted">
                            {thread.lastMessage.sender.name}: {thread.lastMessage.body}
                          </p>
                          <p className="mt-1 text-[12px] text-faint">
                            {formatRelative(thread.lastMessage.createdAt, locale)}
                          </p>
                        </>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel className="flex h-[62vh] flex-col overflow-hidden">
            {conversation ? (
              <>
                <div className="border-b border-line px-5 py-3.5">
                  <h2 className="text-[15px] font-semibold text-ink">
                    {conversation.thread.project.name}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted">Vionex</p>
                </div>
                <ThreadView
                  threadId={conversation.thread.id}
                  messages={conversation.messages}
                  currentUserId={user.id}
                  locale={locale}
                  returnPath="/supplier/messages"
                  labels={{
                    placeholder: dict.portal.messages.placeholder,
                    send: dict.portal.messages.send,
                    sent: dict.portal.messages.sent,
                    attach: dict.portal.messages.attach,
                    removeFile: dict.portal.messages.removeFile,
                    attachments: dict.portal.messages.attachments,
                  }}
                  emptyTitle={dict.portal.messages.empty}
                />
              </>
            ) : (
              <EmptyState icon={MessageSquare} title={dict.portal.messages.selectThread} />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
