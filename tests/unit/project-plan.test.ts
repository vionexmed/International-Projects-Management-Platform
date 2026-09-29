import { describe, expect, it } from "vitest";
import { parsePlanColumnDefinition, parsePlanValue } from "@/server/services/project-plan";

describe("project plan validation", () => {
  it("accepts each supported column type and rejects unknown types", () => {
    for (const type of ["TEXT", "SELECT", "DATE", "NUMBER", "PERSON"]) {
      expect(parsePlanColumnDefinition({ name: "Custom", type, options: type === "SELECT" ? ["A"] : [] }).type).toBe(type);
    }
    expect(() => parsePlanColumnDefinition({ name: "Custom", type: "BOOLEAN", options: [] })).toThrow();
  });

  it("rejects malformed or duplicate select options", () => {
    expect(() => parsePlanColumnDefinition({ name: "Phase", type: "SELECT", options: [] })).toThrow();
    expect(() => parsePlanColumnDefinition({ name: "Phase", type: "SELECT", options: ["A", "A"] })).toThrow();
    expect(() => parsePlanColumnDefinition({ name: "Note", type: "TEXT", options: ["A"] })).toThrow();
  });

  it("validates typed values against the column definition", () => {
    expect(parsePlanValue({ type: "TEXT", options: [] }, "Ready")).toBe("Ready");
    expect(parsePlanValue({ type: "SELECT", options: ["Ready"] }, "Ready")).toBe("Ready");
    expect(parsePlanValue({ type: "DATE", options: [] }, "2026-09-29")).toBe("2026-09-29");
    expect(parsePlanValue({ type: "NUMBER", options: [] }, 12.5)).toBe(12.5);
    expect(parsePlanValue({ type: "PERSON", options: [] }, "user-1")).toBe("user-1");
    expect(() => parsePlanValue({ type: "SELECT", options: ["Ready"] }, "Unknown")).toThrow();
    expect(() => parsePlanValue({ type: "DATE", options: [] }, "2026-02-30")).toThrow();
    expect(() => parsePlanValue({ type: "NUMBER", options: [] }, "12.5")).toThrow();
    expect(() => parsePlanValue({ type: "PERSON", options: [] }, { id: "user-1" })).toThrow();
  });
});
