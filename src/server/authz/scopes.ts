import type { Prisma } from "@/generated/prisma";
import { isSupplierRole, type SessionUser } from "@/types/auth";

/**
 * Every list query in the application composes its filters on top of one of
 * these scopes. They are pure functions of the session so they can be unit
 * tested without a database, and they are the single place where supplier
 * isolation is expressed.
 *
 * Invariant: for a supplier session the returned predicate always pins
 * `supplierId` (directly or through the parent project), so a supplier can
 * never observe another supplier's rows even with a guessed identifier.
 */

/** A supplier session must always carry a supplierId; refuse to build a scope otherwise. */
function supplierIdOf(user: SessionUser): string {
  if (!user.supplierId) {
    throw new Error("Supplier account is not linked to a supplier record.");
  }
  return user.supplierId;
}

/**
 * `archived: "only"` flips the list to the archive. It is deliberately ignored
 * for a supplier session: an archived project is closed business, and no
 * argument a caller passes should be able to reopen it on the portal side. The
 * default is unchanged — live projects, exactly as before.
 */
export function projectScope(
  user: SessionUser,
  options: { archived?: "only" } = {},
): Prisma.ProjectWhereInput {
  if (isSupplierRole(user.role)) {
    return {
      organizationId: user.organizationId,
      supplierId: supplierIdOf(user),
      archivedAt: null,
    };
  }
  return {
    organizationId: user.organizationId,
    archivedAt: options.archived === "only" ? { not: null } : null,
  };
}

export function taskScope(user: SessionUser): Prisma.TaskWhereInput {
  if (isSupplierRole(user.role)) {
    // Suppliers only ever see work that is explicitly waiting on them.
    return {
      organizationId: user.organizationId,
      supplierId: supplierIdOf(user),
      project: { supplierId: supplierIdOf(user) },
    };
  }
  return { organizationId: user.organizationId };
}

export function documentScope(user: SessionUser): Prisma.DocumentWhereInput {
  if (isSupplierRole(user.role)) {
    // Scoped through the project relation so a mis-set Document.supplierId
    // can never widen visibility, and only explicitly shared files appear.
    return {
      organizationId: user.organizationId,
      visibility: "SHARED_WITH_SUPPLIER",
      project: { supplierId: supplierIdOf(user) },
    };
  }
  return { organizationId: user.organizationId };
}

export function documentRequestScope(user: SessionUser): Prisma.DocumentRequestWhereInput {
  if (isSupplierRole(user.role)) {
    return {
      supplierId: supplierIdOf(user),
      project: { organizationId: user.organizationId, supplierId: supplierIdOf(user) },
    };
  }
  return { project: { organizationId: user.organizationId } };
}

export function threadScope(user: SessionUser): Prisma.MessageThreadWhereInput {
  if (isSupplierRole(user.role)) {
    return {
      withSupplier: true,
      project: { organizationId: user.organizationId, supplierId: supplierIdOf(user) },
    };
  }
  return { project: { organizationId: user.organizationId } };
}

export function supplierScope(user: SessionUser): Prisma.SupplierWhereInput {
  if (isSupplierRole(user.role)) {
    return { organizationId: user.organizationId, id: supplierIdOf(user) };
  }
  return { organizationId: user.organizationId };
}

export function userScope(user: SessionUser): Prisma.UserWhereInput {
  if (isSupplierRole(user.role)) {
    // A supplier admin manages only the users of their own company.
    return { organizationId: user.organizationId, supplierId: supplierIdOf(user) };
  }
  return { organizationId: user.organizationId };
}

export function timelineScope(user: SessionUser): Prisma.TimelineEventWhereInput {
  if (isSupplierRole(user.role)) {
    return {
      internal: false,
      project: { organizationId: user.organizationId, supplierId: supplierIdOf(user) },
    };
  }
  return { project: { organizationId: user.organizationId } };
}
