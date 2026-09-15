import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createUser as createUserService, updateUser } from "@/server/services/users";
import type { SessionUser } from "@/types/auth";
import { createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

/**
 * The supplier boundary, from the inside.
 *
 * A supplier administrator now manages their own company's accounts, which is
 * the first time a supplier session has been allowed to *write* to a `User`
 * row. Everything below is about the edge of that permission: the checks that
 * matter are the ones a wrong answer would let slip past, so each test asserts
 * a refusal rather than a success.
 */
let organizationId: string;
let supplierAId: string;
let supplierBId: string;
let admin: SessionUser;
let supplierAdminA: SessionUser;
let supplierUserA: SessionUser;
let supplierAdminB: SessionUser;
let internalViewer: SessionUser;

beforeAll(async () => {
  const org = await createTestOrg("Users");
  organizationId = org.id;

  const supplierA = await createSupplier(organizationId, `A ${org.slug}`);
  const supplierB = await createSupplier(organizationId, `B ${org.slug}`, "Germany");
  supplierAId = supplierA.id;
  supplierBId = supplierB.id;

  admin = await createUser({ organizationId, role: "ADMIN" });
  internalViewer = await createUser({ organizationId, role: "VIEWER" });
  supplierAdminA = await createUser({
    organizationId,
    role: "SUPPLIER_ADMIN",
    supplierId: supplierAId,
  });
  supplierUserA = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplierAId,
  });
  supplierAdminB = await createUser({
    organizationId,
    role: "SUPPLIER_ADMIN",
    supplierId: supplierBId,
  });
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("supplier admin manages their own company", () => {
  it("edits a user of the same supplier", async () => {
    await updateUser(supplierAdminA, supplierUserA.id, { name: "Renamed By Admin" });
    const row = await db.user.findUnique({
      where: { id: supplierUserA.id },
      select: { name: true },
    });
    expect(row?.name).toBe("Renamed By Admin");
  });

  it("suspends a user of the same supplier", async () => {
    // The nearest thing to removal the model allows: six foreign keys refuse
    // to delete anyone who has produced work, so history stays attributable.
    await updateUser(supplierAdminA, supplierUserA.id, { status: "SUSPENDED" });
    const row = await db.user.findUnique({
      where: { id: supplierUserA.id },
      select: { status: true },
    });
    expect(row?.status).toBe("SUSPENDED");
    await updateUser(supplierAdminA, supplierUserA.id, { status: "ACTIVE" });
  });

  it("creates a supplier user for its own company", async () => {
    const created = await createUserService(supplierAdminA, {
      name: "New Portal User",
      email: `portal-${Date.now()}@test.local`,
      password: "a-long-enough-password",
      role: "SUPPLIER_USER",
      supplierId: supplierAId,
    });
    expect(created.role).toBe("SUPPLIER_USER");
  });
});

describe("supplier admin cannot cross the boundary", () => {
  it("cannot reach a user of another supplier", async () => {
    await expect(updateUser(supplierAdminA, supplierAdminB.id, { name: "Hijacked" })).rejects.toThrow();

    const row = await db.user.findUnique({
      where: { id: supplierAdminB.id },
      select: { name: true },
    });
    expect(row?.name).not.toBe("Hijacked");
  });

  it("cannot reach an internal Vionex user", async () => {
    await expect(updateUser(supplierAdminA, admin.id, { name: "Hijacked" })).rejects.toThrow();
  });

  it("cannot promote a portal user into an internal role", async () => {
    for (const role of ["ADMIN", "MANAGER", "REGULATORY", "IMPORT", "MARKETING", "VIEWER"] as const) {
      await expect(updateUser(supplierAdminA, supplierUserA.id, { role })).rejects.toThrow();
    }

    const row = await db.user.findUnique({
      where: { id: supplierUserA.id },
      select: { role: true },
    });
    expect(row?.role).toBe("SUPPLIER_USER");
  });

  it("cannot create a user for another supplier", async () => {
    await expect(
      createUserService(supplierAdminA, {
        name: "Cross Company",
        email: `cross-${Date.now()}@test.local`,
        password: "a-long-enough-password",
        role: "SUPPLIER_USER",
        supplierId: supplierBId,
      }),
    ).rejects.toThrow(/própria empresa/i);
  });

  it("cannot create an internal Vionex user", async () => {
    await expect(
      createUserService(supplierAdminA, {
        name: "Fake Internal",
        email: `fake-${Date.now()}@test.local`,
        password: "a-long-enough-password",
        role: "ADMIN",
        supplierId: null,
      }),
    ).rejects.toThrow();
  });
});

describe("administrators within the company", () => {
  it("promotes a portal user to administrator", async () => {
    // Reversed from the previous round: the product decided a supplier
    // administrator may appoint another one, inside their own company.
    await updateUser(supplierAdminA, supplierUserA.id, { role: "SUPPLIER_ADMIN" });
    const row = await db.user.findUnique({
      where: { id: supplierUserA.id },
      select: { role: true, supplierId: true },
    });
    expect(row?.role).toBe("SUPPLIER_ADMIN");
    // Promotion never moves anybody between companies.
    expect(row?.supplierId).toBe(supplierAId);
  });

  it("demotes an administrator back, while another one remains", async () => {
    await updateUser(supplierAdminA, supplierUserA.id, { role: "SUPPLIER_USER" });
    const row = await db.user.findUnique({
      where: { id: supplierUserA.id },
      select: { role: true },
    });
    expect(row?.role).toBe("SUPPLIER_USER");
  });

  it("refuses to leave the company with no active administrator", async () => {
    /**
     * `supplierAdminA` is the only administrator at this point. Demoting
     * themselves would leave a company with users and nobody able to manage
     * them — a state whose only exit is a Vionex employee noticing.
     */
    await expect(
      updateUser(supplierAdminA, supplierAdminA.id, { role: "SUPPLIER_USER" }),
    ).rejects.toThrow(/administrador/i);

    await expect(
      updateUser(supplierAdminA, supplierAdminA.id, { status: "SUSPENDED" }),
    ).rejects.toThrow(/administrador/i);

    const row = await db.user.findUnique({
      where: { id: supplierAdminA.id },
      select: { role: true, status: true },
    });
    expect(row?.role).toBe("SUPPLIER_ADMIN");
    expect(row?.status).toBe("ACTIVE");
  });

  it("allows it once a second administrator exists", async () => {
    await updateUser(supplierAdminA, supplierUserA.id, { role: "SUPPLIER_ADMIN" });
    await updateUser(supplierAdminA, supplierAdminA.id, { status: "SUSPENDED" });

    const row = await db.user.findUnique({
      where: { id: supplierAdminA.id },
      select: { status: true },
    });
    expect(row?.status).toBe("SUSPENDED");

    // Put the fixture back for whatever runs next.
    await db.user.update({ where: { id: supplierAdminA.id }, data: { status: "ACTIVE" } });
    await db.user.update({ where: { id: supplierUserA.id }, data: { role: "SUPPLIER_USER" } });
  });

  it("creates an administrator for its own company, never another", async () => {
    const created = await createUserService(supplierAdminA, {
      name: "Second Admin",
      email: `admin2-${Date.now()}@test.local`,
      password: "a-long-enough-password",
      role: "SUPPLIER_ADMIN",
      supplierId: null,
    });
    expect(created.role).toBe("SUPPLIER_ADMIN");

    const row = await db.user.findUnique({
      where: { id: created.id },
      select: { supplierId: true },
    });
    // The company came from the session, not from the request.
    expect(row?.supplierId).toBe(supplierAId);

    await db.user.delete({ where: { id: created.id } });
  });
});

describe("plain portal users manage nobody", () => {
  it("SUPPLIER_USER holds no user-management capability", async () => {
    const { roleHas } = await import("@/server/authz/permissions");
    expect(roleHas("SUPPLIER_USER", "portal:manage-users")).toBe(false);
    expect(roleHas("SUPPLIER_USER", "user:manage")).toBe(false);
    expect(roleHas("SUPPLIER_ADMIN", "portal:manage-users")).toBe(true);
  });

  it("SUPPLIER_USER is refused by the service, not only by the action", async () => {
    /**
     * Two actions call `updateUser`, and the capability check used to live in
     * them alone. A plain portal user reaching the service by any other route
     * would have been governed only by the scope — which would have let them
     * edit a colleague.
     */
    const plain = await createUser({
      organizationId,
      role: "SUPPLIER_USER",
      supplierId: supplierAId,
    });

    await expect(updateUser(plain, supplierUserA.id, { name: "Nope" })).rejects.toThrow();
    await expect(
      createUserService(plain, {
        name: "Nope",
        email: `nope-${Date.now()}@test.local`,
        password: "a-long-enough-password",
        role: "SUPPLIER_USER",
        supplierId: supplierAId,
      }),
    ).rejects.toThrow();
  });

  it("an internal VIEWER holds none either", async () => {
    const { roleHas } = await import("@/server/authz/permissions");
    expect(roleHas("VIEWER", "user:manage")).toBe(false);
    expect(internalViewer.role).toBe("VIEWER");
  });
});
