import "server-only";
import type { Prisma, ProjectStatus, StageKey } from "@/generated/prisma";
import { db } from "@/server/db";
import { projectScope } from "@/server/authz/scopes";
import { requireProjectAccess } from "@/server/authz/access";
import { recordTimelineEvent } from "@/server/services/timeline";
import { recordAudit } from "@/server/services/audit";
import {
  STAGE_ORDER,
  deriveCurrentStage,
  deriveProjectStatus,
  projectProgress,
  stageProgress,
  type StageSnapshot,
  type TaskSnapshot,
} from "@/server/services/project-health";
import type { SessionUser } from "@/types/auth";

const STAGE_NAMES: Record<StageKey, string> = {
  CLINICAL: "Clinical",
  REGULATORY: "Regulatory",
  IMPORT_LOGISTICS: "Import & Logistics",
  GO_TO_MARKET: "Go-to-Market",
};

export type ProjectListFilters = {
  query?: string;
  status?: ProjectStatus;
  supplierId?: string;
  ownerId?: string;
  stage?: StageKey;
  country?: string;
  page?: number;
  perPage?: number;
};

export type ProjectListRow = {
  id: string;
  name: string;
  projectCode: string;
  status: ProjectStatus;
  currentStage: StageKey;
  country: string;
  targetLaunchDate: Date | null;
  supplier: { id: string; name: string; country: string };
  owner: { id: string; name: string };
  progress: number;
  nextMilestone: { title: string; dueDate: Date | null } | null;
};

/** Selection shared by list and detail so progress is computed identically. */
const listInclude = {
  supplier: { select: { id: true, name: true, country: true } },
  owner: { select: { id: true, name: true } },
  stages: { select: { key: true, status: true, progress: true } },
  tasks: { select: { category: true, status: true, priority: true, dueDate: true } },
  milestones: {
    where: { status: { in: ["PLANNED", "IN_PROGRESS", "DELAYED"] as const } },
    orderBy: [{ dueDate: "asc" }, { position: "asc" }] as const,
    take: 1,
    select: { title: true, dueDate: true },
  },
} satisfies Prisma.ProjectInclude;

