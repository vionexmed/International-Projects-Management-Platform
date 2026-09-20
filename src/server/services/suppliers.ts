import "server-only";
import { startOfTodayUtc } from "@/lib/format";
import type { HealthStatus, Prisma } from "@/generated/prisma";

/** The four values `Supplier.status` actually holds — never `COMPLETED`, which only `Project.status` uses. */
export type SupplierStatus = Extract<HealthStatus, "ON_TRACK" | "AT_RISK" | "BLOCKED" | "INACTIVE">;
import { db } from "@/server/db";
import { supplierScope } from "@/server/authz/scopes";
import { recordAudit } from "@/server/services/audit";
import type { SessionUser } from "@/types/auth";

export type SupplierRow = {
  id: string;
  name: string;
  country: string;
  status: SupplierStatus;
  projectCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
};

/**
 * Supplier list with the three counters the overview table shows. The counts
 * are aggregated in three grouped queries rather than per row, so the page
 * cost does not grow with the number of suppliers.
 */
export async function listSuppliers(
  user: SessionUser,
  filters: { query?: string; status?: SupplierStatus } = {},
): Promise<SupplierRow[]> {
  const conditions: Prisma.SupplierWhereInput[] = [supplierScope(user)];
  if (filters.query) conditions.push({ name: { contains: filters.query, mode: "insensitive" } });
  if (filters.status) conditions.push({ status: filters.status });

  const suppliers = await db.supplier.findMany({
    where: { AND: conditions },
    orderBy: { name: "asc" },
  });

  const supplierIds = suppliers.map((supplier) => supplier.id);
  if (supplierIds.length === 0) return [];

  const now = startOfTodayUtc();
  const [projectGroups, openGroups, overdueGroups] = await Promise.all([
    db.project.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: supplierIds }, archivedAt: null },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: supplierIds }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      _count: { _all: true },
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

  const toMap = (groups: { supplierId: string | null; _count: { _all: number } }[]) =>
    new Map(groups.filter((g) => g.supplierId).map((g) => [g.supplierId as string, g._count._all]));

  const projects = toMap(projectGroups);
  const open = toMap(openGroups);
  const overdue = toMap(overdueGroups);

  return suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    country: supplier.country,
    status: supplier.status as SupplierStatus,
    projectCount: projects.get(supplier.id) ?? 0,
    openTaskCount: open.get(supplier.id) ?? 0,
    overdueTaskCount: overdue.get(supplier.id) ?? 0,
  }));
}

export async function getSupplierProfile(user: SessionUser, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: { AND: [supplierScope(user), { id: supplierId }] },
    include: {
      users: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          jobTitle: true,
          language: true,
          status: true,
          lastLoginAt: true,
        },
      },
    },
  });
  if (!supplier) return null;

  const now = startOfTodayUtc();
  const [projects, openTasks, overdueTasks, documents] = await Promise.all([
    db.project.findMany({
      where: { supplierId, archivedAt: null },
      select: {
        id: true,
        name: true,
        projectCode: true,
        status: true,
        currentStage: true,
        targetLaunchDate: true,
        owner: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.task.count({ where: { supplierId, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    db.task.count({
      where: { supplierId, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { lt: now } },
    }),
    db.document.count({ where: { project: { supplierId } } }),
  ]);

  return { supplier, projects, openTasks, overdueTasks, documentCount: documents };
}

export async function createSupplier(
  user: SessionUser,
  input: {
    name: string;
    country: string;
    website?: string | null;
    address?: string | null;
    primaryContact?: string | null;
    email?: string | null;
    phone?: string | null;
  },
) {
  const supplier = await db.supplier.create({
    data: { ...input, organizationId: user.organizationId },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "supplier.create",
    entity: "Supplier",
    entityId: supplier.id,
    metadata: { name: supplier.name },
  });

  return supplier;
}

export async function updateSupplier(
  user: SessionUser,
  supplierId: string,
  input: Prisma.SupplierUpdateInput,
) {
  const existing = await db.supplier.findFirst({
    where: { AND: [supplierScope(user), { id: supplierId }] },
    select: { id: true },
  });
  if (!existing) throw new Error("Fornecedor não encontrado.");

  const supplier = await db.supplier.update({ where: { id: supplierId }, data: input });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "supplier.update",
    entity: "Supplier",
    entityId: supplier.id,
  });

  return supplier;
}

/** Lightweight list for filter dropdowns and project forms. */
export async function listSupplierOptions(user: SessionUser) {
  return db.supplier.findMany({
    where: supplierScope(user),
    select: { id: true, name: true, country: true },
    orderBy: { name: "asc" },
  });
}
