import "server-only";
import { db } from "@/server/db";
import { documentRequestScope, documentScope, projectScope, supplierScope, taskScope } from "@/server/authz/scopes";
import { getProjectWorkspace, listProjects, type ProjectListRow } from "@/server/services/projects";
import { getSupplierPerformance } from "@/server/services/analytics";
import { listProjectTimeline } from "@/server/services/timeline";
import { STAGE_TASK_CATEGORY } from "@/server/services/project-health";
import { startOfTodayUtc } from "@/lib/format";
import type { SessionUser } from "@/types/auth";

/**
 * Reports: the health of every project with its reason in words, and a full
 * report for one project or one company. Read-only, through the same scopes
 * as every screen.
 */

const OPEN_TASK = { status: { notIn: ["COMPLETED", "CANCELLED"] as ("COMPLETED" | "CANCELLED")[] } };
const OWED = ["PENDING", "REJECTED"] as const;

export type HealthRow = ProjectListRow & {
  overdue: number;
  criticalOverdue: number;
  owed: number;
  blockerNote: string | null;
  /** Why the project reads the way it does, in one short sentence. */
  reason: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The reason always explains the status shown beside it, in the order the
 * health rule weighs things; when nothing in the data accounts for it, it
 * says the status was set by hand rather than inventing a cause.
 */
function reasonFor(input: {
  status: string;
  blockerNote: string | null;
  blockedStages: number;
  overdue: number;
  criticalOverdue: number;
  delayedMilestones: number;
  owed: number;
}): string {
  const late = input.criticalOverdue
    ? plural(input.criticalOverdue, "tarefa crítica atrasada", "tarefas críticas atrasadas")
    : input.overdue
      ? plural(input.overdue, "tarefa atrasada", "tarefas atrasadas")
      : null;
  const milestones = input.delayedMilestones ? plural(input.delayedMilestones, "marco atrasado", "marcos atrasados") : null;
  const owed = input.owed ? plural(input.owed, "documento aguardando o fornecedor", "documentos aguardando o fornecedor") : null;

  switch (input.status) {
    case "BLOCKED":
      if (input.blockerNote) return `Bloqueio: ${input.blockerNote}`;
      if (input.blockedStages) return input.blockedStages === 1 ? "Uma etapa marcada como bloqueada." : `${input.blockedStages} etapas bloqueadas.`;
      return "Marcado como bloqueado pela equipe.";
    case "AT_RISK": {
      const causes = [late, milestones].filter(Boolean);
      if (causes.length) return `${causes.join(" e ")}.`.replace(/^./, (c) => c.toUpperCase());
      return owed ? `Marcado como em risco; ${owed}.` : "Marcado como em risco pela equipe.";
    }
    case "COMPLETED":
      return "Todas as etapas concluídas.";
    default: {
      const watch = [late, milestones, owed].filter(Boolean);
      return watch.length ? `Em dia; ${watch.join(", ")}.` : "Sem atrasos nem pendências.";
    }
  }
}

/** Every active project with its health, the counts behind it and the reason. */
export async function listProjectHealth(user: SessionUser): Promise<HealthRow[]> {
  const today = startOfTodayUtc();
  const [projects, overdue, critical, owed, delayed, blockers] = await Promise.all([
    listProjects(user, { perPage: 100 }),
    db.task.groupBy({
      by: ["projectId"],
      where: { AND: [taskScope(user), { project: projectScope(user) }, OPEN_TASK, { dueDate: { lt: today } }] },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["projectId"],
      where: { AND: [taskScope(user), { project: projectScope(user) }, OPEN_TASK, { dueDate: { lt: today } }, { priority: { in: ["HIGH", "URGENT"] } }] },
      _count: { _all: true },
    }),
    db.documentRequest.groupBy({
      by: ["projectId"],
      where: { AND: [documentRequestScope(user), { project: projectScope(user) }, { status: { in: [...OWED] } }] },
      _count: { _all: true },
    }),
    db.milestone.groupBy({
      by: ["projectId"],
      where: { AND: [{ project: projectScope(user) }, { OR: [{ status: "DELAYED" }, { status: { in: ["PLANNED", "IN_PROGRESS"] }, dueDate: { lt: today } }] }] },
      _count: { _all: true },
    }),
    db.project.findMany({ where: projectScope(user), select: { id: true, blockerNote: true } }),
  ]);
  const count = (rows: { projectId: string; _count: { _all: number } }[]) => new Map(rows.map((row) => [row.projectId, row._count._all]));
  const overdueBy = count(overdue);
  const criticalBy = count(critical);
  const owedBy = count(owed);
  const delayedBy = count(delayed);
  const blockerBy = new Map(blockers.map((row) => [row.id, row.blockerNote?.trim() || null]));

  const order: Record<string, number> = { BLOCKED: 0, AT_RISK: 1, ON_TRACK: 2, COMPLETED: 3 };
  return projects.items
    .map((project) => {
      const row = {
        ...project,
        overdue: overdueBy.get(project.id) ?? 0,
        criticalOverdue: criticalBy.get(project.id) ?? 0,
        owed: owedBy.get(project.id) ?? 0,
        blockerNote: blockerBy.get(project.id) ?? null,
      };
      return {
        ...row,
        reason: reasonFor({
          status: project.status,
          blockerNote: row.blockerNote,
          blockedStages: project.stages.filter((stage) => stage.status === "BLOCKED").length,
          overdue: row.overdue,
          criticalOverdue: row.criticalOverdue,
          delayedMilestones: delayedBy.get(project.id) ?? 0,
          owed: row.owed,
        }),
      };
    })
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name, "pt-BR"));
}

