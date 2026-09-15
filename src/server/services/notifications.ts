import "server-only";
import type { NotificationType, Prisma } from "@/generated/prisma";
import { db } from "@/server/db";

/**
 * In-app notifications. Delivery is intentionally a separate concern from
 * creation: today the badge reads these rows, and an e-mail or webhook
 * transport can consume the same records later without touching callers.
 */
export async function notify(input: {
  userIds: string[];
  type: NotificationType;
  title: string;
  description?: string;
  href?: string;
  client?: Prisma.TransactionClient;
}) {
  const recipients = [...new Set(input.userIds.filter(Boolean))];
  if (recipients.length === 0) return;

  const client = input.client ?? db;
  await client.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      description: input.description,
      href: input.href,
    })),
  });
}

/**
 * Notifies, unless the same thing was already said recently.
 *
 * Deadline warnings and assignment notices are emitted from paths that can run
 * more than once for the same underlying fact: a form resubmitted, an action
 * retried, a task edited twice in a row. Without a guard, the bell fills with
 * the same line repeated — and a notification list nobody trusts is a
 * notification list nobody reads.
 *
 * The window is deliberately a query rather than a new column: `href` already
 * identifies the subject, `type` the reason, and `Notification` is indexed by
 * user. That is enough to answer "have we already told this person this?"
 * without changing the schema.
 */
export async function notifyOnce(input: {
  userIds: string[];
  type: NotificationType;
  title: string;
  description?: string;
  href: string;
  /** How far back an identical notice still counts. Default: one day. */
  withinMs?: number;
}) {
  const recipients = [...new Set(input.userIds.filter(Boolean))];
  if (recipients.length === 0) return;

  const since = new Date(Date.now() - (input.withinMs ?? 24 * 60 * 60 * 1000));
  const alreadyTold = await db.notification.findMany({
    where: {
      userId: { in: recipients },
      type: input.type,
      href: input.href,
      createdAt: { gte: since },
    },
    select: { userId: true },
  });

  const told = new Set(alreadyTold.map((row) => row.userId));
  await notify({ ...input, userIds: recipients.filter((id) => !told.has(id)) });
}

/** Every active user of a supplier — used when a request targets a company. */
export async function supplierRecipients(supplierId: string, client: Prisma.TransactionClient | typeof db = db) {
  const users = await client.user.findMany({
    where: { supplierId, status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export async function listNotifications(userId: string, take = 40) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countUnread(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string) {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markRead(userId: string, notificationId: string) {
  await db.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}
