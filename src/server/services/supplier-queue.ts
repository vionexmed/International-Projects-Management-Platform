import "server-only";
import { db } from "@/server/db";
import { documentRequestScope, taskScope } from "@/server/authz/scopes";
import { isSupplierRole } from "@/types/auth";
import type { RequestStatus } from "@/generated/prisma";
import type { SessionUser } from "@/types/auth";

/**
 * Everything Vionex is waiting on from this supplier, as one queue.
 *
 * The platform stores two things: a `DocumentRequest`, which the supplier
 * answers by uploading a file, and a `Task`, which Vionex tracks on their
 * behalf. That distinction is real in the database and meaningless to the
 * person reading it — from the outside both are "something Vionex needs from
 * me", and asking a manufacturer to learn our data model to find their work is
 * the wrong end of the deal.
 *
 * So the models stay separate and the *experience* is unified. Nothing here
 * merges rows or writes anything; it reads both sources through their own
 * scopes and returns one sorted list.
 *
 * The mirror task of a document request is excluded, always. It is the same
 * pendency as the request, and only the request can actually be resolved — a
 * supplier who sees both has been given one job twice, once in a place that
 * does nothing.
 */

export type QueueType = "DOCUMENT" | "TASK";

export type QueueItem = {
  id: string;
  type: QueueType;
  title: string;
  project: { id: string; name: string };
  dueDate: Date | null;
  /** `open` is waiting on the supplier; `waiting` on Vionex; `done` is closed. */
  state: "open" | "waiting" | "done";
  /** Raw status for the badge, when the item is a document request. */
  requestStatus: RequestStatus | null;
  /** Where the supplier acts on it. */
  href: string;
};

/** Undated work sinks below dated work; otherwise the nearest date wins. */
function byDueDate(a: QueueItem, b: QueueItem) {
  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.title.localeCompare(b.title);
}

export async function listSupplierQueue(user: SessionUser) {
  // A defensive check, not a formality: everything below is written for the
  // portal's audience, and an internal session reaching it would be a bug
  // worth failing on rather than silently serving.
  if (!isSupplierRole(user.role)) {
    throw new Error("A fila do fornecedor é exclusiva do portal.");
  }

  const [requests, tasks] = await Promise.all([
    db.documentRequest.findMany({
      where: documentRequestScope(user),
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),

    db.task.findMany({
      where: {
        AND: [
          taskScope(user),
          // Excludes the mirror tasks: they belong to the requests above.
          { requests: { none: {} } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),
  ]);

  const items: QueueItem[] = [
    ...requests.map((request) => ({
      id: `request:${request.id}`,
      type: "DOCUMENT" as const,
      title: request.title,
      project: request.project,
      dueDate: request.dueDate,
      state:
        request.status === "PENDING" || request.status === "REJECTED"
          ? ("open" as const)
          : request.status === "APPROVED"
            ? ("done" as const)
            : ("waiting" as const),
      requestStatus: request.status,
      href: `/supplier/action-required/${request.id}`,
    })),

    ...tasks.map((task) => ({
      id: `task:${task.id}`,
      type: "TASK" as const,
      title: task.title,
      project: task.project,
      dueDate: task.dueDate,
      state:
        task.status === "COMPLETED" || task.status === "CANCELLED"
          ? ("done" as const)
          : ("open" as const),
      requestStatus: null,
      // A task has no page of its own in the portal — it is not something the
      // supplier submits — so it opens the project it belongs to.
      href: `/supplier/projects/${task.project.id}`,
    })),
  ];

  const open = items.filter((item) => item.state === "open").sort(byDueDate);
  const waiting = items.filter((item) => item.state === "waiting").sort(byDueDate);
  const done = items.filter((item) => item.state === "done").sort(byDueDate);

  return { open, waiting, done };
}

/**
 * How many things are actually waiting on the supplier.
 *
 * Used by the navigation badge and the portal home, both of which must agree
 * with the queue — a badge that counts differently from the list it points at
 * is worse than no badge.
 */
export async function countSupplierQueue(user: SessionUser) {
  if (!isSupplierRole(user.role)) return { open: 0, nextDueDate: null };

  const [requests, tasks, nextRequest, nextTask] = await Promise.all([
    db.documentRequest.count({
      where: { AND: [documentRequestScope(user), { status: { in: ["PENDING", "REJECTED"] } }] },
    }),
    db.task.count({
      where: {
        AND: [
          taskScope(user),
          { requests: { none: {} }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        ],
      },
    }),
    db.documentRequest.findFirst({
      where: {
        AND: [
          documentRequestScope(user),
          { status: { in: ["PENDING", "REJECTED"] }, dueDate: { not: null } },
        ],
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true },
    }),
    db.task.findFirst({
      where: {
        AND: [
          taskScope(user),
          {
            requests: { none: {} },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            dueDate: { not: null },
          },
        ],
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true },
    }),
  ]);

  const dates = [nextRequest?.dueDate, nextTask?.dueDate].filter((date): date is Date =>
    Boolean(date),
  );

  return {
    open: requests + tasks,
    nextDueDate: dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
  };
}
