import "server-only";
import type { Language, Prisma, UserRole, UserStatus } from "@/generated/prisma";
import { db } from "@/server/db";
import { userScope } from "@/server/authz/scopes";
import { hashPassword } from "@/server/auth/password";
import { recordAudit } from "@/server/services/audit";
import { isSupplierRole, type SessionUser } from "@/types/auth";
import { roleHas } from "@/server/authz/permissions";
import { ForbiddenError } from "@/server/authz/errors";

/** Vionex team members with their current workload. */
/**
 * The users of the caller's own supplier company.
 *
 * `userScope` already pins `supplierId` for a supplier session, so this cannot
 * return anyone from another company even if the caller asks. The extra
 * `supplierId: { not: null }` is for the internal case: an administrator
 * opening a company's list should see that company, not the Vionex team.
 */
export async function listPortalUsers(user: SessionUser) {
  return db.user.findMany({
    where: { AND: [userScope(user), { supplierId: { not: null } }] },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      status: true,
      lastLoginAt: true,
    },
  });
}

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

  /**
   * For a supplier administrator the company is **derived from the session**,
   * not read from the request.
   *
   * Comparing a submitted `supplierId` against the session would also be
   * correct, and it puts the tenant boundary one typo away from being a
   * comparison somebody forgets to make. Overriding removes the field from the
   * attack surface entirely: there is no value a client could send that would
   * place a user in another company.
   */
  if (isSupplierRole(actor.role)) {
    if (!roleHas(actor.role, "portal:manage-users")) {
      throw new ForbiddenError();
    }
    if (!supplierRole) {
      throw new Error("Você só pode criar usuários do portal.");
    }
    /**
     * An explicit mismatch is refused; an omission is filled in.
     *
     * Overriding alone would be safe and quiet, and quiet is the wrong
     * answer here: a caller that sends the wrong company has a bug, and
     * silently placing the user somewhere else hides it. Refusing the
     * mismatch keeps the boundary uncrossable *and* audible, while the
     * fill-in means a form that never mentions the company cannot get it
     * wrong by leaving it out.
     */
    if (input.supplierId && input.supplierId !== actor.supplierId) {
      throw new Error("Você só pode criar usuários da sua própria empresa.");
    }
    input = { ...input, supplierId: actor.supplierId };
  }

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

/** Whether a role change takes the last administrator away. */
function isLastAdminChange(current: UserRole, next?: UserRole) {
  return current === "SUPPLIER_ADMIN" && Boolean(next) && next !== "SUPPLIER_ADMIN";
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

  /**
   * A supplier administrator manages their own company and nothing beyond it.
   *
   * `userScope` already confined the lookup to their `supplierId`, so a target
   * from another company is simply not found. These two checks cover what a
   * scope cannot express: that the *outcome* also has to stay inside the
   * boundary.
   *
   * Assigning SUPPLIER_ADMIN is refused for now. Nothing in the product says
   * whether a supplier administrator may appoint another one, and the
   * conservative reading is the one that cannot be exploited — a decision to
   * revisit, not a limitation of the architecture.
   */
  if (isSupplierRole(actor.role)) {
    /**
     * Re-checked here, not only in the action.
     *
     * Two actions now reach this function, and a third will eventually. The
     * capability check belonging to only one of them is how a boundary quietly
     * stops being one — so the service asks the question itself.
     */
    if (!roleHas(actor.role, "portal:manage-users")) {
      throw new ForbiddenError();
    }
    if (!target.supplierId || target.supplierId !== actor.supplierId) {
      throw new Error("Você só pode gerenciar usuários da sua própria empresa.");
    }
    if (input.role && !isSupplierRole(input.role)) {
      throw new Error("Você só pode atribuir papéis do portal.");
    }
  }

  /**
   * Nobody may lock the company out of its own account management.
   *
   * A supplier administrator can now demote or suspend another one, which
   * introduces a state the product cannot recover from on its own: a company
   * with users and no administrator, whose only way back is a Vionex employee
   * noticing. The check is cheap; the alternative is a support ticket.
   *
   * Run at SERIALIZABLE, because the obvious version of this is wrong. Two
   * administrators demoting each other at the same moment both read "two
   * admins", both decide it is safe, and both commit — READ COMMITTED, the
   * Prisma default, permits exactly that. Serializable makes the second one
   * fail instead, which is the behaviour worth having.
   */
  const losesAdmin =
    isLastAdminChange(target.role, input.role) || (target.role === "SUPPLIER_ADMIN" && input.status && input.status !== "ACTIVE");

  if (target.supplierId && losesAdmin) {
    await db.$transaction(
      async (tx) => {
        const remaining = await tx.user.count({
          where: {
            supplierId: target.supplierId,
            role: "SUPPLIER_ADMIN",
            status: "ACTIVE",
            id: { not: target.id },
          },
        });
        if (remaining === 0) {
          throw new Error(
            "Esta empresa ficaria sem nenhum administrador ativo. Promova outro usuário antes.",
          );
        }
      },
      { isolationLevel: "Serializable" },
    );
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
