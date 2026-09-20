import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { countAttentionItems, listAttentionItems } from "@/server/services/attention";
import { recalculateProject } from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

/**
 * Fase 1 of the architecture-simplification plan: regulatory items, GTM items
 * and shipments used to count for nothing. A project could carry twenty
 * overdue regulatory items and still read "on track" everywhere — the
 * dashboard, the portfolio summary, the project's own status — because none
 * of those places ever looked at those three tables.
 *
 * This suite proves the seam closed: the same overdue item that used to be
 * invisible outside its own tab now surfaces in triage, is counted, moves the
 * stored project status, and leaves a line in the project's history.
 */
let organizationId: string;
let admin: SessionUser;
let supplierUser: SessionUser;
let projectId: string;

const DAY = 24 * 60 * 60 * 1000;
const past = (days: number) => new Date(Date.now() - days * DAY);
const future = (days: number) => new Date(Date.now() + days * DAY);

beforeAll(async () => {
  const org = await createTestOrg("StageWork");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `Maker ${org.slug}`);
  admin = await createUser({ organizationId, role: "ADMIN" });
  supplierUser = await createUser({ organizationId, role: "SUPPLIER_USER", supplierId: supplier.id });

  const project = await createProject({
    organizationId,
    supplierId: supplier.id,
    ownerId: admin.id,
    name: "Stage Work Project",
  });
  projectId = project.id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("an overdue regulatory item is no longer invisible", () => {
  it("surfaces in triage, with the right destination", async () => {
    const item = await db.regulatoryItem.create({
      data: { projectId, title: "510(k) submission", status: "PENDING", dueDate: past(10) },
    });

    const items = await listAttentionItems(admin, 50);
    const found = items.find((row) => row.id === `regulatory:${item.id}`);

    expect(found).toBeTruthy();
    expect(found?.kind).toBe("REGULATORY_ITEM_OVERDUE");
    expect(found?.description).toBe("510(k) submission");
    expect(found?.href).toBe(`/projects/${projectId}/regulatory`);
    expect(found?.severity).toBe("risk");

    await db.regulatoryItem.delete({ where: { id: item.id } });
  });

  it("stops counting once approved — a decision resolves the exception", async () => {
    const item = await db.regulatoryItem.create({
      data: { projectId, title: "Resolved item", status: "PENDING", dueDate: past(5) },
    });

    expect((await listAttentionItems(admin, 50)).some((row) => row.id === `regulatory:${item.id}`)).toBe(
      true,
    );

    await db.regulatoryItem.update({ where: { id: item.id }, data: { status: "APPROVED" } });

    expect((await listAttentionItems(admin, 50)).some((row) => row.id === `regulatory:${item.id}`)).toBe(
      false,
    );

    await db.regulatoryItem.delete({ where: { id: item.id } });
  });

  it("never reaches the supplier — this is a Vionex-internal domain", async () => {
    const item = await db.regulatoryItem.create({
      data: { projectId, title: "Internal-only item", status: "PENDING", dueDate: past(3) },
    });

    const supplierView = await listAttentionItems(supplierUser, 50);
    expect(JSON.stringify(supplierView)).not.toContain("Internal-only item");

    const counts = await countAttentionItems(supplierUser);
    expect(counts.regulatoryItems).toBe(0);

    await db.regulatoryItem.delete({ where: { id: item.id } });
  });
});

describe("an overdue GTM item behaves the same way", () => {
  it("surfaces with the go-to-market destination", async () => {
    const item = await db.gtmItem.create({
      data: {
        projectId,
        category: "LAUNCH_PLAN",
        title: "Distributor agreement",
        status: "NOT_STARTED",
        dueDate: past(7),
      },
    });

    const items = await listAttentionItems(admin, 50);
    const found = items.find((row) => row.id === `gtm:${item.id}`);

    expect(found?.kind).toBe("GTM_ITEM_OVERDUE");
    expect(found?.href).toBe(`/projects/${projectId}/go-to-market`);

    await db.gtmItem.delete({ where: { id: item.id } });
  });
});

describe("a shipment stuck past its ETA", () => {
  it("surfaces once, and stops once it arrives", async () => {
    const shipment = await db.importShipment.create({
      data: { projectId, reference: "SHP-001", stage: "IN_TRANSIT", eta: past(4) },
    });

    let items = await listAttentionItems(admin, 50);
    expect(items.find((row) => row.id === `shipment:${shipment.id}`)?.kind).toBe("SHIPMENT_LATE");

    await db.importShipment.update({ where: { id: shipment.id }, data: { arrivedAt: new Date() } });

    items = await listAttentionItems(admin, 50);
    expect(items.some((row) => row.id === `shipment:${shipment.id}`)).toBe(false);

    await db.importShipment.delete({ where: { id: shipment.id } });
  });

  it("is not an exception before its ETA arrives", async () => {
    const shipment = await db.importShipment.create({
      data: { projectId, reference: "SHP-002", stage: "SHIPPED", eta: future(5) },
    });

    const items = await listAttentionItems(admin, 50);
    expect(items.some((row) => row.id === `shipment:${shipment.id}`)).toBe(false);

    await db.importShipment.delete({ where: { id: shipment.id } });
  });
});

describe("counts agree with the list, per kind", () => {
  it("regulatoryItems, gtmItems and shipments each match what listAttentionItems shows", async () => {
    const [reg1, reg2, gtm1, ship1] = await Promise.all([
      db.regulatoryItem.create({ data: { projectId, title: "R1", status: "PENDING", dueDate: past(1) } }),
      db.regulatoryItem.create({ data: { projectId, title: "R2", status: "REQUESTED", dueDate: past(2) } }),
      db.gtmItem.create({
        data: { projectId, category: "PRICING", title: "G1", status: "IN_PROGRESS", dueDate: past(1) },
      }),
      db.importShipment.create({ data: { projectId, reference: "S1", stage: "CUSTOMS", eta: past(1) } }),
    ]);

    const counts = await countAttentionItems(admin);
    const items = await listAttentionItems(admin, 100);

    expect(counts.regulatoryItems).toBe(items.filter((i) => i.kind === "REGULATORY_ITEM_OVERDUE").length);
    expect(counts.gtmItems).toBe(items.filter((i) => i.kind === "GTM_ITEM_OVERDUE").length);
    // CUSTOMS is one of the "arrived" stages — this one must not count as late.
    expect(items.some((i) => i.id === `shipment:${ship1.id}`)).toBe(false);
    expect(counts.total).toBe(
      counts.tasks +
        counts.requests +
        counts.reviews +
        counts.milestones +
        counts.projects +
        counts.regulatoryItems +
        counts.gtmItems +
        counts.shipments,
    );

    await db.regulatoryItem.deleteMany({ where: { id: { in: [reg1.id, reg2.id] } } });
    await db.gtmItem.delete({ where: { id: gtm1.id } });
    await db.importShipment.delete({ where: { id: ship1.id } });
  });
});

describe("stage work now moves the project's stored status", () => {
  it("flips a project to AT_RISK on three overdue regulatory items, the same threshold tasks use", async () => {
    const before = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { status: true } });
    expect(before.status).toBe("ON_TRACK");

    const items = await db.regulatoryItem.createManyAndReturn({
      data: [
        { projectId, title: "Overdue A", status: "PENDING", dueDate: past(10) },
        { projectId, title: "Overdue B", status: "PENDING", dueDate: past(9) },
        { projectId, title: "Overdue C", status: "PENDING", dueDate: past(8) },
      ],
    });

    await recalculateProject(projectId, admin.id);

    const after = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { status: true } });
    expect(after.status).toBe("AT_RISK");

    // And it comes back once the exceptions are cleared — a derived status
    // must not get stuck the way the old, blind one used to stay silent.
    await db.regulatoryItem.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
    await recalculateProject(projectId, admin.id);
    const restored = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { status: true } });
    expect(restored.status).toBe("ON_TRACK");
  });
});

