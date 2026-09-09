import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { readSessionCookie, verifySessionToken } from "@/server/auth/session";
import { ForbiddenError } from "@/server/authz/errors";
import { roleHas, type Permission } from "@/server/authz/permissions";
import { isSupplierRole, type SessionUser } from "@/types/auth";

/**
 * Resolves the caller from the session cookie. Role, status and supplier link
 * are always read from the database — the cookie is only an identity claim —
 * so revoking or downgrading an account takes effect on the next request.
 *
 * `cache` de-duplicates the lookup within a single request/render pass.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionCookie();
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await db.user.findFirst({
    where: {
      id: claims.userId,
      organizationId: claims.organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      supplierId: true,
      jobTitle: true,
      department: true,
      language: true,
      supplier: { select: { name: true } },
    },
  });

  if (!user) return null;

  // A supplier role without a supplier link would produce an unscoped query;
  // refuse the session rather than risk a cross-tenant read.
  if (isSupplierRole(user.role) && !user.supplierId) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    supplierId: user.supplierId,
    supplierName: user.supplier?.name ?? null,
    jobTitle: user.jobTitle,
    department: user.department,
    language: user.language,
  };
});

/** Require any authenticated user, redirecting to the login page otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require an authenticated Vionex team member (never a supplier account). */
export async function requireInternalUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (isSupplierRole(user.role)) redirect("/supplier");
  return user;
}

/** Require an authenticated supplier account. */
export async function requireSupplierUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isSupplierRole(user.role)) redirect("/dashboard");
  return user;
}

/** Require a specific capability. Throws so server actions fail closed. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!roleHas(user.role, permission)) {
    throw new ForbiddenError();
  }
  return user;
}

export function can(user: SessionUser, permission: Permission) {
  return roleHas(user.role, permission);
}
