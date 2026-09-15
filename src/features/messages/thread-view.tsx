import { MessageSquare, Paperclip } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/avatar";
import { MessageComposer } from "@/features/messages/message-composer";
import { formatDateTime, formatFileSize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: Date;
  sender: { id: string; name: string; jobTitle: string | null; supplierId: string | null };
  attachments?: {
    id: string;
    documentVersion: { id: string; fileName: string; fileSize: number };
  }[];
};

/**
 * One conversation. Messages from the viewer's own side are aligned right so
 * the Vionex ↔ supplier exchange is readable at a glance.
 */
export function ThreadView({
  messages,
  currentUserId,
  threadId,
  locale,
  labels,
  returnPath,
  emptyTitle,
  emptyDescription,
}: {
  messages: ThreadMessage[];
  currentUserId: string;
  threadId: string;
  locale: Locale;
  labels: {
    placeholder: string;
    send: string;
    sent: string;
    attach: string;
    removeFile: string;
    attachments: string;
  };
  returnPath: string;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-slim flex-1 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={emptyTitle}
            description={emptyDescription}
            compact
          />
        ) : (
          <ul className="space-y-4">
            {messages.map((message) => {
              const mine = message.sender.id === currentUserId;
              return (
                <li key={message.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                  <UserAvatar
                    name={message.sender.name}
                    size="sm"
                    tone={message.sender.supplierId ? "light" : "brand"}
                  />
                  <div className={cn("min-w-0 max-w-[80%]", mine && "text-right")}>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-muted">
                      <span className="font-medium text-ink-soft">{message.sender.name}</span>
                      <span>{formatDateTime(message.createdAt, locale)}</span>
                    </p>
                    <div
                      className={cn(
                        "mt-1 inline-block rounded-md border px-3.5 py-2.5 text-left text-sm leading-relaxed whitespace-pre-wrap",
                        mine
                          ? "border-brand-line bg-brand-soft text-ink"
                          : "border-line bg-surface text-ink",
                      )}
                    >
                      {message.body}
                    </div>

                    {message.attachments?.length ? (
                      <ul className="mt-1.5 space-y-1.5" aria-label={labels.attachments}>
                        {message.attachments.map((attachment) => (
                          <li key={attachment.id}>
                            {/*
                              The same authenticated route every other download
                              uses: the session is checked again on the server,
                              so a link copied out of here is worth nothing to
                              anyone else.
                            */}
                            <a
                              href={`/api/files/${attachment.documentVersion.id}`}
                              className="flex items-center gap-2 rounded-sm border border-line bg-surface px-2.5 py-1.5 text-left text-[12px] transition-colors hover:border-brand"
                            >
                              <Paperclip className="size-3.5 shrink-0 text-muted" />
                              <span className="min-w-0 flex-1 truncate text-ink">
                                {attachment.documentVersion.fileName}
                              </span>
                              <span className="shrink-0 text-muted">
                                {formatFileSize(attachment.documentVersion.fileSize)}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line bg-subtle p-4">
        <MessageComposer
          threadId={threadId}
          labels={{
            placeholder: labels.placeholder,
            send: labels.send,
            sent: labels.sent,
            attach: labels.attach,
            remove: labels.removeFile,
          }}
          returnPath={returnPath}
        />
      </div>
    </div>
  );
}
