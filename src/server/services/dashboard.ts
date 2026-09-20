import "server-only";
import { db } from "@/server/db";
import { projectScope, taskScope } from "@/server/authz/scopes";
import {
  projectProgress,
  stageWorkAsTasks,
  type StageSnapshot,
  type TaskSnapshot,
} from "@/server/services/project-health";
import type { SessionUser } from "@/types/auth";

/**
 * What is left of the dashboard's own data layer.
 *
 * It used to hold five queries, three of which existed to render lists that
 * `/projects`, `/tasks` and `/suppliers` already own — the dashboard was
 * answering "what is in the portfolio" a second time. Those are gone; the
 * exceptions now come from `attention.ts` and the distributions from
 * `analytics.ts`, and what remains here is the portfolio count and the
 * deadline strip.
 */

export async function getPortfolioSummary(user: SessionUser) {
  const scope = projectScope(user);
  const grouped = await db.project.groupBy({
    by: ["status"],
    where: scope,
    _count: { _all: true },
  });

  const summary = { total: 0, onTrack: 0, atRisk: 0, blocked: 0, completed: 0 };
  for (const group of grouped) {
    summary.total += group._count._all;
    if (group.status === "ON_TRACK") summary.onTrack = group._count._all;
    if (group.status === "AT_RISK") summary.atRisk = group._count._all;
    if (group.status === "BLOCKED") summary.blocked = group._count._all;
    if (group.status === "COMPLETED") summary.completed = group._count._all;
  }
  return summary;
}

/** Upcoming and already-late deadlines, nearest first. */
export async function listUpcomingDeadlines(user: SessionUser, take = 6) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 45);

  const tasks = await db.task.findMany({
    where: {
      AND: [
        taskScope(user),
        {
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          dueDate: { not: null, lte: horizon },
        },
      ],
    },
    include: {
      project: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
    take,
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueDate,
    project: task.project,
    supplier: task.supplier,
    priority: task.priority,
    status: task.status,
  }));
}

/** Portfolio-wide average progress, used by the Reports page. */
export async function getPortfolioProgress(user: SessionUser) {
  const projects = await db.project.findMany({
    where: projectScope(user),
    select: {
      id: true,
      name: true,
      projectCode: true,
      status: true,
      currentStage: true,
      targetLaunchDate: true,
      supplier: { select: { name: true, country: true } },
      owner: { select: { name: true } },
      stages: { select: { key: true, status: true, progress: true } },
      tasks: { select: { category: true, status: true, priority: true, dueDate: true } },
      regulatoryItems: { select: { status: true, dueDate: true } },
      gtmItems: { select: { status: true, dueDate: true } },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    projectCode: project.projectCode,
    status: project.status,
    currentStage: project.currentStage,
    targetLaunchDate: project.targetLaunchDate,
    supplierName: project.supplier.name,
    country: project.supplier.country,
    ownerName: project.owner.name,
    progress: projectProgress(project.stages as StageSnapshot[], [
      ...(project.tasks as TaskSnapshot[]),
      ...stageWorkAsTasks({
        regulatoryItems: project.regulatoryItems,
        gtmItems: project.gtmItems,
      }),
    ]),
  }));
}
