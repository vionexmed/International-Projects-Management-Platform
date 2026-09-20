import { describe, expect, it } from "vitest";
import {
  deriveCurrentStage,
  deriveProjectStatus,
  isOverdue,
  isShipmentLate,
  projectProgress,
  stageProgress,
  type StageSnapshot,
  type TaskSnapshot,
} from "@/server/services/project-health";
import { deriveTaskStatus } from "@/lib/status";

const NOW = new Date("2026-09-03T12:00:00Z");
const past = new Date("2026-08-20T12:00:00Z");
const future = new Date("2026-10-20T12:00:00Z");

const stage = (key: StageSnapshot["key"], overrides: Partial<StageSnapshot> = {}): StageSnapshot => ({
  key,
  status: "IN_PROGRESS",
  progress: null,
  ...overrides,
});

const task = (overrides: Partial<TaskSnapshot> = {}): TaskSnapshot => ({
  category: "REGULATORY",
  status: "OPEN",
  priority: "MEDIUM",
  dueDate: null,
  ...overrides,
});

describe("stage progress", () => {
  it("prefers a manual override", () => {
    expect(stageProgress(stage("REGULATORY", { progress: 72 }), [])).toBe(72);
  });

  it("clamps an out-of-range override", () => {
    expect(stageProgress(stage("REGULATORY", { progress: 140 }), [])).toBe(100);
    expect(stageProgress(stage("REGULATORY", { progress: -20 }), [])).toBe(0);
  });

  it("derives from the share of completed tasks in that stage", () => {
    const tasks = [
      task({ status: "COMPLETED" }),
      task({ status: "COMPLETED" }),
      task({ status: "OPEN" }),
      task({ status: "OPEN" }),
      // Another stage's task must not count.
      task({ category: "CLINICAL", status: "OPEN" }),
    ];
    expect(stageProgress(stage("REGULATORY"), tasks)).toBe(50);
  });

  it("ignores cancelled tasks", () => {
    const tasks = [task({ status: "COMPLETED" }), task({ status: "CANCELLED" })];
    expect(stageProgress(stage("REGULATORY"), tasks)).toBe(100);
  });

  it("falls back to the stage status when there are no tasks", () => {
    expect(stageProgress(stage("CLINICAL", { status: "COMPLETED" }), [])).toBe(100);
    expect(stageProgress(stage("CLINICAL", { status: "NOT_STARTED" }), [])).toBe(0);
  });
});

describe("project progress", () => {
  it("averages the four stages", () => {
    const stages = [
      stage("CLINICAL", { progress: 100 }),
      stage("REGULATORY", { progress: 72 }),
      stage("IMPORT_LOGISTICS", { progress: 20 }),
      stage("GO_TO_MARKET", { progress: 10 }),
    ];
    expect(projectProgress(stages, [])).toBe(51);
  });

  it("returns zero with no stages", () => {
    expect(projectProgress([], [])).toBe(0);
  });
});

describe("derived task status", () => {
  it("marks a past-due open task as overdue", () => {
    expect(deriveTaskStatus("OPEN", past, NOW)).toBe("OVERDUE");
    expect(deriveTaskStatus("WAITING", past, NOW)).toBe("OVERDUE");
  });

  it("never marks completed or cancelled work as overdue", () => {
    expect(deriveTaskStatus("COMPLETED", past, NOW)).toBe("COMPLETED");
    expect(deriveTaskStatus("CANCELLED", past, NOW)).toBe("CANCELLED");
  });

  it("leaves future and undated tasks alone", () => {
    expect(deriveTaskStatus("OPEN", future, NOW)).toBe("OPEN");
    expect(deriveTaskStatus("OPEN", null, NOW)).toBe("OPEN");
  });

  it("agrees with isOverdue", () => {
    expect(isOverdue(task({ dueDate: past }), NOW)).toBe(true);
    expect(isOverdue(task({ status: "COMPLETED", dueDate: past }), NOW)).toBe(false);
  });
});

