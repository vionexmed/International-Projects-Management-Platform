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