/** One project, everything a report on it needs. Null when out of reach. */
export async function getProjectReport(user: SessionUser, projectId: string) {
  const health = (await listProjectHealth(user)).find((row) => row.id === projectId);
  if (!health) return null;
  const today = startOfTodayUtc();
  const [workspace, tasks, requests, documents, timeline] = await Promise.all([
    getProjectWorkspace(user, projectId),
    db.task.findMany({
      where: { AND: [taskScope(user), { projectId }] },
      select: { id: true, title: true, category: true, status: true, priority: true, dueDate: true, assignedTo: { select: { name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    }),
    db.documentRequest.findMany({
      where: { AND: [documentRequestScope(user), { projectId }] },
      select: { id: true, title: true, status: true, dueDate: true, submittedAt: true, reviewedAt: true },
      orderBy: [{ createdAt: "asc" }],
    }),
    db.document.findMany({
      where: { AND: [documentScope(user), { projectId }] },
      select: { id: true, name: true, type: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    listProjectTimeline(user, projectId, 8),
  ]);
  const open = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
  const late = open.filter((task) => task.dueDate && task.dueDate < today);
  const stages = workspace.stages.map((stage) => {
    const stageTasks = tasks.filter((task) => task.category === STAGE_TASK_CATEGORY[stage.key] && task.status !== "CANCELLED");
    return { ...stage, done: stageTasks.filter((task) => task.status === "COMPLETED").length, total: stageTasks.length };
  });
  return { health, project: workspace.project, stages, milestones: workspace.milestones, open, late, requests, documents, timeline };
}

/** One company: its projects' health, what it owes, what it sent, how fast it answers. */
export async function getSupplierReport(user: SessionUser, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: { AND: [supplierScope(user), { id: supplierId }] },
    select: { id: true, name: true, country: true, primaryContact: true, email: true },
  });
  if (!supplier) return null;
  const [health, performance, owed, received] = await Promise.all([
    listProjectHealth(user),
    getSupplierPerformance(user),
    db.documentRequest.findMany({
      where: { AND: [documentRequestScope(user), { supplierId, status: { in: [...OWED] } }] },
      select: { id: true, title: true, status: true, dueDate: true, project: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    }),
    db.document.findMany({
      where: { AND: [documentScope(user), { project: { supplierId } }] },
      select: { id: true, name: true, status: true, updatedAt: true, project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);
  return {
    supplier,
    projects: health.filter((row) => row.supplier.id === supplierId),
    performance: performance.find((row) => row.id === supplierId) ?? null,
    owed,
    received,
  };
}