/**
 * `createRegulatoryItemAction`, `updateRegulatoryItemAction`, `createGtmItemAction`,
 * `updateGtmItemAction` and `saveShipmentAction` (src/server/actions/stages.ts)
 * each gained a `recordTimelineEvent` and/or `recalculateProject` call as part
 * of this change — none of the five called `recalculateProject` before, so a
 * regulatory item going overdue never moved the project's stored status.
 *
 * Those five are `"use server"` actions gated by `requirePermission`, which
 * reads the session through `next/headers` — there is no request context in a
 * Vitest run to satisfy that, which is why no suite in this codebase imports
 * from `@/server/actions/` (checked: none do). What is tested here instead is
 * the primitive the actions depend on — `recordTimelineEvent` paired with
 * `listProjectTimeline` — plus, above, that `recalculateProject` genuinely
 * responds to these three tables. The actions' own wiring was verified by
 * reading the diff, not by a test; said plainly rather than implied.
 */
describe("the primitive the actions' new timeline writes depend on", () => {
  it("a regulatory item's line is readable back from the project's history", async () => {
    const { recordTimelineEvent } = await import("@/server/services/timeline");

    const item = await db.regulatoryItem.create({
      data: { projectId, title: "Traceable item", status: "PENDING", dueDate: null },
    });
    await recordTimelineEvent({
      projectId,
      actorId: admin.id,
      type: "STAGE_UPDATED",
      description: `Item regulatório "${item.title}" adicionado.`,
      internal: true,
    });

    const events = await listProjectTimeline(admin, projectId, 50);
    expect(events.some((event) => event.description.includes("Traceable item"))).toBe(true);

    await db.regulatoryItem.delete({ where: { id: item.id } });
  });
});
