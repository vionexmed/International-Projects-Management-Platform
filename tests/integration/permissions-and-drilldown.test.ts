import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  countDocumentRequestsByQueue,
  createDocumentRequest,
  listDocumentRequests,
  reviewDocumentRequest,
  submitDocumentRequest,
  uploadDocument,
} from "@/server/services/documents";
import { getRegulatoryPerformance } from "@/server/services/analytics";
import { listProjects } from "@/server/services/projects";
import { createTask } from "@/server/services/tasks";
import { listProjectTimeline } from "@/server/services/timeline";
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
 * PERM-1, PERM-2, PERM-4 — enforced by the server, not by the screen.
 *
 * The three permission questions left open since the audit, each closed here
 * against the service that actually performs the write. The unit matrix says
 * which role holds which capability; these say that holding it, or not,
 * changes what the database ends up containing.
 *
 * The drill-down tests belong with them because they are the same kind of
 * claim: a number a person is invited to trust has to be the number they get
 * when they click it.
 */
let organizationId: string;
let admin: SessionUser;
let regulatory: SessionUser;
let importUser: SessionUser;
let marketing: SessionUser;
let viewer: SessionUser;
let supplierUser: SessionUser;
let projectId: string;

const DAY = 24 * 60 * 60 * 1000;

async function requestOf(title: string) {
  return db.documentRequest.findFirstOrThrow({
    where: { projectId, title },
    select: { id: true, status: true, type: true },
  });
}

beforeAll(async () => {
  const org = await createTestOrg("Perm");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `Maker ${org.slug}`);

  admin = await createUser({ organizationId, role: "ADMIN" });
  regulatory = await createUser({ organizationId, role: "REGULATORY" });
  importUser = await createUser({ organizationId, role: "IMPORT" });
  marketing = await createUser({ organizationId, role: "MARKETING" });
  viewer = await createUser({ organizationId, role: "VIEWER" });
  supplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplier.id,
  });

  const project = await createProject({
    organizationId,
    supplierId: supplier.id,
    ownerId: admin.id,
    name: "Perm Project",
  });
  projectId = project.id;

  // One request per domain, each submitted so it is waiting for a decision.
  for (const [title, type] of [
    ["Certificate for review", "CERTIFICATE"],
    ["Customs invoice", "IMPORT"],
    ["Launch deck", "COMMERCIAL"],
    ["Signed contract", "CONTRACT"],
  ] as const) {
    const created = await createDocumentRequest(admin, {
      projectId,
      title,
      type,
      createTask: true,
      dueDate: new Date(Date.now() + 7 * DAY),
    });
    await submitDocumentRequest(supplierUser, created.id, { file: makeFile(`${type}.pdf`) });
  }

  // An overdue one, left waiting on the supplier, for the drill-down tests.
  await createDocumentRequest(admin, {
    projectId,
    title: "Late certificate",
    type: "CERTIFICATE",
    createTask: true,
    dueDate: new Date(Date.now() - 4 * DAY),
  });
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("PERM-1 · editing the project belongs to whoever runs it", () => {
  it("refuses a domain specialist and a viewer", async () => {
    const { roleHas } = await import("@/server/authz/permissions");

    for (const role of ["REGULATORY", "IMPORT", "MARKETING", "VIEWER"] as const) {
      expect(roleHas(role, "project:update")).toBe(false);
    }
    expect(roleHas("ADMIN", "project:update")).toBe(true);
    expect(roleHas("MANAGER", "project:update")).toBe(true);
  });

  it("still lets each specialist manage their own stage", async () => {
    const { STAGE_PERMISSION, roleHas } = await import("@/server/authz/permissions");

    expect(roleHas("REGULATORY", STAGE_PERMISSION.REGULATORY)).toBe(true);
    expect(roleHas("IMPORT", STAGE_PERMISSION.IMPORT_LOGISTICS)).toBe(true);
    expect(roleHas("MARKETING", STAGE_PERMISSION.GO_TO_MARKET)).toBe(true);

    // And not each other's.
    expect(roleHas("MARKETING", STAGE_PERMISSION.REGULATORY)).toBe(false);
    expect(roleHas("IMPORT", STAGE_PERMISSION.GO_TO_MARKET)).toBe(false);
  });
});

describe("PERM-2 · a document is reviewed by the domain it belongs to", () => {
  it("lets the regulatory role decide a certificate", async () => {
    const request = await requestOf("Certificate for review");
    await reviewDocumentRequest(regulatory, request.id, {
      status: "APPROVED",
      note: "Approved.",
    });

    const after = await requestOf("Certificate for review");
    expect(after.status).toBe("APPROVED");
  });

  it("refuses the regulatory role a customs invoice", async () => {
    const request = await requestOf("Customs invoice");
    await expect(
      reviewDocumentRequest(regulatory, request.id, { status: "APPROVED" }),
    ).rejects.toThrow();

    // And the refusal is real: the row did not move.
    expect((await requestOf("Customs invoice")).status).toBe("SUBMITTED");
  });

  it("lets the import role decide it instead", async () => {
    const request = await requestOf("Customs invoice");
    await reviewDocumentRequest(importUser, request.id, { status: "APPROVED" });
    expect((await requestOf("Customs invoice")).status).toBe("APPROVED");
  });

  it("keeps commercial material with marketing", async () => {
    const request = await requestOf("Launch deck");
    await expect(
      reviewDocumentRequest(importUser, request.id, { status: "APPROVED" }),
    ).rejects.toThrow();

    await reviewDocumentRequest(marketing, request.id, { status: "APPROVED" });
    expect((await requestOf("Launch deck")).status).toBe("APPROVED");
  });

  it("fails closed on a document whose type names no domain", async () => {
    /**
     * A contract could belong to anyone. Rather than guessing — and an
     * approval is precisely what a regulatory file needs to be able to trust —
     * only the roles that run projects may decide it.
     */
    const request = await requestOf("Signed contract");

    for (const specialist of [regulatory, importUser, marketing]) {
      await expect(
        reviewDocumentRequest(specialist, request.id, { status: "APPROVED" }),
      ).rejects.toThrow();
    }

    await reviewDocumentRequest(admin, request.id, { status: "APPROVED" });
    expect((await requestOf("Signed contract")).status).toBe("APPROVED");
  });

  it("never lets a viewer or a supplier decide anything", async () => {
    const request = await requestOf("Late certificate");

    await expect(
      reviewDocumentRequest(viewer, request.id, { status: "APPROVED" }),
    ).rejects.toThrow();
    await expect(
      reviewDocumentRequest(supplierUser, request.id, { status: "APPROVED" }),
    ).rejects.toThrow();

    expect((await requestOf("Late certificate")).status).toBe("PENDING");
  });
});

