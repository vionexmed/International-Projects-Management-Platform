import "server-only";
import { startOfTodayUtc } from "@/lib/format";
import type { Prisma, TaskCategory, TaskPriority, TaskStatus } from "@/generated/prisma";
import { db } from "@/server/db";
import { taskScope } from "@/server/authz/scopes";
import { assertRoleCan } from "@/server/authz/permissions";
import { recordAudit } from "@/server/services/audit";
import { recordTimelineEvent } from "@/server/services/timeline";
import { notify, notifyOnce, supplierRecipients } from "@/server/services/notifications";
import { recalculateProject } from "@/server/services/projects";
import { deriveTaskStatus, type DerivedTaskStatus } from "@/lib/status";
import type { SessionUser } from "@/types/auth";

export type TaskListFilters = {
  query?: string;
  /** "OVERDUE" is a derived view, not a stored status. */
  status?: TaskStatus | "OVERDUE";
  projectId?: string;
  assignedToId?: string;
  supplierId?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  /**
   * Hides tasks that exist only to mirror a document request.
   *
   * The portal shows those in Action Required, where the supplier can actually
   * answer them. Listing them again under Tasks would be the same pendency in
   * two places with two different affordances — one that resolves it and one
   * that does not.
   */
  excludeDocumentRequests?: boolean;
  page?: number;
  perPage?: number;
};

