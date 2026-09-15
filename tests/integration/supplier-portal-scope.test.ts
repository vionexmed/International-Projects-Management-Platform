import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createTask } from "@/server/services/tasks";
import { listTasks } from "@/server/services/tasks";
import { createDocumentRequest } from "@/server/services/documents";
import { listPortalUsers } from "@/server/services/users";
import { uploadDocument } from "@/server/services/documents";
import { requireDocumentVersionAccess } from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
import { roleHas } from "@/server/authz/permissions";
import type { SessionUser } from "@/types/auth";
import {
  createProject,
  createSupplier,
  createTestOrg,
  createUser,
  destroyOrg,
  makeFile,
} from "../factories";

/**
 * The new portal screens, from the supplier's side of the wall.
 *
 * Tasks, users and profile each read data that was previously only reachable
 * from the Vionex environment. Every one of them is a fresh chance to widen a
 * scope by accident, so each is tested from both sides: what the owner sees,
 * and what the neighbour does not.
 */
let organizationId: string;
let admin: SessionUser;
let supplierAdminA: SessionUser;
let supplierUserA: SessionUser;
let supplierUserB: SessionUser;
let projectAId: string;

beforeAll(async () => {
  const org = await createTestOrg("PortalScope");
  organizationId = org.id;

  const supplierA = await createSupplier(organizationId, `A ${org.slug}`);
  const supplierB = await createSupplier(organizationId, `B ${org.slug}`, "Germany");

  admin = await createUser({ organizationId, role: "ADMIN" });
  supplierAdminA = await createUser({
    organizationId,
    role: "SUPPLIER_ADMIN",
    supplierId: supplierA.id,
  });
  supplierUserA = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplierA.id,
  });
  supplierUserB = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplierB.id,
  });

  const projectA = await createProject({
    organizationId,
    supplierId: supplierA.id,
    ownerId: admin.id,
    name: "Portal Scope A",
  });
  projectAId = projectA.id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("supplier tasks", () => {
  it("shows work waiting on the supplier, and never internal work", async () => {
    await createTask(admin, {
      projectId: projectAId,
      title: "Supplier visible task",
      category: "IMPORT",
      priority: "MEDIUM",
      waitingOnSupplier: true,
    });
    await createTask(admin, {
      projectId: projectAId,
      title: "Internal only task",
      category: "REGULATORY",
      priority: "MEDIUM",
      waitingOnSupplier: false,
    });

    const visible = await listTasks(supplierUserA, { excludeDocumentRequests: true });
    const titles = visible.items.map((task) => task.title);

    expect(titles).toContain("Supplier visible task");
    expect(titles).not.toContain("Internal only task");
  });

  it("hides the mirror task of a document request, which Action Required owns", async () => {
    await createDocumentRequest(admin, {
      projectId: projectAId,
      title: "Mirror task request",
      type: "CERTIFICATE",
      createTask: true,
    });

    const withoutRequests = await listTasks(supplierUserA, { excludeDocumentRequests: true });
    expect(withoutRequests.items.map((task) => task.title)).not.toContain("Mirror task request");

    // …and it does exist — it is filtered for the portal, not missing.
    const everything = await listTasks(supplierUserA);
    expect(everything.items.map((task) => task.title)).toContain("Mirror task request");
  });

  it("shows nothing at all to a different supplier", async () => {
    const other = await listTasks(supplierUserB, { excludeDocumentRequests: true });
    expect(other.items).toHaveLength(0);
  });
});

describe("portal user list", () => {
  it("lists only the caller's own company", async () => {
    const mine = await listPortalUsers(supplierAdminA);
    const ids = mine.map((row) => row.id);

    expect(ids).toContain(supplierAdminA.id);
    expect(ids).toContain(supplierUserA.id);
    expect(ids).not.toContain(supplierUserB.id);
    expect(ids).not.toContain(admin.id);
  });

  it("gives a plain portal user the same narrow view, and no capability", async () => {
    // The page refuses them, but the scope has to hold on its own regardless.
    const theirs = await listPortalUsers(supplierUserA);
    expect(theirs.map((row) => row.id)).not.toContain(supplierUserB.id);

    expect(roleHas("SUPPLIER_USER", "portal:manage-users")).toBe(false);
    expect(roleHas("SUPPLIER_ADMIN", "portal:manage-users")).toBe(true);
  });
});

describe("document downloads from the portal", () => {
  it("refuses an internal-only file to the supplier it belongs to", async () => {
    const internal = await uploadDocument(admin, {
      projectId: projectAId,
      name: "Internal only doc",
      type: "COMMERCIAL",
      visibility: "INTERNAL_ONLY",
      file: makeFile("internal.pdf"),
    });

    const version = await db.documentVersion.findFirstOrThrow({
      where: { documentId: internal.id },
      select: { id: true },
    });

    await expect(requireDocumentVersionAccess(supplierUserA, version.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    // Vionex can, which is what makes the refusal meaningful.
    await expect(requireDocumentVersionAccess(admin, version.id)).resolves.toBeTruthy();
  });

  it("allows a shared file to its own supplier and no other", async () => {
    const shared = await uploadDocument(admin, {
      projectId: projectAId,
      name: "Shared doc",
      type: "OTHER",
      visibility: "SHARED_WITH_SUPPLIER",
      file: makeFile("shared.pdf"),
    });

    const version = await db.documentVersion.findFirstOrThrow({
      where: { documentId: shared.id },
      select: { id: true },
    });

    await expect(requireDocumentVersionAccess(supplierUserA, version.id)).resolves.toBeTruthy();
    await expect(requireDocumentVersionAccess(supplierUserB, version.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
