import "server-only";
import type { Language, Prisma, UserRole, UserStatus } from "@/generated/prisma";
import { db } from "@/server/db";
import { userScope } from "@/server/authz/scopes";
import { hashPassword } from "@/server/auth/password";
import { recordAudit } from "@/server/services/audit";
import { isSupplierRole, type SessionUser } from "@/types/auth";

/** Vionex team members with their current workload. */
export async function listTeam(user: SessionUser) {
  const members = await db.user.findMany({
    where: { AND: [userScope(user), { supplierId: null }] },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      department: true,
      status: true,
      lastLoginAt: true,
    },
  });

  const ids = members.map((member) => member.id);
  if (ids.length === 0) return [];

  const [projectGroups, taskGroups] = await Promise.all([
    db.project.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: ids }, archivedAt: null },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { in: ids }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      _count: { _all: true },
    }),
  ]);

  const projects = new Map(projectGroups.map((g) => [g.ownerId, g._count._all]));
  const tasks = new Map(
    taskGroups.filter((g) => g.assignedToId).map((g) => [g.assignedToId as string, g._count._all]),
  );

  return members.map((member) => ({
    ...member,
    projectCount: projects.get(member.id) ?? 0,
    openTaskCount: tasks.get(member.id) ?? 0,
  }));
}

export async function listInternalUserOptions(user: SessionUser) {
  return db.user.findMany({
    where: { organizationId: user.organizationId, supplierId: null, status: "ACTIVE" },
    select: { id: true, name: true, jobTitle: true },
    orderBy: { name: "asc" },
  });
}

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  jobTitle?: string | null;
  department?: string | null;
  language?: Language;
  /** Required when the role is a supplier role. */
  supplierId?: string | null;
};

/**
 * Creates a user. Two invariants are enforced here rather than at the form:
 * a supplier role must carry a supplier, and an internal role must not — and
 * a supplier admin may only ever create users inside their own company.
 */
export async function createUser(actor: SessionUser, input: CreateUserInput) {
  const supplierRole = isSupplierRole(input.role);

  if (supplierRole && !input.supplierId) {
    throw new Error("Usuário de fornecedor precisa estar vinculado a um fornecedor.");
  }
  if (!supplierRole && input.supplierId) {
    throw new Error("Usuário interno não pode estar vinculado a um fornecedor.");
  }
  if (isSupplierRole(actor.role) && input.supplierId !== actor.supplierId) {
    throw new Error("Você só pode criar usuários da sua própria empresa.");
  }

  if (input.supplierId) {
    const supplier = await db.supplier.findFirst({
      where: { id: input.supplierId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!supplier) throw new Error("Fornecedor inválido.");
  }

  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new Error("Já existe um usuário com este e-mail.");

  const user = await db.user.create({
    data: {
      organizationId: actor.organizationId,
      supplierId: input.supplierId ?? null,
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      jobTitle: input.jobTitle,
      department: input.department,
      language: input.language ?? (supplierRole ? "EN" : "PT_BR"),
      status: "ACTIVE",
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.id,
    action: "user.create",
    entity: "User",
    entityId: user.id,
    metadata: { role: user.role, supplierId: input.supplierId ?? null },
  });

  return user;
}

export async function updateUser(
  actor: SessionUser,
  userId: string,
  input: { name?: string; role?: UserRole; jobTitle?: string | null; department?: string | null; status?: UserStatus; language?: Language },
) {
  const target = await db.user.findFirst({
    where: { AND: [userScope(actor), { id: userId }] },
    select: { id: true, role: true, supplierId: true },
  });
  if (!target) throw new Error("Usuário não encontrado.");

  // Changing between internal and supplier roles would strand the supplier link.
  if (input.role && isSupplierRole(input.role) !== isSupplierRole(target.role)) {
    throw new Error("Não é possível alternar entre papéis internos e de fornecedor.");
  }

  const data: Prisma.UserUpdateInput = { ...input };
  const user = await db.user.update({ where: { id: userId }, data, select: { id: true, role: true } });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.id,
    action: input.role && input.role !== target.role ? "user.role_change" : "user.update",
    entity: "User",
    entityId: user.id,
    metadata: input.role ? { from: target.role, to: input.role } : { fields: Object.keys(input) },
  });

  return user;
}
