import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, roleHas } from "@/server/authz/permissions";
import { isSupplierRole } from "@/types/auth";

describe("permission matrix", () => {
  it("gives ADMIN every capability", () => {
    for (const permission of PERMISSIONS) {
      expect(roleHas("ADMIN", permission)).toBe(true);
    }
  });

  it("keeps VIEWER read-only", () => {
    expect(roleHas("VIEWER", "project:read")).toBe(true);
    expect(roleHas("VIEWER", "project:create")).toBe(false);
    expect(roleHas("VIEWER", "project:update")).toBe(false);
    expect(roleHas("VIEWER", "task:create")).toBe(false);
    expect(roleHas("VIEWER", "document:upload")).toBe(false);
    expect(roleHas("VIEWER", "user:manage")).toBe(false);
  });

  it("never grants a supplier role access to internal administration", () => {
    for (const role of ["SUPPLIER_ADMIN", "SUPPLIER_USER"] as const) {
      expect(roleHas(role, "user:manage")).toBe(false);
      expect(roleHas(role, "settings:manage")).toBe(false);
      expect(roleHas(role, "report:read")).toBe(false);
      expect(roleHas(role, "supplier:read")).toBe(false);
      expect(roleHas(role, "supplier:manage")).toBe(false);
      expect(roleHas(role, "team:read")).toBe(false);
      expect(roleHas(role, "project:create")).toBe(false);
      expect(roleHas(role, "document:request")).toBe(false);
      expect(roleHas(role, "document:review")).toBe(false);
    }
  });

  it("only grants portal access to supplier roles", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]) {
      if (role === "ADMIN") continue;
      expect(roleHas(role, "portal:access")).toBe(isSupplierRole(role));
    }
  });

  it("restricts stage management to the responsible roles", () => {
    expect(roleHas("REGULATORY", "regulatory:manage")).toBe(true);
    expect(roleHas("REGULATORY", "import:manage")).toBe(false);
    expect(roleHas("IMPORT", "import:manage")).toBe(true);
    expect(roleHas("IMPORT", "gtm:manage")).toBe(false);
    expect(roleHas("MARKETING", "gtm:manage")).toBe(true);
    expect(roleHas("MARKETING", "regulatory:manage")).toBe(false);
  });

  it("lets only SUPPLIER_ADMIN manage its own company's users", () => {
    expect(roleHas("SUPPLIER_ADMIN", "portal:manage-users")).toBe(true);
    expect(roleHas("SUPPLIER_USER", "portal:manage-users")).toBe(false);
  });
});
