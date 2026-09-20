import "server-only";
import { startOfTodayUtc } from "@/lib/format";
import { db } from "@/server/db";
import { documentRequestScope, projectScope, taskScope } from "@/server/authz/scopes";
import type { DocumentCycleStatus, HealthStatus, Prisma, StageKey } from "@/generated/prisma";

/** The four values `Project.status` actually holds. */
type ProjectStatus = Extract<HealthStatus, "ON_TRACK" | "AT_RISK" | "BLOCKED" | "COMPLETED">;
/** The six values `DocumentRequest.status` actually holds — never `RECEIVED`, which only `Document` uses. */
type RequestStatus = Extract<
  DocumentCycleStatus,
  "PENDING" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED"
>;
import type { SessionUser } from "@/types/auth";

/**
 * Aggregates for Reports.
 *
 * Reports used to render the portfolio table a second time, which made it a
 * worse `/projects` rather than a different screen. Everything here is a
 * count, a share or an average — a shape `/projects` cannot produce — and each
 * number carries the link to the operational page that lists the rows behind
 * it, so a question always ends somewhere it can be acted on.
 *
 * Nothing is invented. Every metric below is derived from columns the product
 * already writes; where the data cannot honestly support a metric (how long a
 * *review* takes, before the review table existed) it is reported as unknown
 * instead of estimated.
 */

export type Slice = { key: string; label?: string; count: number; href: string };

function slices(counts: Map<string, number>, href: (key: string) => string): Slice[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, href: href(key) }))
    .sort((a, b) => b.count - a.count);
}

/** Projects by status, stage and country — the shape of the portfolio. */
export async function getPortfolioBreakdown(user: SessionUser) {
  const scope = projectScope(user);

  const [byStatus, byStage, byCountry, total] = await Promise.all([
    db.project.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    db.project.groupBy({ by: ["currentStage"], where: scope, _count: { _all: true } }),
    db.project.groupBy({ by: ["country"], where: scope, _count: { _all: true } }),
    db.project.count({ where: scope }),
  ]);

  return {
    total,
    status: slices(
      new Map(byStatus.map((row) => [row.status as ProjectStatus, row._count._all])),
      (key) => `/projects?tab=${key}`,
    ),
    stage: slices(
      new Map(byStage.map((row) => [row.currentStage as StageKey, row._count._all])),
      (key) => `/projects?stage=${key}`,
    ),
    country: slices(
      new Map(byCountry.map((row) => [row.country, row._count._all])),
      (key) => `/projects?country=${encodeURIComponent(key)}`,
    ),
  };
}

/**
 * Where the deadlines sit: already late, due this week, due this month, and
 * the open work carrying no date at all — which is its own kind of problem.
 */
export async function getDeadlineBreakdown(user: SessionUser) {
  const now = startOfTodayUtc();
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  const month = new Date(now);
  month.setDate(month.getDate() + 30);

  const open: Prisma.TaskWhereInput = { status: { notIn: ["COMPLETED", "CANCELLED"] } };
  const scoped = (extra: Prisma.TaskWhereInput): Prisma.TaskWhereInput => ({
    AND: [taskScope(user), { ...open, ...extra }],
  });

  const [overdue, thisWeek, thisMonth, undated, openTotal] = await Promise.all([
    db.task.count({ where: scoped({ dueDate: { lt: now } }) }),
    db.task.count({ where: scoped({ dueDate: { gte: now, lt: week } }) }),
    db.task.count({ where: scoped({ dueDate: { gte: week, lt: month } }) }),
    db.task.count({ where: scoped({ dueDate: null }) }),
    db.task.count({ where: scoped({}) }),
  ]);

  return { overdue, thisWeek, thisMonth, undated, openTotal };
}

/**
 * How each supplier is doing on the things Vionex asked of them.
 *
 * `responseDays` is the mean of `submittedAt − createdAt` over requests this
 * supplier has actually answered. It is null when they have answered none —
 * an average of nothing is not zero, and printing zero would read as
 * "instant".
 */
export async function getSupplierPerformance(user: SessionUser) {
  const now = new Date();

  const requests = await db.documentRequest.findMany({
    where: documentRequestScope(user),
    select: {
      supplierId: true,
      status: true,
      dueDate: true,
      createdAt: true,
      submittedAt: true,
      supplier: { select: { id: true, name: true, country: true } },
    },
  });

  const rows = new Map<
    string,
    {
      id: string;
      name: string;
      country: string;
      open: number;
      overdue: number;
      approved: number;
      changesRequested: number;
      answered: number;
      responseMs: number;
    }
  >();

  for (const request of requests) {
    if (!request.supplier) continue;
    const row = rows.get(request.supplier.id) ?? {
      id: request.supplier.id,
      name: request.supplier.name,
      country: request.supplier.country,
      open: 0,
      overdue: 0,
      approved: 0,
      changesRequested: 0,
      answered: 0,
      responseMs: 0,
    };

    const awaiting = request.status === "PENDING" || request.status === "REJECTED";
    if (awaiting) row.open += 1;
    if (awaiting && request.dueDate && request.dueDate < now) row.overdue += 1;
    if (request.status === "APPROVED") row.approved += 1;
    if (request.status === "REJECTED") row.changesRequested += 1;

    if (request.submittedAt) {
      row.answered += 1;
      row.responseMs += request.submittedAt.getTime() - request.createdAt.getTime();
    }

    rows.set(row.id, row);
  }

  return [...rows.values()]
    .map((row) => ({
      id: row.id,
      name: row.name,
      country: row.country,
      open: row.open,
      overdue: row.overdue,
      approved: row.approved,
      changesRequested: row.changesRequested,
      answered: row.answered,
      responseDays:
        row.answered > 0 ? row.responseMs / row.answered / (1000 * 60 * 60 * 24) : null,
    }))
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));
}

/**
 * The regulatory funnel, plus how many rounds it actually took.
 *
 * `reviewRounds` counts rows in the review history, which only began at the
 * migration that created it — so the caller is told the window start and can
 * say so rather than implying the number covers all time.
 */
export async function getRegulatoryPerformance(user: SessionUser) {
  const now = startOfTodayUtc();
  const scope = documentRequestScope(user);

  const [grouped, overdue, oldestReview, reviewRounds, approvals, changes] = await Promise.all([
    db.documentRequest.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    db.documentRequest.count({
      where: { AND: [scope, { status: { in: ["PENDING", "REJECTED"] }, dueDate: { lt: now } }] },
    }),
    db.documentRequestReview.findFirst({
      where: { request: scope },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.documentRequestReview.count({ where: { request: scope } }),
    db.documentRequestReview.count({ where: { request: scope, decision: "APPROVED" } }),
    db.documentRequestReview.count({ where: { request: scope, decision: "CHANGES_REQUESTED" } }),
  ]);

  const byStatus = new Map<RequestStatus, number>(
    grouped.map((row) => [row.status as RequestStatus, row._count._all]),
  );
  const count = (status: RequestStatus) => byStatus.get(status) ?? 0;

  return {
    pending: count("PENDING"),
    submitted: count("SUBMITTED"),
    inReview: count("IN_REVIEW"),
    approved: count("APPROVED"),
    rejected: count("REJECTED"),
    overdue,
    total: [...byStatus.values()].reduce((sum, value) => sum + value, 0),
    review: {
      rounds: reviewRounds,
      approvals,
      changesRequested: changes,
      /** Null until the first review exists; never back-filled. */
      since: oldestReview?.createdAt ?? null,
    },
  };
}
