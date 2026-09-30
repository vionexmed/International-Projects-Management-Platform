import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createDocumentRequest,
  listDocumentRequests,
  reviewDocumentRequest,
  submitDocumentRequest,
  uploadDocument,
} from "@/server/services/documents";
import { createProject, getProjectWorkspace } from "@/server/services/projects";
import { getProjectReport, getSupplierReport, listProjectHealth } from "@/server/services/reports";
import { DOCUMENT_STAGE_CATEGORY, documentTypesForStage } from "@/lib/document-stage";
import { STAGE_TASK_CATEGORY } from "@/server/services/project-health";
import type { DocumentType } from "@/generated/prisma";
import type { SessionUser } from "@/types/auth";
import { createSupplier, createTestOrg, createUser, destroyOrg, makeFile } from "../factories";

/**
 * Every kind of document, through every door: sent directly, requested and
 * answered, reviewed — and each one landing on the stage it belongs to, so the
 * company's stage tracking and its report read what actually happened.
 */
const TYPES = Object.keys(DOCUMENT_STAGE_CATEGORY) as DocumentType[];
const FAR_FUTURE = () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

let organizationId: string;
let internal: SessionUser;
let supplier: SessionUser;
let supplierId: string;
let projectId: string;

beforeAll(async () => {
  const org = await createTestOrg("Document types");
  organizationId = org.id;
  const company = await createSupplier(organizationId, "Manufacturer Types", "Germany");
  supplierId = company.id;
  internal = await createUser({ organizationId, role: "ADMIN", name: "Lucas" });
  supplier = await createUser({ organizationId, role: "SUPPLIER_ADMIN", name: "Anna", supplierId });
  const project = await createProject(internal, {
    name: "Product Types",
    projectCode: "T-TYPES",
    supplierId,
    ownerId: internal.id,
    country: "Germany",
  });
  projectId = project.id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("every document type", () => {
  it("maps to exactly one stage, and every stage page can list its types", () => {
    const listed = Object.values(STAGE_TASK_CATEGORY).flatMap((category) => documentTypesForStage(category));
    expect([...listed].sort()).toEqual([...TYPES].sort());
  });

  it.each(TYPES)("%s · can be sent directly by Vionex and by the supplier", async (type) => {
    const fromVionex = await uploadDocument(internal, { projectId, file: makeFile(`${type}-vionex.pdf`), name: `${type} Vionex`, type });
    const fromSupplier = await uploadDocument(supplier, { projectId, file: makeFile(`${type}-supplier.pdf`), name: `${type} fornecedor`, type });
    for (const document of [fromVionex, fromSupplier]) {
      const stored = await db.document.findUniqueOrThrow({ where: { id: document.id }, include: { versions: true } });
      expect(stored.type).toBe(type);
      expect(stored.versions).toHaveLength(1);
    }
  });

  it.each(TYPES)("%s · requested, answered and approved, on its own stage", async (type) => {
    const request = await createDocumentRequest(internal, {
      projectId,
      title: `Pedido ${type}`,
      type,
      dueDate: FAR_FUTURE(),
      createTask: true,
    });
    expect(request.status).toBe("PENDING");
    expect((await listDocumentRequests(supplier)).map((row) => row.id)).toContain(request.id);

    const mirror = await db.task.findUniqueOrThrow({ where: { id: request.taskId! } });
    expect(mirror.category).toBe(DOCUMENT_STAGE_CATEGORY[type]);

    await submitDocumentRequest(supplier, request.id, { file: makeFile(`${type}.pdf`), message: "Segue o documento." });
    expect((await db.documentRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("SUBMITTED");

    await reviewDocumentRequest(internal, request.id, { status: "APPROVED", note: "Aprovado." });
    expect((await db.documentRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("APPROVED");
    expect((await db.task.findUniqueOrThrow({ where: { id: request.taskId! } })).status).toBe("COMPLETED");
  });
});

describe("the company's stage tracking", () => {
  it("counts each approved request as done work on its stage", async () => {
    const workspace = await getProjectWorkspace(internal, projectId);
    for (const stage of workspace.stages) {
      const expected = TYPES.filter((type) => DOCUMENT_STAGE_CATEGORY[type] === STAGE_TASK_CATEGORY[stage.key]).length;
      const tasks = await db.task.findMany({ where: { projectId, category: STAGE_TASK_CATEGORY[stage.key] } });
      expect(tasks.filter((task) => task.status === "COMPLETED")).toHaveLength(expected);
      if (expected > 0 && stage.progress === null) expect(stage.computedProgress).toBe(100);
    }
  });

  it("shows up in the project and company reports", async () => {
    const health = await listProjectHealth(internal);
    expect(health.map((row) => row.id)).toContain(projectId);

    const project = await getProjectReport(internal, projectId);
    expect(project?.requests).toHaveLength(TYPES.length);
    expect(project?.health.owed).toBe(0);

    const company = await getSupplierReport(internal, supplierId);
    expect(company?.projects.map((row) => row.id)).toEqual([projectId]);
    expect(company?.owed).toHaveLength(0);
    expect(company?.received.length).toBeGreaterThan(0);
  });

  it("a request still owed is counted until it arrives", async () => {
    await createDocumentRequest(internal, { projectId, title: "Pendente", type: "CLINICAL", dueDate: FAR_FUTURE(), createTask: true });
    const company = await getSupplierReport(internal, supplierId);
    expect(company?.owed.map((row) => row.title)).toContain("Pendente");
    const row = (await listProjectHealth(internal)).find((item) => item.id === projectId);
    expect(row?.owed).toBe(1);
  });
});
