import { describe, expect, it } from "vitest";
import { planColumnKeys, readPlanWidths, resizePlanWidth } from "@/features/tasks/plan-widths";
import type { PlanColumn } from "@/features/tasks/plan-data";

const column = (id: string, name: string, visible = true): PlanColumn => ({
  id, name, visible, type: "TEXT", options: [], values: [],
});

describe("plan width preferences", () => {
  it("uses stable built-in and custom IDs through rename, reorder, hide, and add", () => {
    const first = planColumnKeys([column("alpha", "Score"), column("beta", "Notes")]);
    expect(first).toEqual(["task", "assignee", "due", "priority", "alpha", "beta"]);
    const changed = planColumnKeys([column("beta", "Renamed notes", false), column("alpha", "Score"), column("gamma", "New")]);
    expect(changed).toEqual(["task", "assignee", "due", "priority", "beta", "alpha", "gamma"]);
    const saved = JSON.stringify({ task: 410, alpha: 240, beta: 300 });
    expect(readPlanWidths("project-1", changed, saved)).toMatchObject({ task: 410, alpha: 240, beta: 300, gamma: 160 });
  });

  it("uses safe defaults for missing, corrupt, and legacy array preferences", () => {
    const keys = ["task", "assignee", "due", "priority", "alpha"];
    const defaults = { task: 288, assignee: 208, due: 136, priority: 104, alpha: 160 };
    expect(readPlanWidths("project-1", keys, null)).toEqual(defaults);
    expect(readPlanWidths("project-1", keys, "not json")).toEqual(defaults);
    expect(readPlanWidths("project-1", keys, "[500, 500, 500, 500, 500]")).toEqual(defaults);
  });

  it("rejects invalid saved values and clamps every kind of column to a usable minimum", () => {
    const keys = ["task", "assignee", "due", "priority", "alpha"];
    expect(readPlanWidths("project-1", keys, JSON.stringify({ task: 1, assignee: -2, due: "400", priority: null, alpha: 0 })))
      .toEqual({ task: 288, assignee: 208, due: 136, priority: 104, alpha: 160 });
    const widths = { task: 400, assignee: 208, due: 136, priority: 120, alpha: 160 };
    expect(resizePlanWidth(widths, "task", -999).task).toBe(240);
    expect(resizePlanWidth(widths, "assignee", -999).assignee).toBe(144);
    expect(resizePlanWidth(widths, "due", -999).due).toBe(112);
    expect(resizePlanWidth(widths, "priority", -999).priority).toBe(104);
    expect(resizePlanWidth(widths, "alpha", -999).alpha).toBe(120);
  });

  it("lets the task column shrink below its default width", () => {
    expect(resizePlanWidth({ task: 288 }, "task", -24).task).toBe(264);
  });

  it("keeps widths for temporarily hidden columns when the active key list changes", () => {
    const saved = JSON.stringify({ task: 360, alpha: 260, beta: 220 });
    const hidden = readPlanWidths("project-1", ["task", "beta"], saved);
    expect(hidden.alpha).toBe(260);
    expect(readPlanWidths("project-1", ["task", "alpha", "beta"], JSON.stringify(hidden)).alpha).toBe(260);
  });
});
