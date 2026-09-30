import "server-only";
import { db } from "@/server/db";
import { documentRequestScope, documentScope, projectScope, supplierScope } from "@/server/authz/scopes";
import { listDocuments } from "@/server/services/documents";
import type { SessionUser } from "@/types/auth";

/**
 * The regulatory area read as folders: supplier → project → documents.
 *
 * Nothing is moved or copied to produce them. A supplier's folder is every
 * document filed on that supplier's projects, exactly the set `/documents`
 * shows for its supplier filter; every query goes through the same scopes as
 * the rest of the application.
 */

const WAITING_SUPPLIER = ["PENDING", "REJECTED"] as const;
const WAITING_REVIEW = ["SUBMITTED", "IN_REVIEW"] as const;

export type SupplierFolder = {
  id: string;
  name: string;
  country: string;
  projectCount: number;
  documentCount: number;
  awaitingSupplier: number;
  awaitingReview: number;
  updatedAt: Date | null;
};

type CountRow = { key: string | null; count: number };

function tally(rows: CountRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) if (row.key) totals.set(row.key, (totals.get(row.key) ?? 0) + row.count);
  return totals;
}

/** One folder per supplier, with what is inside it and what is still owed. */
export async function listSupplierFolders(user: SessionUser): Promise<SupplierFolder[]> {
  const suppliers = await db.supplier.findMany({
    where: supplierScope(user),
    select: { id: true, name: true, country: true },
    orderBy: { name: "asc" },
  });
  const ids = suppliers.map((supplier) => supplier.id);
  if (ids.length === 0) return [];

  const [projects, documents, supplierWait, reviewWait] = await Promise.all([
    db.project.findMany({
      where: { AND: [projectScope(user), { supplierId: { in: ids } }] },
      select: { id: true, supplierId: true },
    }),
    db.document.groupBy({
      by: ["projectId"],
      where: { AND: [documentScope(user), { project: { supplierId: { in: ids } } }] },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    db.documentRequest.groupBy({
      by: ["supplierId"],
      where: { AND: [documentRequestScope(user), { supplierId: { in: ids }, status: { in: [...WAITING_SUPPLIER] } }] },
      _count: { _all: true },
    }),
    db.documentRequest.groupBy({
      by: ["supplierId"],
      where: { AND: [documentRequestScope(user), { supplierId: { in: ids }, status: { in: [...WAITING_REVIEW] } }] },
      _count: { _all: true },
    }),
  ]);

  const supplierOf = new Map(projects.map((project) => [project.id, project.supplierId]));
  const projectCounts = tally(projects.map((project) => ({ key: project.supplierId, count: 1 })));
  const documentCounts = tally(documents.map((row) => ({ key: supplierOf.get(row.projectId) ?? null, count: row._count._all })));
  const latest = new Map<string, Date>();
  for (const row of documents) {
    const supplierId = supplierOf.get(row.projectId);
    const updated = row._max.updatedAt;
    if (!supplierId || !updated) continue;
    const current = latest.get(supplierId);
    if (!current || updated > current) latest.set(supplierId, updated);
  }
  const waiting = tally(supplierWait.map((row) => ({ key: row.supplierId, count: row._count._all })));
  const review = tally(reviewWait.map((row) => ({ key: row.supplierId, count: row._count._all })));

  return suppliers.map((supplier) => ({
    ...supplier,
    projectCount: projectCounts.get(supplier.id) ?? 0,
    documentCount: documentCounts.get(supplier.id) ?? 0,
    awaitingSupplier: waiting.get(supplier.id) ?? 0,
    awaitingReview: review.get(supplier.id) ?? 0,
    updatedAt: latest.get(supplier.id) ?? null,
  }));
}

/**
 * Inside a supplier's folder, optionally narrowed to one of its projects:
 * the project rows with their counts, the documents and the open requests.
 * `null` when the supplier (or the project within it) is out of reach.
 */
export async function getSupplierFolder(user: SessionUser, supplierId: string, projectId?: string) {
  const supplier = await db.supplier.findFirst({
    where: { AND: [supplierScope(user), { id: supplierId }] },
    select: { id: true, name: true, country: true },
  });
  if (!supplier) return null;

  const projects = await db.project.findMany({
    where: { AND: [projectScope(user), { supplierId }] },
    select: {
      id: true,
      name: true,
      projectCode: true,
      currentStage: true,
      targetLaunchDate: true,
      owner: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  const project = projectId ? projects.find((candidate) => candidate.id === projectId) ?? null : null;
  if (projectId && !project) return null;

  const requestWhere = {
    AND: [
      documentRequestScope(user),
      { supplierId, status: { in: [...WAITING_SUPPLIER, ...WAITING_REVIEW] } },
      project ? { projectId: project.id } : {},
    ],
  };

  const [documentGroups, requestGroups, documents, requests] = await Promise.all([
    db.document.groupBy({
      by: ["projectId"],
      where: { AND: [documentScope(user), { project: { supplierId } }] },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    db.documentRequest.groupBy({
      by: ["projectId"],
      where: { AND: [documentRequestScope(user), { supplierId, status: { in: [...WAITING_SUPPLIER] } }] },
      _count: { _all: true },
    }),
    listDocuments(user, { supplierId, projectId: project?.id, perPage: 100 }),
    db.documentRequest.findMany({
      where: requestWhere,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 50,
    }),
  ]);

  const documentsByProject = new Map(documentGroups.map((row) => [row.projectId, row]));
  const pendingByProject = new Map(requestGroups.map((row) => [row.projectId, row._count._all]));

  return {
    supplier,
    project,
    projects: projects.map((item) => ({
      ...item,
      documentCount: documentsByProject.get(item.id)?._count._all ?? 0,
      updatedAt: documentsByProject.get(item.id)?._max.updatedAt ?? null,
      pending: pendingByProject.get(item.id) ?? 0,
    })),
    documents,
    requests,
  };
}