const taskInclude = {
  project: { select: { id: true, name: true, projectCode: true } },
  assignedTo: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

function buildWhere(user: SessionUser, filters: TaskListFilters): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [taskScope(user)];

  if (filters.query) {
    conditions.push({
      OR: [
        { title: { contains: filters.query, mode: "insensitive" } },
        { project: { name: { contains: filters.query, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.status === "OVERDUE") {
    conditions.push({
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      dueDate: { lt: startOfTodayUtc() },
    });
  } else if (filters.status) {
    conditions.push({ status: filters.status });
  }
  if (filters.excludeDocumentRequests) conditions.push({ requests: { none: {} } });
  if (filters.projectId) conditions.push({ projectId: filters.projectId });
  if (filters.assignedToId) conditions.push({ assignedToId: filters.assignedToId });
  if (filters.supplierId) conditions.push({ supplierId: filters.supplierId });
  if (filters.category) conditions.push({ category: filters.category });
  if (filters.priority) conditions.push({ priority: filters.priority });

  return { AND: conditions };
}

export async function listTasks(user: SessionUser, filters: TaskListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 25));
  const where = buildWhere(user, filters);

  const [rows, total] = await Promise.all([
    db.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.task.count({ where }),
  ]);

  const now = new Date();
  const items = rows.map((row) => ({
    ...row,
    derivedStatus: deriveTaskStatus(row.status, row.dueDate, now) as DerivedTaskStatus,
  }));

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Tab counters for /tasks. Overdue is counted with the same rule as the list. */
export async function countTasksByStatus(user: SessionUser) {
  const scope = taskScope(user);
  const now = new Date();

  const [grouped, overdue, total] = await Promise.all([
    db.task.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    db.task.count({
      where: { AND: [scope, { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { lt: now } }] },
    }),
    db.task.count({ where: scope }),
  ]);

  const counts = {
    ALL: total,
    OPEN: 0,
    IN_PROGRESS: 0,
    WAITING: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    OVERDUE: overdue,
  };
  for (const group of grouped) counts[group.status] = group._count._all;
  return counts;
}

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  assignedToId?: string | null;
  /**
   * Marks the task as waiting on the project's supplier, which is also what
   * makes it visible in that supplier's portal. The supplier is always taken
   * from the project, never from the caller.
   */
  waitingOnSupplier?: boolean;
  dueDate?: Date | null;
};

/**
 * Warns about a deadline the moment it becomes true, at the moment the task is
 * written.
 *
 * This is the honest half of "deadline notifications". Assigning somebody work
 * that is already late, or due the day after tomorrow, is an event — and events
 * are what this codebase notifies on. A task that *becomes* due tomorrow simply
 * because a day passed is not an event at all; catching that needs something
 * that wakes up on its own, and pretending otherwise would put a notification
 * in the product that fires for some tasks and silently not for others.
 *
 * So: what can be derived is derived here, and the periodic sweep is written
 * down as a dependency instead of being faked. See
 * `docs/product-completion/06_INTEGRATION_GAPS.md`.
 */
const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;

async function notifyAboutDeadline(task: {
  id: string;
  title: string;
  dueDate: Date | null;
  assignedToId: string | null;
  supplierId: string | null;
}) {
  if (!task.dueDate) return;

  const remaining = task.dueDate.getTime() - Date.now();
  if (remaining > DUE_SOON_MS) return;

  const overdue = remaining < 0;
  const internalRecipients = task.assignedToId ? [task.assignedToId] : [];
  const supplierUsers = task.supplierId ? await supplierRecipients(task.supplierId) : [];

  await notifyOnce({
    userIds: [...internalRecipients, ...supplierUsers],
    type: overdue ? "TASK_OVERDUE" : "TASK_DUE_SOON",
    title: task.title,
    description: overdue ? "O prazo desta tarefa já passou." : "O prazo desta tarefa está próximo.",
    href: `/tasks/${task.id}`,
  });
}

export async function createTask(user: SessionUser, input: CreateTaskInput) {
  assertRoleCan(user.role, "task:create");

  const project = await db.project.findFirst({
    where: { id: input.projectId, organizationId: user.organizationId },
    select: { id: true, name: true, supplierId: true },
  });
  if (!project) throw new Error("Projeto inválido.");

  const supplierId = input.waitingOnSupplier ? project.supplierId : null;

  const task = await db.task.create({
    data: {
      organizationId: user.organizationId,
      projectId: project.id,
      createdById: user.id,
      assignedToId: input.assignedToId ?? null,
      supplierId,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      dueDate: input.dueDate,
    },
  });

  await recordTimelineEvent({
    projectId: project.id,
    actorId: user.id,
    type: "TASK_CREATED",
    description: `Tarefa "${task.title}" criada.`,
    /**
     * A task with no supplier is Vionex's own work, and its title routinely
     * says something the supplier is not meant to read. Only work that is
     * explicitly waiting on them belongs in their timeline.
     */
    internal: !task.supplierId,
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "task.create",
    entity: "Task",
    entityId: task.id,
    metadata: { projectId: project.id },
  });

  if (task.assignedToId && task.assignedToId !== user.id) {
    await notify({
      userIds: [task.assignedToId],
      type: "TASK_ASSIGNED",
      title: task.title,
      description: `Nova tarefa em ${project.name}.`,
      href: `/tasks/${task.id}`,
    });
  }

  /**
   * Work that waits on the supplier has to reach the supplier. The task row
   * was already visible to them through `taskScope`; nobody was ever told it
   * existed.
   */
  if (task.supplierId) {
    await notify({
      userIds: await supplierRecipients(task.supplierId),
      type: "TASK_ASSIGNED",
      title: task.title,
      description: `Vionex is waiting on you in ${project.name}.`,
      href: `/supplier/projects/${project.id}`,
    });
  }

  await notifyAboutDeadline(task);

  await recalculateProject(project.id, user.id);
  return task;
}

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignedToId?: string | null;
  waitingOnSupplier?: boolean;
  dueDate?: Date | null;
};

export async function updateTask(user: SessionUser, taskId: string, input: UpdateTaskInput) {
  assertRoleCan(user.role, "task:update");

  const existing = await db.task.findFirst({
    where: { AND: [taskScope(user), { id: taskId }] },
    include: { project: { select: { id: true, name: true, supplierId: true } } },
  });
  if (!existing) throw new Error("Tarefa não encontrada.");

  const statusChanged = input.status !== undefined && input.status !== existing.status;

  const { waitingOnSupplier, ...fields } = input;

  const task = await db.task.update({
    where: { id: taskId },
    data: {
      ...fields,
      supplierId:
        waitingOnSupplier === undefined
          ? undefined
          : waitingOnSupplier
            ? existing.project.supplierId
            : null,
      completedAt:
        input.status === "COMPLETED"
          ? (existing.completedAt ?? new Date())
          : input.status !== undefined
            ? null
            : undefined,
    },
  });

  if (statusChanged) {
    await recordTimelineEvent({
      projectId: existing.projectId,
      actorId: user.id,
      type: input.status === "COMPLETED" ? "TASK_COMPLETED" : "TASK_UPDATED",
      description:
        input.status === "COMPLETED"
          ? `Tarefa "${task.title}" concluída.`
          : `Tarefa "${task.title}" atualizada.`,
      metadata: { from: existing.status, to: task.status },
      internal: !task.supplierId,
    });
  }

  await recordAudit({
    organizationId: existing.organizationId,
    actorId: user.id,
    action: statusChanged ? "task.status_change" : "task.update",
    entity: "Task",
    entityId: task.id,
    metadata: statusChanged ? { from: existing.status, to: task.status } : { fields: Object.keys(input) },
  });

  if (input.assignedToId && input.assignedToId !== existing.assignedToId && input.assignedToId !== user.id) {
    await notify({
      userIds: [input.assignedToId],
      type: "TASK_ASSIGNED",
      title: task.title,
      description: `Tarefa atribuída a você em ${existing.project.name}.`,
      href: `/tasks/${task.id}`,
    });
  }

  // Only when the deadline itself moved — editing a title should not ring a
  // bell about a date nobody touched. `notifyOnce` absorbs the rest.
  if (input.dueDate !== undefined && task.status !== "COMPLETED" && task.status !== "CANCELLED") {
    await notifyAboutDeadline(task);
  }

  await recalculateProject(existing.projectId, user.id);
  return task;
}

export async function addTaskComment(
  user: SessionUser,
  taskId: string,
  body: string,
  internal = true,
) {
  // Commenting changes the task's record, so it is a write like any other.
  assertRoleCan(user.role, "task:update");

  const task = await db.task.findFirst({
    where: { AND: [taskScope(user), { id: taskId }] },
    select: {
      id: true,
      title: true,
      projectId: true,
      organizationId: true,
      assignedToId: true,
      createdById: true,
    },
  });
  if (!task) throw new Error("Tarefa não encontrada.");

  const comment = await db.taskComment.create({
    data: { taskId: task.id, authorId: user.id, body, internal },
  });

  await recordTimelineEvent({
    projectId: task.projectId,
    actorId: user.id,
    type: "COMMENT_ADDED",
    description: `Comentário adicionado em "${task.title}".`,
    internal,
  });

  await recordAudit({
    organizationId: task.organizationId,
    actorId: user.id,
    action: "task.comment",
    entity: "Task",
    entityId: task.id,
  });

  /**
   * An internal comment must not reach the supplier through the back door.
   * The comment row is already hidden from them, but the notification was
   * being sent unconditionally — so if the task happened to be assigned to a
   * supplier user, the author and the task title arrived anyway.
   */
  const commentRecipients = await db.user.findMany({
    where: {
      id: {
        in: [task.assignedToId, task.createdById].filter(
          (id): id is string => Boolean(id) && id !== user.id,
        ),
      },
      ...(internal ? { supplierId: null } : {}),
    },
    select: { id: true },
  });

  await notify({
    userIds: commentRecipients.map((recipient) => recipient.id),
    type: "COMMENT_ADDED",
    title: task.title,
    description: `${user.name} comentou na tarefa.`,
    href: `/tasks/${task.id}`,
  });

  return comment;
}

export async function listTaskComments(taskId: string, includeInternal: boolean) {
  return db.taskComment.findMany({
    where: { taskId, ...(includeInternal ? {} : { internal: false }) },
    include: { author: { select: { id: true, name: true, jobTitle: true } } },
    orderBy: { createdAt: "asc" },
  });
}
