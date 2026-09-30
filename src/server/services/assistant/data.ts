import "server-only";
import type { Prisma } from "@/generated/prisma";
import { db } from "@/server/db";
import { documentRequestScope, projectScope, supplierScope, taskScope } from "@/server/authz/scopes";
import { listProjects } from "@/server/services/projects";
import { listInternalUserOptions } from "@/server/services/users";
import { listProjectTimeline, listRecentActivity } from "@/server/services/timeline";
import { startOfTodayUtc } from "@/lib/format";
import type { SessionUser } from "@/types/auth";

/**
 * Everything the assistant reads, through the same scopes as every screen:
 * it can only ever tell someone what they could already open themselves.
 * Read-only — nothing here writes.
 */

const UNFINISHED = { status: { notIn: ["COMPLETED", "CANCELLED"] } } satisfies Prisma.TaskWhereInput;

export async function loadCatalog(user: SessionUser) {
  const [projects, suppliers, people] = await Promise.all([
    listProjects(user, { perPage: 100 }),
    db.supplier.findMany({ where: supplierScope(user), select: { id: true, name: true, country: true }, orderBy: { name: "asc" } }),
    listInternalUserOptions(user),
  ]);
  return { projects: projects.items, suppliers, people };
}

export type AssistantCatalog = Awaited<ReturnType<typeof loadCatalog>>;
export type CatalogProject = AssistantCatalog["projects"][number];

export function findTasks(user: SessionUser, where: Prisma.TaskWhereInput, take = 10) {
  return db.task.findMany({
    where: { AND: [taskScope(user), { project: projectScope(user) }, UNFINISHED, where] },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      priority: true,
      assignedTo: { select: { name: true } },
      project: { select: { id: true, name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take,
  });
}

export function overdueWhere(): Prisma.TaskWhereInput {
  return { dueDate: { lt: startOfTodayUtc() } };
}

export function dueWithin(days: number): Prisma.TaskWhereInput {
  const until = startOfTodayUtc();
  until.setUTCDate(until.getUTCDate() + days);
  return { dueDate: { gte: startOfTodayUtc(), lte: until } };
}

export function findRequests(
  user: SessionUser,
  statuses: ("PENDING" | "REJECTED" | "SUBMITTED" | "IN_REVIEW")[],
  where: Prisma.DocumentRequestWhereInput = {},
  take = 10,
) {
  return db.documentRequest.findMany({
    where: { AND: [documentRequestScope(user), { project: projectScope(user) }, { status: { in: statuses } }, where] },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      submittedAt: true,
      taskId: true,
      project: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    take,
  });
}

export function findMilestones(user: SessionUser, where: Prisma.MilestoneWhereInput = {}, take = 8) {
  return db.milestone.findMany({
    where: { AND: [{ project: projectScope(user) }, { status: { not: "COMPLETED" } }, where] },
    select: { id: true, title: true, dueDate: true, status: true, stage: true, project: { select: { id: true, name: true } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    take,
  });
}

export function findBlockers(user: SessionUser) {
  return db.project.findMany({
    where: { AND: [projectScope(user), { blockerNote: { not: null } }] },
    select: { id: true, name: true, blockerNote: true },
  });
}

export function findActivity(user: SessionUser, projectId?: string) {
  return projectId ? listProjectTimeline(user, projectId, 6) : listRecentActivity(user, 8);
}
