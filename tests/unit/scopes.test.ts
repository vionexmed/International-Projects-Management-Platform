import { describe, expect, it } from "vitest";
import {
  documentRequestScope,
  documentScope,
  projectScope,
  supplierScope,
  taskScope,
  threadScope,
  timelineScope,
  userScope,
} from "@/server/authz/scopes";
import type { SessionUser } from "@/types/auth";

const internal: SessionUser = {
  id: "u-internal",
  name: "Stefany",
  email: "stefany@vionex.com",
  role: "REGULATORY",
  organizationId: "org-1",
  supplierId: null,
  supplierName: null,
  jobTitle: null,
  department: null,
  language: "PT_BR",
};

const supplier: SessionUser = {
  ...internal,
  id: "u-supplier",
  name: "John",
  email: "john@example.com",
  role: "SUPPLIER_USER",
  supplierId: "sup-A",
  supplierName: "Manufacturer A",
};

/** Recursively checks that a where-clause pins the supplier somewhere. */
function mentionsSupplier(value: unknown, supplierId: string): boolean {
  if (value === supplierId) return true;
  if (Array.isArray(value)) return value.some((item) => mentionsSupplier(item, supplierId));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => mentionsSupplier(item, supplierId));
  }
  return false;
}

describe("query scopes", () => {
  it("pins every supplier scope to that supplier", () => {
    const scopes = [
      projectScope(supplier),
      taskScope(supplier),
      documentScope(supplier),
      documentRequestScope(supplier),
      threadScope(supplier),
      supplierScope(supplier),
      userScope(supplier),
      timelineScope(supplier),
    ];

    for (const scope of scopes) {
      expect(mentionsSupplier(scope, "sup-A")).toBe(true);
      expect(mentionsSupplier(scope, "sup-B")).toBe(false);
    }
  });

  it("scopes internal users to the organisation without a supplier filter", () => {
    expect(projectScope(internal)).toMatchObject({ organizationId: "org-1" });
    expect(mentionsSupplier(projectScope(internal), "sup-A")).toBe(false);
    expect(taskScope(internal)).toMatchObject({ organizationId: "org-1" });
  });

  it("only exposes shared documents to suppliers", () => {
    expect(documentScope(supplier)).toMatchObject({ visibility: "SHARED_WITH_SUPPLIER" });
    expect(documentScope(internal)).not.toHaveProperty("visibility");
  });

  it("hides internal timeline events from suppliers", () => {
    expect(timelineScope(supplier)).toMatchObject({ internal: false });
    expect(timelineScope(internal)).not.toHaveProperty("internal");
  });

  it("only shows suppliers threads that are shared with them", () => {
    expect(threadScope(supplier)).toMatchObject({ withSupplier: true });
  });

  it("refuses to build a scope for a supplier account with no supplier link", () => {
    const orphan: SessionUser = { ...supplier, supplierId: null };
    expect(() => projectScope(orphan)).toThrow();
    expect(() => documentScope(orphan)).toThrow();
    expect(() => taskScope(orphan)).toThrow();
  });
});
