import "server-only";
import { startOfTodayUtc } from "@/lib/format";
import { db } from "@/server/db";
import {
  documentRequestScope,
  projectScope,
  taskScope,
} from "@/server/authz/scopes";
import { isSupplierRole } from "@/types/auth";
import type { SessionUser } from "@/types/auth";

/**
 * Exceptions — the things that are *not* going according to plan.
 *
 * This is the one query behind "needs your attention", and it exists because
 * the dashboard used to answer that question by listing projects again, with
 * the same columns as `/projects`. A list of everything is not an answer to
 * "what needs me"; a list of exceptions is.
 *
 * Deliberately not a canonical list. It is capped, it carries no filters and
 * no pagination, and every item points at the page that actually resolves it.
 * The moment somebody wants to work through these in bulk, the right screen is
 * `/tasks`, `/regulatory` or `/projects` — which is what "ver todos" links to.
 */

export type AttentionKind =
  | "TASK_OVERDUE"
  | "REQUEST_OVERDUE"
  | "REVIEW_WAITING"
  | "MILESTONE_DELAYED"
  | "PROJECT_BLOCKED";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  /** What is wrong, in the user's own words rather than a status code. */
  description: string;
  project: { id: string; name: string };
  /** Who the ball is with. Null when nobody has been named. */
  responsible: string | null;
  dueDate: Date | null;
  /** `risk` is late or blocked; `warn` is heading that way. */
  severity: "risk" | "warn";
  /** Where the item is resolved — never a dead end. */
  href: string;
};

/** Severity first, then the oldest deadline: the worst thing sits on top. */
function rank(item: AttentionItem) {
  const base = item.severity === "risk" ? 0 : 1_000_000_000_000_000;
  return base + (item.dueDate ? item.dueDate.getTime() : Number.MAX_SAFE_INTEGER / 2);
}

/**
 * Every source is read through its own scope, so a supplier session sees only
 * its own company's exceptions and never an internal-only one. The supplier
 * portal has its own queue and does not call this, but the scoping is written
 * as though it did — a guard that depends on its caller is not a guard.
 */
export async function listAttentionItems(user: SessionUser, take = 6) {
  // Overdue means "before today", on the same UTC day boundary the screen
  // renders — otherwise a deadline is late in the query and on time on screen.
  const now = startOfTodayUtc();
  const internal = !isSupplierRole(user.role);

  const [overdueTasks, overdueRequests, waitingReviews, delayedMilestones, blockedProjects] =
    await Promise.all([
      db.task.findMany({
        where: {
          AND: [
            taskScope(user),
            {
              status: { notIn: ["COMPLETED", "CANCELLED"] },
              dueDate: { lt: now },
              // The mirror task of a document request is the same pendency as
              // the request itself, and the request is the row that can be
              // acted on. Showing both is how one problem becomes two.
              requests: { none: {} },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
          assignedTo: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { dueDate: "asc" },
        take,
      }),

      db.documentRequest.findMany({
        where: {
          AND: [
            documentRequestScope(user),
            { status: { in: ["PENDING", "REJECTED"] }, dueDate: { lt: now } },
          ],
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { dueDate: "asc" },
        take,
      }),

      // Waiting on Vionex, not on the supplier — so it is an internal-only
      // exception, and the portal would have nothing to do with it anyway.
      internal
        ? db.documentRequest.findMany({
            where: {
              AND: [documentRequestScope(user), { status: { in: ["SUBMITTED", "IN_REVIEW"] } }],
            },
            select: {
              id: true,
              title: true,
              submittedAt: true,
              projectId: true,
              project: { select: { id: true, name: true } },
              requestedBy: { select: { name: true } },
            },
            orderBy: { submittedAt: "asc" },
            take,
          })
        : Promise.resolve([]),

      db.milestone.findMany({
        where: { project: projectScope(user), status: "DELAYED" },
        select: {
          id: true,
          title: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: "asc" },
        take,
      }),

      db.project.findMany({
        where: { AND: [projectScope(user), { status: "BLOCKED" }] },
        select: {
          id: true,
          name: true,
          blockerNote: true,
          owner: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take,
      }),
    ]);

  const projectHref = internal ? "/projects" : "/supplier/projects";

  const items: AttentionItem[] = [
    ...overdueTasks.map((task) => ({
      id: `task:${task.id}`,
      kind: "TASK_OVERDUE" as const,
      description: task.title,
      project: task.project,
      responsible: task.assignedTo?.name ?? task.supplier?.name ?? null,
      dueDate: task.dueDate,
      severity: "risk" as const,
      href: internal ? `/tasks/${task.id}` : `/supplier/action-required`,
    })),

    ...overdueRequests.map((request) => ({
      id: `request:${request.id}`,
      kind: "REQUEST_OVERDUE" as const,
      description: request.title,
      project: request.project,
      responsible: request.supplier?.name ?? null,
      dueDate: request.dueDate,
      severity: "risk" as const,
      href: internal
        ? `/projects/${request.projectId}/regulatory`
        : `/supplier/action-required/${request.id}`,
    })),

    ...waitingReviews.map((request) => ({
      id: `review:${request.id}`,
      kind: "REVIEW_WAITING" as const,
      description: request.title,
      project: request.project,
      responsible: request.requestedBy?.name ?? null,
      dueDate: request.submittedAt,
      severity: "warn" as const,
      href: `/projects/${request.projectId}/regulatory`,
    })),

    ...delayedMilestones.map((milestone) => ({
      id: `milestone:${milestone.id}`,
      kind: "MILESTONE_DELAYED" as const,
      description: milestone.title,
      project: milestone.project,
      responsible: null,
      dueDate: milestone.dueDate,
      severity: "warn" as const,
      href: `${projectHref}/${milestone.project.id}`,
    })),

    ...blockedProjects.map((project) => ({
      id: `project:${project.id}`,
      kind: "PROJECT_BLOCKED" as const,
      description: project.blockerNote ?? project.name,
      project: { id: project.id, name: project.name },
      responsible: project.owner?.name ?? null,
      dueDate: null,
      severity: "risk" as const,
      href: `${projectHref}/${project.id}`,
    })),
  ];

  return items.sort((a, b) => rank(a) - rank(b)).slice(0, take);
}

/**
 * How many exceptions exist in total, per kind.
 *
 * The dashboard shows a handful and says how many there are; without the count
 * the cap would quietly hide the scale of a problem, which is the opposite of
 * what a triage screen is for.
 */
export async function countAttentionItems(user: SessionUser) {
  const now = startOfTodayUtc();
  const internal = !isSupplierRole(user.role);

  const [tasks, requests, reviews, milestones, projects] = await Promise.all([
    db.task.count({
      where: {
        AND: [
          taskScope(user),
          {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            dueDate: { lt: now },
            requests: { none: {} },
          },
        ],
      },
    }),
    db.documentRequest.count({
      where: {
        AND: [
          documentRequestScope(user),
          { status: { in: ["PENDING", "REJECTED"] }, dueDate: { lt: now } },
        ],
      },
    }),
    internal
      ? db.documentRequest.count({
          where: {
            AND: [documentRequestScope(user), { status: { in: ["SUBMITTED", "IN_REVIEW"] } }],
          },
        })
      : Promise.resolve(0),
    db.milestone.count({ where: { project: projectScope(user), status: "DELAYED" } }),
    db.project.count({ where: { AND: [projectScope(user), { status: "BLOCKED" }] } }),
  ]);

  return {
    tasks,
    requests,
    reviews,
    milestones,
    projects,
    total: tasks + requests + reviews + milestones + projects,
  };
}
