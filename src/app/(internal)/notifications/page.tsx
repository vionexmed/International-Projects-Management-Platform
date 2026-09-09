import type { Metadata } from "next";
import { Bell, CheckCheck } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { countUnread, listNotifications } from "@/server/services/notifications";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notifications";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);

  const [notifications, unread] = await Promise.all([
    listNotifications(user.id),
    countUnread(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Notificações"
        description={
          unread > 0 ? `${unread} notificação(ões) não lida(s).` : "Você está em dia."
        }
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary">
                <CheckCheck />
                Marcar todas como lidas
              </Button>
            </form>
          ) : null
        }
      />

      <Panel>
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação."
            description="Novos eventos dos seus projetos aparecerão aqui."
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {notifications.map((notification) => {
              const content = (
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      notification.readAt ? "bg-line-strong" : "bg-brand",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        notification.readAt ? "text-ink-soft" : "font-medium text-ink",
                      )}
                    >
                      {notification.title}
                    </p>
                    {notification.description ? (
                      <p className="mt-0.5 text-[13px] text-muted">{notification.description}</p>
                    ) : null}
                    <p className="mt-1 text-[12px] text-faint">
                      {formatRelative(notification.createdAt, locale)}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={notification.id}>
                  {notification.href ? (
                    // Submitting marks it read and then follows the link, so the
                    // badge reflects what has actually been seen.
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <input type="hidden" name="href" value={notification.href} />
                      <button
                        type="submit"
                        className="block w-full px-5 py-4 text-left transition-colors hover:bg-subtle"
                      >
                        {content}
                      </button>
                    </form>
                  ) : (
                    <div className="px-5 py-4">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