function buildWhere(user: SessionUser, filters: ProjectListFilters): Prisma.ProjectWhereInput {
  const conditions: Prisma.ProjectWhereInput[] = [projectScope(user)];

  if (filters.query) {
    conditions.push({
      OR: [
        { name: { contains: filters.query, mode: "insensitive" } },
        { projectCode: { contains: filters.query, mode: "insensitive" } },
        { supplier: { name: { contains: filters.query, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.supplierId) conditions.push({ supplierId: filters.supplierId });
  if (filters.ownerId) conditions.push({ ownerId: filters.ownerId });
  if (filters.stage) conditions.push({ currentStage: filters.stage });
  if (filters.country) conditions.push({ country: filters.country });

  return { AND: conditions };
}

export async function listProjects(user: SessionUser, filters: ProjectListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 25));
  const where = buildWhere(user, filters);

  const [rows, total] = await Promise.all([
    db.project.findMany({
      where,
      include: listInclude,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.project.count({ where }),
  ]);

  const items: ProjectListRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    projectCode: row.projectCode,
    status: row.status,
    currentStage: row.currentStage,
    country: row.country,
    targetLaunchDate: row.targetLaunchDate,
    supplier: row.supplier,
    owner: row.owner,
    progress: projectProgress(row.stages as StageSnapshot[], row.tasks as TaskSnapshot[]),
    nextMilestone: row.milestones[0] ?? null,
  }));

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Counts for the portfolio tabs, computed in one round trip. */
export async function countProjectsByStatus(user: SessionUser) {
  const grouped = await db.project.groupBy({
    by: ["status"],
    where: projectScope(user),
    _count: { _all: true },
  });

  const counts: Record<ProjectStatus | "ALL", number> = {
    ALL: 0,
    ON_TRACK: 0,
    AT_RISK: 0,
    BLOCKED: 0,
    COMPLETED: 0,
  };

  for (const group of grouped) {
    counts[group.status] = group._count._all;
    counts.ALL += group._count._all;
  }
  return counts;
}

export async function getProjectWorkspace(user: SessionUser, projectId: string) {
  const project = await requireProjectAccess(user, projectId);

  const [stages, tasks, milestones] = await Promise.all([
    db.projectStage.findMany({ where: { projectId }, orderBy: { position: "asc" } }),
    db.task.findMany({
      where: { projectId },
      select: { category: true, status: true, priority: true, dueDate: true },
    }),
    db.milestone.findMany({
      where: { projectId },
      orderBy: [{ position: "asc" }, { dueDate: "asc" }],
    }),
  ]);

  const snapshots = stages as StageSnapshot[];
  const taskSnapshots = tasks as TaskSnapshot[];

  return {
    project,
    milestones,
    stages: stages.map((stage) => ({
      ...stage,
      computedProgress: stageProgress(stage as StageSnapshot, taskSnapshots),
    })),
    progress: projectProgress(snapshots, taskSnapshots),
  };
}

export type CreateProjectInput = {
  name: string;
  projectCode: string;
  supplierId: string;
  ownerId: string;
  country: string;
  productType?: string | null;
  category?: string | null;
  description?: string | null;
  startDate?: Date | null;
  targetLaunchDate?: Date | null;
};

/**
 * Creating a project also creates its four stages (§11) and opens the
 * timeline, in one transaction so a project can never exist without them.
 */
export async function createProject(user: SessionUser, input: CreateProjectInput) {
  const project = await db.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: input.supplierId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!supplier) throw new Error("Fornecedor inválido.");

    const owner = await tx.user.findFirst({
      where: { id: input.ownerId, organizationId: user.organizationId, supplierId: null },
      select: { id: true },
    });
    if (!owner) throw new Error("Responsável inválido.");

    const created = await tx.project.create({
      data: {
        organizationId: user.organizationId,
        supplierId: input.supplierId,
        ownerId: input.ownerId,
        name: input.name,
        projectCode: input.projectCode,
        country: input.country,
        productType: input.productType,
        category: input.category,
        description: input.description,
        startDate: input.startDate,
        targetLaunchDate: input.targetLaunchDate,
        stages: {
          create: STAGE_ORDER.map((key, index) => ({
            key,
            name: STAGE_NAMES[key],
            position: index,
            status: index === 0 ? "IN_PROGRESS" : "NOT_STARTED",
          })),
        },
      },
    });

    await recordTimelineEvent({
      projectId: created.id,
      actorId: user.id,
      type: "PROJECT_CREATED",
      description: `Projeto ${created.name} criado.`,
      client: tx,
    });

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "project.create",
      entity: "Project",
      entityId: created.id,
      metadata: { projectCode: created.projectCode },
      client: tx,
    });

    return created;
  });

  return project;
}

/**
 * Re-derives status and current stage from the project's own data. Called
 * after any mutation that can change them, so the portfolio view never drifts
 * from the underlying tasks.
 */
export async function recalculateProject(projectId: string, actorId: string | null) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      status: true,
      currentStage: true,
      blockerNote: true,
      stages: { select: { key: true, status: true, progress: true } },
      tasks: { select: { category: true, status: true, priority: true, dueDate: true } },
    },
  });
  if (!project) return;

  const stages = project.stages as StageSnapshot[];
  const tasks = project.tasks as TaskSnapshot[];

  const nextStatus = deriveProjectStatus({
    currentStatus: project.status,
    hasExplicitBlocker: Boolean(project.blockerNote?.trim()),
    stages,
    tasks,
  });
  const nextStage = deriveCurrentStage(stages);

  if (nextStatus === project.status && nextStage === project.currentStage) return;

  await db.project.update({
    where: { id: project.id },
    data: { status: nextStatus, currentStage: nextStage },
  });

  if (nextStatus !== project.status) {
    await recordTimelineEvent({
      projectId: project.id,
      actorId,
      type: "STATUS_CHANGED",
      description: `Status do projeto alterado para ${nextStatus.replace("_", " ").toLowerCase()}.`,
      metadata: { from: project.status, to: nextStatus },
    });
    await recordAudit({
      organizationId: project.organizationId,
      actorId,
      action: "project.status_change",
      entity: "Project",
      entityId: project.id,
      metadata: { from: project.status, to: nextStatus },
    });
  }
}

/** Distinct countries present in the portfolio, for the filter dropdown. */
export async function listProjectCountries(user: SessionUser) {
  const rows = await db.project.findMany({
    where: projectScope(user),
    select: { country: true },
    distinct: ["country"],
    orderBy: { country: "asc" },
  });
  return rows.map((row) => row.country);
}
