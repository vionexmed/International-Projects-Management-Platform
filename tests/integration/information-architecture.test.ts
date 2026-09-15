import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { countAttentionItems, listAttentionItems } from "@/server/services/attention";
import { countSupplierQueue, listSupplierQueue } from "@/server/services/supplier-queue";
import {
  getDeadlineBreakdown,
  getPortfolioBreakdown,
  getRegulatoryPerformance,
  getSupplierPerformance,
} from "@/server/services/analytics";
import { listProjects } from "@/server/services/projects";
import { createDocumentRequest, submitDocumentRequest } from "@/server/services/documents";
import { createTask } from "@/server/services/tasks";
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
 * The reorganisation, from the data's side.
 *
 * PC-6A moved work out of the screens and into three services — exceptions,
 * aggregates, and the supplier's single queue. Each one now decides what a
 * whole page shows, which makes them worth testing directly: a summary that
 * counts differently from the list it links to is a lie the user cannot see.
 *
 * The isolation assertions are repeated here rather than assumed. A new read
 * path is a new way to leak, whatever the old ones do.
 */
let organizationId: string;
let admin: SessionUser;
let supplierUser: SessionUser;
let otherSupplierUser: SessionUser;
let projectId: string;
let otherProjectId: string;

const DAY = 24 * 60 * 60 * 1000;
const past = (days: number) => new Date(Date.now() - days * DAY);

beforeAll(async () => {
  const org = await createTestOrg("IA");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `A ${org.slug}`);
  const other = await createSupplier(organizationId, `B ${org.slug}`, "Germany");

  admin = await createUser({ organizationId, role: "ADMIN" });
  supplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplier.id,
  });
  otherSupplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: other.id,
  });

  const project = await createProject({
    organizationId,
    supplierId: supplier.id,
    ownerId: admin.id,
    name: "IA Project",
  });
  projectId = project.id;

  const otherProject = await createProject({
    organizationId,
    supplierId: other.id,
    ownerId: admin.id,
    name: "Other IA Project",
  });
  otherProjectId = otherProject.id;

  // An overdue task waiting on supplier A.
  await createTask(admin, {
    projectId,
    title: "Send the shipping plan",
    category: "IMPORT",
    priority: "HIGH",
    waitingOnSupplier: true,
    dueDate: past(3),
  });

  // An overdue document request for supplier A.
  await createDocumentRequest(admin, {
    projectId,
    title: "Overdue certificate",
    type: "CERTIFICATE",
    createTask: true,
    dueDate: past(5),
  });

  // And one for supplier B, which A must never see anywhere.
  await createDocumentRequest(admin, {
    projectId: otherProjectId,
    title: "Secret B certificate",
    type: "CERTIFICATE",
    createTask: true,
    dueDate: past(9),
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "BLOCKED", blockerNote: "Aguardando liberação alfandegária." },
  });
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("exceptions, not another project list", () => {
  it("surfaces the overdue task, the overdue request and the blocked project", async () => {
    const items = await listAttentionItems(admin, 20);
    const kinds = items.map((item) => item.kind);

    expect(kinds).toContain("TASK_OVERDUE");
    expect(kinds).toContain("REQUEST_OVERDUE");
    expect(kinds).toContain("PROJECT_BLOCKED");
  });

  it("never lists the mirror task of a document request as a second item", async () => {
    /**
     * `createDocumentRequest(..., createTask: true)` writes a task so the work
     * appears in the internal queue. It is the same pendency as the request,
     * and only the request can be answered — counting both would double every
     * overdue document on the dashboard.
     */
    const items = await listAttentionItems(admin, 50);
    const overdueTitles = items
      .filter((item) => item.kind === "TASK_OVERDUE")
      .map((item) => item.description);

    expect(overdueTitles).not.toContain("Overdue certificate");
  });

  it("gives every item a destination", async () => {
    const items = await listAttentionItems(admin, 50);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.href).toMatch(/^\/(projects|tasks|regulatory|supplier)/);
      expect(item.project.name).toBeTruthy();
    }
  });

  it("counts what it lists", async () => {
    const counts = await countAttentionItems(admin);
    const items = await listAttentionItems(admin, 500);
    expect(counts.total).toBe(items.length);
  });

  it("shows a supplier only their own exceptions", async () => {
    const mine = await listAttentionItems(supplierUser, 50);
    const serialized = JSON.stringify(mine);

    expect(serialized).not.toContain("Secret B certificate");
    expect(serialized).not.toContain("Other IA Project");

    const theirs = await listAttentionItems(otherSupplierUser, 50);
    expect(JSON.stringify(theirs)).not.toContain("Overdue certificate");
  });

  it("does not show a supplier the internal 'waiting for review' exception", async () => {
    await submitDocumentRequest(supplierUser, (await openRequestId()) as string, {
      file: makeFile("cert.pdf"),
    });

    const internal = await listAttentionItems(admin, 50);
    expect(internal.some((item) => item.kind === "REVIEW_WAITING")).toBe(true);

    const supplierSide = await listAttentionItems(supplierUser, 50);
    expect(supplierSide.some((item) => item.kind === "REVIEW_WAITING")).toBe(false);
  });
});

