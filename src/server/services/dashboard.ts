import "server-only";
import { db } from "@/server/db";
import { projectScope, taskScope } from "@/server/authz/scopes";
import { projectProgress, type StageSnapshot, type TaskSnapshot } from "@/server/services/project-health";
import type { SessionUser } from "@/types/auth";

/**
 * The dashboard answers five questions (§46): what needs attention, what is
 * late, who must act, which supplier is holding things up, and what is next.
 * Each block below maps to one of those and nothing more.
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

/**
 * Projects that are at risk or blocked, each with the single most urgent open
 * task as its "next step" — the column that tells someone what to actually do.
 */
export async function listProjectsRequiringAttention(user: SessionUser, take = 6) {
  const projects = await db.project.findMany({
    where: { AND: [projectScope(user), { status: { in: ["AT_RISK", "BLOCKED"] } }] },
    include: {
      supplier: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      tasks: {
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        take: 1,
        select: { id: true, title: true, dueDate: true, supplierId: true },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take,
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    projectCode: project.projectCode,
    status: project.status,
    currentStage: project.currentStage,
    blockerNote: project.blockerNote,
    supplier: project.supplier,
    owner: project.owner,
    nextStep: project.tasks[0] ?? null,
  }));
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

/** Work assigned to the signed-in user — "what do I have to do?". */
export async function listMyOpenTasks(user: SessionUser, take = 5) {
  return db.task.findMany({
    where: {
      AND: [
        taskScope(user),
        { assignedToId: user.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      ],
    },
    include: { project: { select: { id: true, name: true } } },
    orderBy: [{ dueDate: "asc" }],
    take,
  });
}

/** Suppliers with outstanding requests, worst first. */
export async function listSupplierBottlenecks(user: SessionUser, take = 4) {
  const now = new Date();
  const grouped = await db.task.groupBy({
    by: ["supplierId"],
    where: {
      AND: [
        taskScope(user),
        { supplierId: { not: null }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      ],
    },
    _count: { _all: true },
  });

  if (grouped.length === 0) return [];

  const supplierIds = grouped
    .map((group) => group.supplierId)
    .filter((id): id is string => Boolean(id));

  const [suppliers, overdueGroups] = await Promise.all([
    db.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true, country: true, status: true },
    }),
    db.task.groupBy({
      by: ["supplierId"],
      where: {
        supplierId: { in: supplierIds },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        dueDate: { lt: now },
      },
      _count: { _all: true },
    }),
  ]);

  const overdue = new Map(
    overdueGroups
      .filter((group) => group.supplierId)
      .map((group) => [group.supplierId as string, group._count._all]),
  );
  const open = new Map(
    grouped
      .filter((group) => group.supplierId)
      .map((group) => [group.supplierId as string, group._count._all]),
  );

  return suppliers
    .map((supplier) => ({
      ...supplier,
      openCount: open.get(supplier.id) ?? 0,
      overdueCount: overdue.get(supplier.id) ?? 0,
    }))
    .sort((a, b) => b.overdueCount - a.overdueCount || b.openCount - a.openCount)
    .slice(0, take);
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
    progress: projectProgress(project.stages as StageSnapshot[], project.tasks as TaskSnapshot[]),
  }));
}