describe("PERM-4 · a VIEWER is an internal reader, not a lesser one", () => {
  it("reads internal-only documents of the projects it can see", async () => {
    await uploadDocument(admin, {
      projectId,
      name: "Internal margin note",
      type: "COMMERCIAL",
      visibility: "INTERNAL_ONLY",
      file: makeFile("margin.pdf"),
    });

    const { listDocuments } = await import("@/server/services/documents");
    const visible = await listDocuments(viewer, { projectId });

    /**
     * `INTERNAL_ONLY` means "not visible to the supplier". It has never meant
     * "not visible to junior internal staff", and reading it the second way
     * would make a read-only role useless for the one audience it serves.
     */
    expect(visible.items.some((document) => document.name === "Internal margin note")).toBe(true);
  });

  it("reads the internal timeline", async () => {
    const events = await listProjectTimeline(viewer, projectId);
    expect(events.length).toBeGreaterThan(0);
  });

  it("writes nothing", async () => {
    await expect(
      createTask(viewer, {
        projectId,
        title: "Should not exist",
        category: "GENERAL",
        priority: "LOW",
      }),
    ).rejects.toThrow();

    await expect(
      createDocumentRequest(viewer, { projectId, title: "Nope", type: "OTHER" }),
    ).rejects.toThrow();

    await expect(
      uploadDocument(viewer, {
        projectId,
        name: "Nope",
        type: "OTHER",
        file: makeFile("nope.pdf"),
      }),
    ).rejects.toThrow();

    expect(await db.task.count({ where: { projectId, title: "Should not exist" } })).toBe(0);
  });
});

describe("a number and the list it links to are the same set", () => {
  it("agrees on the overdue count", async () => {
    const counts = await countDocumentRequestsByQueue(admin);
    const rows = await listDocumentRequests(admin, { queue: "overdue" });

    expect(rows.length).toBe(counts.overdue);
    expect(counts.overdue).toBeGreaterThan(0);

    // And they really are late and really are waiting on the supplier.
    for (const row of rows) {
      expect(["PENDING", "REJECTED"]).toContain(row.status);
      expect(row.dueDate!.getTime()).toBeLessThan(Date.now());
    }
  });

  it("agrees on every other queue too", async () => {
    const counts = await countDocumentRequestsByQueue(admin);

    for (const queue of ["open", "supplier", "review", "approved", "all"] as const) {
      const rows = await listDocumentRequests(admin, { queue });
      expect(rows.length).toBe(counts[queue]);
    }
  });

  it("pages without losing or repeating a row", async () => {
    const { pageDocumentRequests } = await import("@/server/services/documents");

    // 5 is the service's minimum page size; asking for less does not shrink it.
    const first = await pageDocumentRequests(admin, { queue: "all", page: 1, perPage: 5 });
    const second = await pageDocumentRequests(admin, { queue: "all", page: 2, perPage: 5 });

    const total = (await countDocumentRequestsByQueue(admin)).all;
    expect(first.total).toBe(total);
    expect(first.perPage).toBe(5);
    expect(first.items.length).toBe(Math.min(5, total));
    expect(first.pageCount).toBe(Math.max(1, Math.ceil(total / 5)));

    const ids = new Set([...first.items, ...second.items].map((row) => row.id));
    expect(ids.size).toBe(first.items.length + second.items.length);
  });

  it("reports the same regulatory totals the queue does", async () => {
    const performance = await getRegulatoryPerformance(admin);
    const counts = await countDocumentRequestsByQueue(admin);

    expect(performance.overdue).toBe(counts.overdue);
    expect(performance.approved).toBe(counts.approved);
    expect(performance.total).toBe(counts.all);
  });

  it("keeps the queue inside the caller's scope", async () => {
    const supplierCounts = await countDocumentRequestsByQueue(supplierUser);
    const internalCounts = await countDocumentRequestsByQueue(admin);
    expect(supplierCounts.all).toBeLessThanOrEqual(internalCounts.all);

    const otherOrg = await createTestOrg("PermOther");
    try {
      const otherAdmin = await createUser({ organizationId: otherOrg.id, role: "ADMIN" });
      const counts = await countDocumentRequestsByQueue(otherAdmin);
      expect(counts.all).toBe(0);

      const projects = await listProjects(otherAdmin);
      expect(projects.total).toBe(0);
    } finally {
      await destroyOrg(otherOrg.id);
    }
  });
});
