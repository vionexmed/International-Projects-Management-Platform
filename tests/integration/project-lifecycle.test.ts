import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { listProjects, setProjectArchived } from "@/server/services/projects";
import { requireSharedProjectAccess } from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
import { listProjectTimeline } from "@/server/services/timeline";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

/**
 * Archiving a project.
 *
 * `Project.archivedAt` had been filtered by four different scopes since the
 * schema was written and never once written to, so the column was a promise
 * the product did not keep. These tests are about the promise: archiving hides
 * without destroying, the supplier loses sight of it immediately, and the door
 * opens again.
 */
let organizationId: string;
let admin: SessionUser;
let supplierUser: SessionUser;
let projectId: string;

beforeAll(async () => {
  const org = await createTestOrg("Lifecycle");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `Maker ${org.slug}`);
  admin = await createUser({ organizationId, role: "ADMIN" });
  supplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplier.id,
  });

  const project = await createProject({
    organizationId,
    supplierId: supplier.id,
    ownerId: admin.id,
    name: "Lifecycle Project",
  });
  projectId = project.id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("archiving a project", () => {
  it("removes it from the live portfolio without deleting anything", async () => {
    await setProjectArchived(admin, projectId, true);

    const live = await listProjects(admin);
    expect(live.items.map((project) => project.id)).not.toContain(projectId);

    // The row is still there, with its stages — an archive, not a delete.
    const row = await db.project.findUnique({
      where: { id: projectId },
      select: { archivedAt: true, _count: { select: { stages: true } } },
    });
    expect(row?.archivedAt).toBeInstanceOf(Date);
    expect(row?._count.stages).toBe(4);
  });

  it("hides it from the supplier immediately", async () => {
    const visible = await listProjects(supplierUser);
    expect(visible.items.map((project) => project.id)).not.toContain(projectId);

    await expect(requireSharedProjectAccess(supplierUser, projectId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("lists it in the archive, for internal users only", async () => {
    const archived = await listProjects(admin, { archived: true });
    expect(archived.items.map((project) => project.id)).toContain(projectId);

    // A supplier asking for the archive gets their live projects, never the
    // archived ones: the scope ignores the option for a supplier session.
    const supplierAttempt = await listProjects(supplierUser, { archived: true });
    expect(supplierAttempt.items.map((project) => project.id)).not.toContain(projectId);
  });

  it("records the act as internal, so the supplier is not told", async () => {
    const events = await listProjectTimeline(admin, projectId);
    expect(JSON.stringify(events)).toContain("arquivado");

    // The supplier cannot even reach the project any more, but the event has
    // to be internal regardless — the two must not contradict each other.
    const internalOnly = await db.timelineEvent.findMany({
      where: { projectId, description: { contains: "arquivado" } },
      select: { internal: true },
    });
    expect(internalOnly.every((event) => event.internal)).toBe(true);
  });

  it("reopens, and the supplier sees it again", async () => {
    await setProjectArchived(admin, projectId, false);

    const live = await listProjects(admin);
    expect(live.items.map((project) => project.id)).toContain(projectId);

    await expect(requireSharedProjectAccess(supplierUser, projectId)).resolves.toMatchObject({
      id: projectId,
    });
  });

  it("refuses to archive a project outside the caller's scope", async () => {
    const otherOrg = await createTestOrg("Other");
    try {
      const otherSupplier = await createSupplier(otherOrg.id, `Other ${otherOrg.slug}`);
      const otherAdmin = await createUser({ organizationId: otherOrg.id, role: "ADMIN" });
      const otherProject = await createProject({
        organizationId: otherOrg.id,
        supplierId: otherSupplier.id,
        ownerId: otherAdmin.id,
        name: "Not Yours",
      });

      await expect(setProjectArchived(admin, otherProject.id, true)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    } finally {
      await destroyOrg(otherOrg.id);
    }
  });
});
