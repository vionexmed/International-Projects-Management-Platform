import "server-only";
import type { Prisma, TimelineEventType } from "@/generated/prisma";
import { db } from "@/server/db";
import { timelineScope } from "@/server/authz/scopes";
import type { SessionUser } from "@/types/auth";

/**
 * Project timelines are written by the services that cause the change, never
 * by UI code, so the history stays complete regardless of entry point.
 *
 * `internal: true` keeps an event out of the Supplier Portal timeline.
 */
export async function recordTimelineEvent(input: {
  projectId: string;
  actorId: string | null;
  type: TimelineEventType;
  description: string;
  internal?: boolean;
  metadata?: Prisma.InputJsonValue;
  client?: Prisma.TransactionClient;
}) {
  const client = input.client ?? db;
  await client.timelineEvent.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId,
      type: input.type,
      description: input.description,
      internal: input.internal ?? false,
      metadata: input.metadata,
    },
  });
}

export async function listProjectTimeline(user: SessionUser, projectId: string, take = 50) {
  return db.timelineEvent.findMany({
    where: { AND: [timelineScope(user), { projectId }] },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Recent activity across the whole portfolio, for the dashboard. */
export async function listRecentActivity(user: SessionUser, take = 8) {
  return db.timelineEvent.findMany({
    where: timelineScope(user),
    include: {
      actor: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}
