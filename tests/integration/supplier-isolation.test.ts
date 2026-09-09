import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  requireDocumentAccess,
  requireDocumentRequestAccess,
  requireProjectAccess,
  requireSupplierAccess,
  requireTaskAccess,
  requireThreadAccess,
} from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
import { listDocuments } from "@/server/services/documents";
import { listProjects } from "@/server/services/projects";
import { listTasks } from "@/server/services/tasks";
import { listThreads } from "@/server/services/messages";
import { listSuppliers } from "@/server/services/suppliers";
import { search } from "@/server/services/search";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";
import type { SessionUser } from "@/types/auth";

/**
 * The single most important guarantee of the platform (§3, §63):
 * Supplier A must never observe anything belonging to Supplier B.
 */
describe("supplier isolation", () => {
  let organizationId: string;
  let supplierA: SessionUser;
  let supplierB: SessionUser;
  let internal: SessionUser;
  let projectA: { id: string };
  let projectB: { id: string };
  let documentB: { id: string };
  let taskB: { id: string };
  let requestB: { id: string };
  let threadB: { id: string };
  let supplierBId: string;

  beforeAll(async () => {
    const org = await createTestOrg("Isolation");
    organizationId = org.id;

    const companyA = await createSupplier(organizationId, "Manufacturer A");
    const companyB = await createSupplier(organizationId, "Manufacturer B", "Germany");
    supplierBId = companyB.id;

    internal = await createUser({ organizationId, role: "ADMIN", name: "Vionex Admin" });
    supplierA = await createUser({
      organizationId,
      role: "SUPPLIER_ADMIN",
      name: "John Smith",
      supplierId: companyA.id,
    });
    supplierB = await createUser({
      organizationId,
      role: "SUPPLIER_ADMIN",
      name: "Klaus Weber",
      supplierId: companyB.id,
    });

    projectA = await createProject({
      organizationId,
      supplierId: companyA.id,
      ownerId: internal.id,
      name: "Project A",
    });
    projectB = await createProject({
      organizationId,
      supplierId: companyB.id,
      ownerId: internal.id,
      name: "Project B",
    });

    // A document belonging to B, explicitly shared with B.
    documentB = await db.document.create({
      data: {
        organizationId,
        projectId: projectB.id,
        supplierId: companyB.id,
        createdById: internal.id,
        name: "B Certificate",
        type: "CERTIFICATE",
        visibility: "SHARED_WITH_SUPPLIER",
      },
    });

    taskB = await db.task.create({
      data: {
        organizationId,
        projectId: projectB.id,
        createdById: internal.id,
        supplierId: companyB.id,
        title: "B task",
      },
    });

    requestB = await db.documentRequest.create({
      data: {
        projectId: projectB.id,
        supplierId: companyB.id,
        requestedById: internal.id,
        title: "B request",
      },
    });

    threadB = await db.messageThread.create({
      data: { projectId: projectB.id, subject: "Project B", withSupplier: true },
    });
  });

  afterAll(async () => {
    await destroyOrg(organizationId);
  });

  it("does not list another supplier's projects", async () => {
    const result = await listProjects(supplierA);
    expect(result.items.map((project) => project.id)).toEqual([projectA.id]);
    expect(result.total).toBe(1);
  });

  it("refuses direct access to another supplier's project", async () => {
    await expect(requireProjectAccess(supplierA, projectB.id)).rejects.toBeInstanceOf(NotFoundError);
    // …while the owning supplier can reach it.
    await expect(requireProjectAccess(supplierB, projectB.id)).resolves.toMatchObject({
      id: projectB.id,
    });
  });

  it("refuses direct access to another supplier's document", async () => {
    await expect(requireDocumentAccess(supplierA, documentB.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(requireDocumentAccess(supplierB, documentB.id)).resolves.toMatchObject({
      id: documentB.id,
    });
  });

  it("does not list another supplier's documents", async () => {
    const result = await listDocuments(supplierA);
    expect(result.items).toHaveLength(0);
  });

  it("refuses direct access to another supplier's task", async () => {
    await expect(requireTaskAccess(supplierA, taskB.id)).rejects.toBeInstanceOf(NotFoundError);
    const result = await listTasks(supplierA);
    expect(result.items).toHaveLength(0);
  });

  it("refuses direct access to another supplier's document request", async () => {
    await expect(requireDocumentRequestAccess(supplierA, requestB.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(requireDocumentRequestAccess(supplierB, requestB.id)).resolves.toMatchObject({
      id: requestB.id,
    });
  });

  it("refuses direct access to another supplier's message thread", async () => {
    await expect(requireThreadAccess(supplierA, threadB.id)).rejects.toBeInstanceOf(NotFoundError);
    const threads = await listThreads(supplierA);
    expect(threads).toHaveLength(0);
  });

  it("refuses to read another supplier's company record", async () => {
    await expect(requireSupplierAccess(supplierA, supplierBId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const visible = await listSuppliers(supplierA);
    expect(visible.map((supplier) => supplier.name)).toEqual(["Manufacturer A"]);
  });

  it("hides internal-only documents from the supplier that owns the project", async () => {
    const internalDoc = await db.document.create({
      data: {
        organizationId,
        projectId: projectB.id,
        supplierId: supplierBId,
        createdById: internal.id,
        name: "Internal margin analysis",
        type: "COMMERCIAL",
        visibility: "INTERNAL_ONLY",
      },
    });

    await expect(requireDocumentAccess(supplierB, internalDoc.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const asSupplier = await listDocuments(supplierB);
    expect(asSupplier.items.map((doc) => doc.id)).not.toContain(internalDoc.id);

    const asInternal = await listDocuments(internal);
    expect(asInternal.items.map((doc) => doc.id)).toContain(internalDoc.id);
  });

  it("scopes global search to the caller's own supplier", async () => {
    const forA = await search(supplierA, "Project");
    expect(forA.map((hit) => hit.title)).toEqual(["Project A"]);

    const forB = await search(supplierB, "Project");
    expect(forB.map((hit) => hit.title)).toEqual(["Project B"]);

    const internalHits = await search(internal, "Project");
    expect(internalHits.map((hit) => hit.title)).toEqual(
      expect.arrayContaining(["Project A", "Project B"]),
    );
  });

  it("never returns the supplier directory to a supplier session", async () => {
    const hits = await search(supplierA, "Manufacturer");
    expect(hits.some((hit) => hit.kind === "supplier")).toBe(false);

    const internalHits = await search(internal, "Manufacturer");
    expect(internalHits.some((hit) => hit.kind === "supplier")).toBe(true);
  });

  it("ignores search terms that are too short to be meaningful", async () => {
    expect(await search(internal, "")).toEqual([]);
    expect(await search(internal, "a")).toEqual([]);
  });

  it("keeps internal-only documents out of a supplier's search results", async () => {
    const hidden = await db.document.create({
      data: {
        organizationId,
        projectId: projectB.id,
        supplierId: supplierBId,
        createdById: internal.id,
        name: "Confidential pricing memo",
        type: "COMMERCIAL",
        visibility: "INTERNAL_ONLY",
      },
    });

    const forB = await search(supplierB, "Confidential");
    expect(forB).toHaveLength(0);

    const forInternal = await search(internal, "Confidential");
    expect(forInternal.map((hit) => hit.id)).toContain(hidden.id);
  });

  it("lets the internal team see every project in the organisation", async () => {
    const result = await listProjects(internal);
    const ids = result.items.map((project) => project.id);
    expect(ids).toContain(projectA.id);
    expect(ids).toContain(projectB.id);
  });
});
