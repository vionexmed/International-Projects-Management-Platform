import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import type { UserRole } from "@/generated/prisma";
import type { SessionUser } from "@/types/auth";

/**
 * Each integration test builds its own organisation and deletes it afterwards,
 * so tests never depend on (or damage) the demo seed.
 */
export async function createTestOrg(label: string) {
  const suffix = randomUUID().slice(0, 8);
  return db.organization.create({
    data: { name: `${label} ${suffix}`, slug: `${label.toLowerCase()}-${suffix}` },
  });
}

/**
 * Deletes in dependency order. A plain cascade from Organization is not enough:
 * Project holds `onDelete: Restrict` references to Supplier and User, so the
 * projects have to go before the rows they point at.
 */
export async function destroyOrg(organizationId: string) {
  /**
   * `MessageAttachment.documentVersion` is `Restrict` on purpose: a file that
   * a message points at must not disappear underneath it. The product never
   * deletes a project — it archives — so only fixtures ever hit this, and
   * dropping the pointers first is the fixture's job, not the model's.
   */
  await db.messageAttachment.deleteMany({
    where: { documentVersion: { document: { organizationId } } },
  });
  await db.project.deleteMany({ where: { organizationId } });
  await db.auditLog.deleteMany({ where: { organizationId } });
  await db.user.deleteMany({ where: { organizationId } });
  await db.supplier.deleteMany({ where: { organizationId } });
  await db.organization.delete({ where: { id: organizationId } });
}

export async function createSupplier(organizationId: string, name: string, country = "China") {
  return db.supplier.create({ data: { organizationId, name, country } });
}

export async function createUser(input: {
  organizationId: string;
  role: UserRole;
  name?: string;
  supplierId?: string | null;
}): Promise<SessionUser> {
  const suffix = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      organizationId: input.organizationId,
      supplierId: input.supplierId ?? null,
      name: input.name ?? `User ${suffix}`,
      email: `${suffix}@test.local`,
      passwordHash: await hashPassword("test-password-123"),
      role: input.role,
    },
    include: { supplier: { select: { name: true } } },
  });

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
}

export async function createProject(input: {
  organizationId: string;
  supplierId: string;
  ownerId: string;
  name: string;
}) {
  const suffix = randomUUID().slice(0, 6).toUpperCase();
  return db.project.create({
    data: {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      ownerId: input.ownerId,
      name: input.name,
      projectCode: `T-${suffix}`,
      country: "China",
      stages: {
        create: [
          { key: "CLINICAL", name: "Clinical", position: 0 },
          { key: "REGULATORY", name: "Regulatory", position: 1 },
          { key: "IMPORT_LOGISTICS", name: "Import & Logistics", position: 2 },
          { key: "GO_TO_MARKET", name: "Go-to-Market", position: 3 },
        ],
      },
    },
  });
}

/** Minimal in-memory File, so upload paths can be exercised without fixtures. */
export function makeFile(name = "report.pdf", type = "application/pdf", size = 2048) {
  return new File([new Uint8Array(size)], name, { type });
}
