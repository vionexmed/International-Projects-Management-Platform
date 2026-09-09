import "server-only";
import { db } from "@/server/db";
import { documentScope, projectScope, supplierScope, taskScope } from "@/server/authz/scopes";
import { isSupplierRole, type SessionUser } from "@/types/auth";

export type SearchHit = {
  id: string;
  kind: "project" | "task" | "document" | "supplier";
  title: string;
  subtitle: string;
  href: string;
};

/**
 * Cross-entity lookup for the command palette. Every branch composes the
 * caller's own scope, so a supplier searching only ever reaches their own
 * records — the palette needs no rules of its own.
 */
export async function search(user: SessionUser, term: string): Promise<SearchHit[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const contains = { contains: query, mode: "insensitive" as const };
  const supplierSession = isSupplierRole(user.role);
  const prefix = supplierSession ? "/supplier" : "";

  const [projects, tasks, documents, suppliers] = await Promise.all([
    db.project.findMany({
      where: {
        AND: [projectScope(user), { OR: [{ name: contains }, { projectCode: contains }] }],
      },
      select: { id: true, name: true, projectCode: true, supplier: { select: { name: true } } },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    db.task.findMany({
      where: { AND: [taskScope(user), { title: contains }] },
      select: { id: true, title: true, project: { select: { name: true } } },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    db.document.findMany({
      where: { AND: [documentScope(user), { name: contains }] },
      select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    supplierSession
      ? Promise.resolve([])
      : db.supplier.findMany({
          where: { AND: [supplierScope(user), { name: contains }] },
          select: { id: true, name: true, country: true },
          take: 4,
          orderBy: { name: "asc" },
        }),
  ]);

  const hits: SearchHit[] = [
    ...projects.map((project) => ({
      id: project.id,
      kind: "project" as const,
      title: project.name,
      subtitle: `${project.projectCode} · ${project.supplier.name}`,
      href: `${prefix}/projects/${project.id}`,
    })),
    ...tasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      subtitle: task.project.name,
      // Suppliers have no task detail screen; send them to the project instead.
      href: supplierSession ? `${prefix}/projects` : `/tasks/${task.id}`,
    })),
    ...documents.map((document) => ({
      id: document.id,
      kind: "document" as const,
      title: document.name,
      subtitle: document.project.name,
      href: supplierSession
        ? `${prefix}/projects/${document.projectId}/documents`
        : `/projects/${document.projectId}/documents`,
    })),
    ...suppliers.map((supplier) => ({
      id: supplier.id,
      kind: "supplier" as const,
      title: supplier.name,
      subtitle: supplier.country,
      href: `/suppliers/${supplier.id}`,
    })),
  ];

  return hits;
}
