import type { Metadata } from "next";
import { Bell, CheckCheck } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { countUnread, listNotifications } from "@/server/services/notifications";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notifications";
import { PageHeader } from "@/components/app/page-header";
import { SegmentedToggle } from "@/components/app/view-toolbar";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatRelative, startOfTodayUtc } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificações" };

type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];

/** Groups by recency, newest bucket first — same idea as the deadline rail on `/dashboard`. */
function groupByRecency(notifications: NotificationRow[]) {
  const today = startOfTodayUtc().getTime();
  const weekAgo = today - 6 * 24 * 60 * 60 * 1000;

  const groups: { key: string; label: string; items: NotificationRow[] }[] = [
    { key: "today", label: "Hoje", items: [] },
    { key: "week", label: "Esta semana", items: [] },
    { key: "earlier", label: "Anteriores", items: [] },
  ];

  for (const notification of notifications) {
    const time = notification.createdAt.getTime();
    if (time >= today) groups[0].items.push(notification);
    else if (time >= weekAgo) groups[1].items.push(notification);
    else groups[2].items.push(notification);
  }

  return groups.filter((group) => group.items.length > 0);
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const unreadOnly = params.tab === "unread";

  const [notifications, unread] = await Promise.all([
    listNotifications(user.id, { unreadOnly }),
    countUnread(user.id),
  ]);

  const groups = groupByRecency(notifications);

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

      {/*
        Two options, so a short segmented switch rather than a tab strip; the
        unread count is already in the line under the title (and on the bell).
      */}
      <SegmentedToggle
        label="Filtrar notificações"
        className="mb-5"
        items={[
          { href: "/notifications", label: "Todas", active: !unreadOnly },
          { href: "/notifications?tab=unread", label: "Não lidas", active: unreadOnly },
        ]}
      />

      {notifications.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Bell}
            title={unreadOnly ? "Nenhuma notificação não lida." : "Nenhuma notificação."}
            description="Novos eventos dos seus projetos aparecerão aqui."
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Panel key={group.key}>
              <PanelHeader title={group.label} count={group.items.length} />
              <ul className="divide-y divide-line-faint">
                {group.items.map((notification) => {
                  const content = (
                    <div className="flex min-h-10 items-center gap-3 py-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          notification.readAt ? "bg-line-strong" : "bg-brand",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-body",
                            notification.readAt ? "text-ink-soft" : "font-medium text-ink",
                          )}
                        >
                          {notification.title}
                        </p>
                        {notification.description ? (
                          <p className="truncate text-meta text-muted">{notification.description}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-meta whitespace-nowrap text-faint">
                        {formatRelative(notification.createdAt, locale)}
                      </span>
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
                            className="block w-full px-5 text-left transition-colors hover:bg-subtle"
                          >
                            {content}
                          </button>
                        </form>
                      ) : (
                        <div className="px-5">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