async function openRequestId() {
  const row = await db.documentRequest.findFirst({
    where: { projectId, title: "Overdue certificate" },
    select: { id: true },
  });
  return row?.id;
}

describe("reports aggregate rather than list", () => {
  it("breaks the portfolio down by status, stage and country", async () => {
    const breakdown = await getPortfolioBreakdown(admin);

    expect(breakdown.total).toBeGreaterThan(0);
    expect(breakdown.status.length).toBeGreaterThan(0);
    // Every slice leads somewhere that can list the rows behind it.
    for (const slice of [...breakdown.status, ...breakdown.stage, ...breakdown.country]) {
      expect(slice.href.startsWith("/projects")).toBe(true);
      expect(slice.count).toBeGreaterThan(0);
    }

    const sum = breakdown.status.reduce((total, slice) => total + slice.count, 0);
    expect(sum).toBe(breakdown.total);
  });

  it("separates late work from work that is merely upcoming", async () => {
    const deadlines = await getDeadlineBreakdown(admin);
    expect(deadlines.overdue).toBeGreaterThan(0);
    expect(deadlines.openTotal).toBeGreaterThanOrEqual(deadlines.overdue);
  });

  it("reports an unanswered supplier's response time as unknown, not zero", async () => {
    const rows = await getSupplierPerformance(admin);
    const b = rows.find((row) => row.name.startsWith("B "));

    expect(b).toBeTruthy();
    expect(b?.answered).toBe(0);
    // An average of nothing is not "instant".
    expect(b?.responseDays).toBeNull();
  });

  it("derives a response time once a supplier has actually answered", async () => {
    const rows = await getSupplierPerformance(admin);
    const a = rows.find((row) => row.name.startsWith("A "));
    expect(a?.answered).toBeGreaterThan(0);
    expect(typeof a?.responseDays).toBe("number");
  });

  it("scopes every aggregate to the caller", async () => {
    const supplierView = await getPortfolioBreakdown(supplierUser);
    const internalView = await getPortfolioBreakdown(admin);
    expect(supplierView.total).toBeLessThan(internalView.total);

    const regulatory = await getRegulatoryPerformance(otherSupplierUser);
    // Supplier B has exactly the one request that was created for them.
    expect(regulatory.total).toBe(1);
  });
});

describe("the supplier sees one queue", () => {
  it("puts documents and tasks in the same list", async () => {
    const queue = await listSupplierQueue(supplierUser);
    const types = queue.open.map((item) => item.type);

    expect(types).toContain("TASK");
    expect(queue.open.concat(queue.waiting).some((item) => item.type === "DOCUMENT")).toBe(true);
  });

  it("never shows one pendency twice", async () => {
    const queue = await listSupplierQueue(supplierUser);
    const all = [...queue.open, ...queue.waiting, ...queue.done];

    // The mirror task carries the request's title; if it leaked in, the title
    // would appear under both types.
    const documentTitles = new Set(
      all.filter((item) => item.type === "DOCUMENT").map((item) => item.title),
    );
    for (const task of all.filter((item) => item.type === "TASK")) {
      expect(documentTitles.has(task.title)).toBe(false);
    }

    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
  });

  it("agrees with the badge that points at it", async () => {
    const queue = await listSupplierQueue(supplierUser);
    const counted = await countSupplierQueue(supplierUser);
    expect(counted.open).toBe(queue.open.length);
  });

  it("holds nothing belonging to another supplier", async () => {
    const queue = await listSupplierQueue(otherSupplierUser);
    expect(JSON.stringify(queue)).not.toContain("Overdue certificate");
    expect(JSON.stringify(queue)).not.toContain("Send the shipping plan");
  });

  it("refuses an internal session outright", async () => {
    await expect(listSupplierQueue(admin)).rejects.toThrow();
  });

  it("names a next deadline the queue can actually show", async () => {
    const counted = await countSupplierQueue(supplierUser);
    const queue = await listSupplierQueue(supplierUser);
    const earliest = queue.open
      .map((item) => item.dueDate)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    expect(counted.nextDueDate?.getTime()).toBe(earliest?.getTime());
  });
});

describe("projects stays the canonical list", () => {
  it("filters to the projects that are not going to plan", async () => {
    const attention = await listProjects(admin, { attention: true });
    expect(attention.items.map((project) => project.id)).toContain(projectId);

    const all = await listProjects(admin);
    expect(all.total).toBeGreaterThanOrEqual(attention.total);
  });

  it("keeps the supplier scope when filtered", async () => {
    const theirs = await listProjects(otherSupplierUser, { attention: true });
    expect(theirs.items.map((project) => project.id)).not.toContain(projectId);
  });
});
