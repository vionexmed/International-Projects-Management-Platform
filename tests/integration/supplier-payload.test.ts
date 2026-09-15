import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  requireProjectAccess,
  requireSharedProjectAccess,
} from "@/server/authz/access";
import { INTERNAL_ONLY_FIELDS } from "@/server/authz/projections";
import {
  getProjectWorkspace,
  getSupplierProjectWorkspace,
} from "@/server/services/projects";
import { listProjectTimeline } from "@/server/services/timeline";
import { recordTimelineEvent } from "@/server/services/timeline";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

/**
 * What the supplier's browser receives.
 *
 * A server component ships every field it was handed, whether or not the JSX
 * renders it: the RSC payload is a serialisation of the data, not of the
 * markup. So "we simply don't display it" is not a control, and a test that
 * only checked the rendered output would have passed while the internal notes
 * travelled anyway.
 *
 * These tests therefore serialise the exact object the portal page receives and
 * look for the values inside it. They are written to fail if somebody widens a
 * query later — which is the realistic way this breaks.
 */

const SECRETS = {
  projectDescription: "SENTINEL-project-description-internal",
  blockerNote: "SENTINEL-blocker-supplier-unresponsive-consider-replacing",
  stageNotes: "SENTINEL-stage-notes-margin-below-competitor",
  milestoneDescription: "SENTINEL-milestone-internal-detail",
};

let organizationId: string;
let supplierUser: SessionUser;
let internalUser: SessionUser;
let projectId: string;

beforeAll(async () => {
  const org = await createTestOrg("Payload");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `Manufacturer ${org.slug}`);
  internalUser = await createUser({ organizationId, role: "ADMIN" });
  supplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplier.id,
  });

  const project = await createProject({
    organizationId,
    supplierId: supplier.id,
    ownerId: internalUser.id,
    name: "Payload Project",
  });
  projectId = project.id;

  // Every internal field carries a sentinel, so a leak is unmistakable.
  await db.project.update({
    where: { id: projectId },
    data: {
      description: SECRETS.projectDescription,
      blockerNote: SECRETS.blockerNote,
    },
  });
  await db.projectStage.updateMany({
    where: { projectId },
    data: { notes: SECRETS.stageNotes },
  });
  await db.milestone.create({
    data: {
      projectId,
      title: "Visible milestone",
      description: SECRETS.milestoneDescription,
      stage: "CLINICAL",
    },
  });
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("supplier project payload", () => {
  it("carries none of the internal text", async () => {
    const workspace = await getSupplierProjectWorkspace(supplierUser, projectId);
    const payload = JSON.stringify(workspace);

    for (const [field, secret] of Object.entries(SECRETS)) {
      expect(payload, `${field} reached the supplier payload`).not.toContain(secret);
    }
  });

  it("carries none of the internal field names either", async () => {
    // Names matter as well as values: an empty `blockerNote` today is a
    // populated one tomorrow, and the shape is what future code will rely on.
    const workspace = await getSupplierProjectWorkspace(supplierUser, projectId);

    for (const field of INTERNAL_ONLY_FIELDS.project) {
      expect(Object.keys(workspace.project)).not.toContain(field);
    }
    for (const stage of workspace.stages) {
      for (const field of INTERNAL_ONLY_FIELDS.projectStage) {
        expect(Object.keys(stage)).not.toContain(field);
      }
    }
    for (const milestone of workspace.milestones) {
      for (const field of INTERNAL_ONLY_FIELDS.milestone) {
        expect(Object.keys(milestone)).not.toContain(field);
      }
    }
  });

  it("still carries everything the portal needs", async () => {
    // A projection that leaks nothing because it returns nothing would pass
    // the tests above. This one fails if the fix went too far.
    const workspace = await getSupplierProjectWorkspace(supplierUser, projectId);

    expect(workspace.project.name).toBe("Payload Project");
    expect(workspace.project.currentStage).toBeTruthy();
    expect(workspace.project.supplier.name).toContain("Manufacturer");
    expect(workspace.stages).toHaveLength(4);
    expect(workspace.stages[0]).toHaveProperty("computedProgress");
    expect(workspace.milestones[0]?.title).toBe("Visible milestone");
    expect(typeof workspace.progress).toBe("number");
  });

  it("reports the same progress the internal workspace reports", async () => {
    // The supplier should see the real number, not a softened one. Only the
    // commentary is withheld.
    const [internal, external] = await Promise.all([
      getProjectWorkspace(internalUser, projectId),
      getSupplierProjectWorkspace(supplierUser, projectId),
    ]);

    expect(external.progress).toBe(internal.progress);
    expect(external.stages.map((stage) => stage.computedProgress)).toEqual(
      internal.stages.map((stage) => stage.computedProgress),
    );
  });

  it("refuses a supplier session on the internal-only accessor", async () => {
    // Fail closed: a new portal page that reaches for the wrong function
    // breaks on the first request rather than leaking quietly.
    await expect(requireProjectAccess(supplierUser, projectId)).rejects.toThrow(
      /cannot serve a supplier session/i,
    );
  });

  it("keeps the shared accessor narrow for internal callers too", async () => {
    const project = await requireSharedProjectAccess(internalUser, projectId);
    expect(Object.keys(project)).not.toContain("blockerNote");
    expect(project.name).toBe("Payload Project");
  });

  it("still returns the internal fields to the internal workspace", async () => {
    // The other half of the guarantee: Vionex must not lose its own notes.
    const workspace = await getProjectWorkspace(internalUser, projectId);
    expect(workspace.project.blockerNote).toBe(SECRETS.blockerNote);
    expect(workspace.stages[0]?.notes).toBe(SECRETS.stageNotes);
  });
});

describe("supplier timeline", () => {
  it("hides events marked internal", async () => {
    await recordTimelineEvent({
      projectId,
      actorId: internalUser.id,
      type: "TASK_CREATED",
      description: "SENTINEL-internal-task-do-not-show",
      internal: true,
    });
    await recordTimelineEvent({
      projectId,
      actorId: internalUser.id,
      type: "DOCUMENT_REQUESTED",
      description: "SENTINEL-shared-event",
    });

    const visible = await listProjectTimeline(supplierUser, projectId);
    const payload = JSON.stringify(visible);

    expect(payload).not.toContain("SENTINEL-internal-task-do-not-show");
    expect(payload).toContain("SENTINEL-shared-event");
  });
});
