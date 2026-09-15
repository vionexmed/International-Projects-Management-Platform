import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, STAGE_PERMISSION, roleHas } from "@/server/authz/permissions";

/**
 * Each stage belongs to its owner.
 *
 * `STAGE_MANAGE` always declared that the four phases are separate
 * responsibilities, and the stage *detail* actions enforced it. The stage row
 * itself did not: its status, progress and notes asked only for
 * `project:update`, which every contributor holds. So somebody from Import
 * could mark the clinical phase complete.
 *
 * These tests pin the mapping that closed that, and — more usefully — pin that
 * it did not become a way to hand anybody more than they had.
 */
describe("stage ownership", () => {
  it("maps every stage to the capability named after it", () => {
    expect(STAGE_PERMISSION).toEqual({
      CLINICAL: "clinical:manage",
      REGULATORY: "regulatory:manage",
      IMPORT_LOGISTICS: "import:manage",
      GO_TO_MARKET: "gtm:manage",
    });
  });

  it("lets each specialist manage their own stage and no other", () => {
    const expected = {
      REGULATORY: ["CLINICAL", "REGULATORY"],
      IMPORT: ["IMPORT_LOGISTICS"],
      MARKETING: ["GO_TO_MARKET"],
    } as const;

    for (const [role, stages] of Object.entries(expected)) {
      for (const stage of Object.keys(STAGE_PERMISSION) as (keyof typeof STAGE_PERMISSION)[]) {
        const allowed = (stages as readonly string[]).includes(stage);
        expect(
          roleHas(role as keyof typeof ROLE_PERMISSIONS, STAGE_PERMISSION[stage]),
          `${role} on ${stage}`,
        ).toBe(allowed);
      }
    }
  });

  it("changes nothing for the roles that run the portfolio", () => {
    // ADMIN and MANAGER already held all four, so tightening the stage
    // actions cannot have taken anything away from them.
    for (const role of ["ADMIN", "MANAGER"] as const) {
      for (const permission of Object.values(STAGE_PERMISSION)) {
        expect(roleHas(role, permission)).toBe(true);
      }
    }
  });

  it("keeps read-only and supplier roles out of every stage", () => {
    for (const role of ["VIEWER", "SUPPLIER_ADMIN", "SUPPLIER_USER"] as const) {
      for (const permission of Object.values(STAGE_PERMISSION)) {
        expect(roleHas(role, permission)).toBe(false);
      }
    }
  });
});
