import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createTask, updateTask } from "@/server/services/tasks";
import { getProjectWorkspace } from "@/server/services/projects";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

let organizationId: string;
let projectId: string;
let admin: SessionUser;

beforeAll(async () => {
  const org = await createTestOrg("StageTaskReconciliation");
  organizationId = org.id;
  const supplier = await createSupplier(organizationId, `Maker ${org.slug}`);
  admin = await createUser({ organizationId, role: "ADMIN" });
  projectId = (await createProject({
    organizationId,
    supplierId: supplier.id,
    ownerId: admin.id,
    name: "Stage task reconciliation",
  })).id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

describe("stage status after task writes", () => {
  it("reopens a completed Clinical stage when a new open task is added, then completes it with the task", async () => {
    await db.projectStage.update({
      where: { projectId_key: { projectId, key: "CLINICAL" } },
      data: { status: "COMPLETED", progress: 100 },
    });

    const task = await createTask(admin, {
      projectId,
      title: "Clinical follow-up",
      category: "CLINICAL",
      priority: "MEDIUM",
    });

    let workspace = await getProjectWorkspace(admin, projectId);
    let clinical = workspace.stages.find((stage) => stage.key === "CLINICAL");
    expect(clinical).toMatchObject({ status: "IN_PROGRESS", progress: null, computedProgress: 0 });
    expect(workspace.project.currentStage).toBe("CLINICAL");

    await updateTask(admin, task.id, { status: "COMPLETED" });

    workspace = await getProjectWorkspace(admin, projectId);
    clinical = workspace.stages.find((stage) => stage.key === "CLINICAL");
    expect(clinical).toMatchObject({ status: "COMPLETED", progress: null, computedProgress: 100 });
    expect(workspace.project.currentStage).toBe("REGULATORY");

    await updateTask(admin, task.id, { status: "OPEN" });
    workspace = await getProjectWorkspace(admin, projectId);
    clinical = workspace.stages.find((stage) => stage.key === "CLINICAL");
    expect(clinical).toMatchObject({ status: "IN_PROGRESS", progress: null, computedProgress: 0 });
    expect(workspace.project.currentStage).toBe("CLINICAL");
  });

  it("preserves a nonterminal manual progress override with incomplete tasks", async () => {
    await db.projectStage.update({
      where: { projectId_key: { projectId, key: "REGULATORY" } },
      data: { status: "IN_PROGRESS", progress: 60 },
    });

    await createTask(admin, {
      projectId,
      title: "Regulatory review",
      category: "REGULATORY",
      priority: "MEDIUM",
    });

    const workspace = await getProjectWorkspace(admin, projectId);
    expect(workspace.stages.find((stage) => stage.key === "REGULATORY")).toMatchObject({
      status: "IN_PROGRESS", progress: 60, computedProgress: 60,
    });
  });
});
