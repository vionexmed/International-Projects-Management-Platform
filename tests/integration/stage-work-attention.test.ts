import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { listAttentionItems } from "@/server/services/attention";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

/**
 * Fase 1 of the architecture-simplification plan taught triage about
 * shipments stuck past their ETA — the one of the three additions (alongside
 * regulatory and GTM items) that stayed a table of its own through Fase 3,
 * because it carries real fields (port, tracking number, ETA) a task cannot.
 * Regulatory and GTM items became `Task` rows in Fase 3 and are covered by
 * the generic `TASK_OVERDUE` case in `information-architecture.test.ts`
 * instead of here.
 */
let organizationId: string;
let admin: SessionUser;
let projectId: string;

const DAY = 24 * 60 * 60 * 1000;
const past = (days: number) => new Date(Date.now() - days * DAY);
const future = (days: number) => new Date(Date.now() + days * DAY);

beforeAll(async () => {
  const org = await createTestOrg("StageWork");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `Maker ${org.slug}`);
  admin = await createUser({ organizationId, role: "ADMIN" });

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

  it("CUSTOMS counts as arrived, not late", async () => {
    const shipment = await db.importShipment.create({
      data: { projectId, reference: "SHP-003", stage: "CUSTOMS", eta: past(1) },
    });

    const items = await listAttentionItems(admin, 50);
    expect(items.some((row) => row.id === `shipment:${shipment.id}`)).toBe(false);

    await db.importShipment.delete({ where: { id: shipment.id } });
  });
});