describe("derived project status", () => {
  const stages = [stage("CLINICAL"), stage("REGULATORY")];

  it("puts an explicit blocker above everything else", () => {
    expect(
      deriveProjectStatus({
        currentStatus: "ON_TRACK",
        hasExplicitBlocker: true,
        stages,
        tasks: [task({ priority: "URGENT", dueDate: past })],
        now: NOW,
      }),
    ).toBe("BLOCKED");
  });

  it("flags at risk when a critical task is overdue", () => {
    expect(
      deriveProjectStatus({
        currentStatus: "ON_TRACK",
        hasExplicitBlocker: false,
        stages,
        tasks: [task({ priority: "HIGH", dueDate: past })],
        now: NOW,
      }),
    ).toBe("AT_RISK");
  });

  it("does not flag at risk for a single low-priority late task", () => {
    expect(
      deriveProjectStatus({
        currentStatus: "ON_TRACK",
        hasExplicitBlocker: false,
        stages,
        tasks: [task({ priority: "LOW", dueDate: past })],
        now: NOW,
      }),
    ).toBe("ON_TRACK");
  });

  it("flags at risk once three tasks are late regardless of priority", () => {
    expect(
      deriveProjectStatus({
        currentStatus: "ON_TRACK",
        hasExplicitBlocker: false,
        stages,
        tasks: [
          task({ priority: "LOW", dueDate: past }),
          task({ priority: "LOW", dueDate: past }),
          task({ priority: "LOW", dueDate: past }),
        ],
        now: NOW,
      }),
    ).toBe("AT_RISK");
  });

  it("treats a blocked stage as a blocked project", () => {
    expect(
      deriveProjectStatus({
        currentStatus: "ON_TRACK",
        hasExplicitBlocker: false,
        stages: [stage("CLINICAL", { status: "BLOCKED" })],
        tasks: [],
        now: NOW,
      }),
    ).toBe("BLOCKED");
  });

  it("never reopens a project someone marked completed", () => {
    expect(
      deriveProjectStatus({
        currentStatus: "COMPLETED",
        hasExplicitBlocker: true,
        stages,
        tasks: [task({ priority: "URGENT", dueDate: past })],
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });

  it("completes a project once every stage is done", () => {
    expect(
      deriveProjectStatus({
        currentStatus: "ON_TRACK",
        hasExplicitBlocker: false,
        stages: [
          stage("CLINICAL", { status: "COMPLETED" }),
          stage("REGULATORY", { status: "COMPLETED" }),
        ],
        tasks: [],
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });
});

describe("current stage", () => {
  it("picks the first unfinished stage in order", () => {
    expect(
      deriveCurrentStage([
        stage("CLINICAL", { status: "COMPLETED" }),
        stage("REGULATORY", { status: "IN_PROGRESS" }),
        stage("IMPORT_LOGISTICS", { status: "NOT_STARTED" }),
      ]),
    ).toBe("REGULATORY");
  });

  it("stays on the last stage when everything is done", () => {
    expect(
      deriveCurrentStage([
        stage("CLINICAL", { status: "COMPLETED" }),
        stage("REGULATORY", { status: "COMPLETED" }),
      ]),
    ).toBe("REGULATORY");
  });
});

describe("a shipment stuck in transit", () => {
  const shipment = (overrides: Partial<Parameters<typeof isShipmentLate>[0]> = {}) => ({
    stage: "IN_TRANSIT" as const,
    eta: past,
    arrivedAt: null,
    ...overrides,
  });

  it("is late once its ETA has passed and it has not arrived", () => {
    expect(isShipmentLate(shipment({ eta: past }), NOW)).toBe(true);
  });

  it("is not late before its ETA", () => {
    expect(isShipmentLate(shipment({ eta: future }), NOW)).toBe(false);
  });

  it("is never late once it has actually arrived, whatever the ETA says", () => {
    expect(isShipmentLate(shipment({ eta: past, arrivedAt: past }), NOW)).toBe(false);
  });

  it("is never late once its stage reaches customs or delivery", () => {
    for (const stageName of ["ARRIVED", "CUSTOMS", "DELIVERED"] as const) {
      expect(isShipmentLate(shipment({ stage: stageName, eta: past }), NOW)).toBe(false);
    }
  });

  it("has no ETA at all: not late — an unknown date is not a missed one", () => {
    expect(isShipmentLate(shipment({ eta: null }), NOW)).toBe(false);
  });
});
