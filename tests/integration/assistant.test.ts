import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { answer } from "@/server/services/assistant/answer";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

let orgId: string;
let otherOrgId: string;
let admin: SessionUser;
let otherAdmin: SessionUser;

beforeAll(async () => {
  const org = await createTestOrg("Assistant");
  const otherOrg = await createTestOrg("AssistantOther");
  orgId = org.id;
  otherOrgId = otherOrg.id;
  const supplier = await createSupplier(orgId, "Nimbus Devices", "Alemanha");
  const otherSupplier = await createSupplier(otherOrgId, "Hidden Works");
  admin = await createUser({ organizationId: orgId, role: "ADMIN" });
  otherAdmin = await createUser({ organizationId: otherOrgId, role: "ADMIN" });

  const project = await createProject({ organizationId: orgId, supplierId: supplier.id, ownerId: admin.id, name: "Product Orion" });
  await createProject({ organizationId: otherOrgId, supplierId: otherSupplier.id, ownerId: otherAdmin.id, name: "Product Secret" });

  const yesterday = new Date(Date.now() - 2 * 86_400_000);
  await db.task.create({
    data: { organizationId: orgId, projectId: project.id, createdById: admin.id, assignedToId: admin.id, title: "Enviar dossiê", dueDate: yesterday },
  });
  await db.documentRequest.create({
    data: { projectId: project.id, supplierId: supplier.id, requestedById: admin.id, title: "Certificado ISO 13485", type: "CERTIFICATE" },
  });
});

afterAll(async () => {
  if (orgId) await destroyOrg(orgId);
  if (otherOrgId) await destroyOrg(otherOrgId);
});

describe("platform assistant", () => {
  it("answers a project's status from its records, with a card", async () => {
    const reply = await answer(admin, "Como está o Orion?");
    expect(reply.text).toContain("Product Orion");
    expect(reply.project?.name).toBe("Product Orion");
    expect(reply.project?.facts.find((fact) => fact.label === "Documentos pendentes")?.value).toBe("1");
  });

  it("lists late work and owed documents with links to where they are resolved", async () => {
    const late = await answer(admin, "tarefas atrasadas");
    expect(late.items?.map((item) => item.title)).toContain("Enviar dossiê");
    expect(late.items?.[0].href).toMatch(/^\/tasks\//);

    const owed = await answer(admin, "o que a Nimbus Devices deve enviar?");
    expect(owed.items?.map((item) => item.title)).toContain("Certificado ISO 13485");
  });

  it("never reaches another organisation's projects", async () => {
    const mine = await answer(admin, "como está o portfólio?");
    expect(mine.items?.map((item) => item.title)).toContain("Product Orion");
    expect(mine.items?.map((item) => item.title)).not.toContain("Product Secret");

    const foreign = await answer(otherAdmin, "como está o Orion?");
    expect(foreign.project).toBeUndefined();
    expect(JSON.stringify(foreign)).not.toContain("Product Orion");
  });

  it("says plainly when a question is outside the platform", async () => {
    const reply = await answer(admin, "qual a cor do céu?");
    expect(reply.text).toContain("Não encontrei");
    expect(reply.suggestions.length).toBeGreaterThan(0);
  });
});
