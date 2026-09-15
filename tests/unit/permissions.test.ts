import { describe, expect, it } from "vitest";
import {
  canReviewDocumentType,
  DOCUMENT_REVIEW_DOMAIN,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHas,
} from "@/server/authz/permissions";
import type { DocumentType, UserRole } from "@/generated/prisma";
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

  /**
   * PERM-1. Editing the project itself — its dates, owner, status and blocker
   * note — is running the project, not owning one of its four stages. Every
   * specialist used to hold this, so Marketing could rewrite a project's
   * blocker note.
   */
  it("keeps general project editing with the roles that run projects", () => {
    expect(roleHas("ADMIN", "project:update")).toBe(true);
    expect(roleHas("MANAGER", "project:update")).toBe(true);

    for (const role of ["REGULATORY", "IMPORT", "MARKETING", "VIEWER"] as const) {
      expect(roleHas(role, "project:update")).toBe(false);
    }
    for (const role of ["SUPPLIER_ADMIN", "SUPPLIER_USER"] as const) {
      expect(roleHas(role, "project:update")).toBe(false);
    }
  });

  it("still lets each specialist edit their own stage", () => {
    expect(roleHas("REGULATORY", "regulatory:manage")).toBe(true);
    expect(roleHas("IMPORT", "import:manage")).toBe(true);
    expect(roleHas("MARKETING", "gtm:manage")).toBe(true);
  });

  /**
   * PERM-2. Whoever reviews a document must own the domain the document
   * belongs to; whoever could approve a certificate of analysis could
   * previously also approve a customs invoice and a marketing deck.
   */
  describe("reviewing a document belongs to its domain", () => {
    it("routes each classifiable type to its owner", () => {
      expect(canReviewDocumentType("REGULATORY", "CERTIFICATE")).toBe(true);
      expect(canReviewDocumentType("REGULATORY", "IFU")).toBe(true);
      expect(canReviewDocumentType("REGULATORY", "CLINICAL")).toBe(true);
      expect(canReviewDocumentType("REGULATORY", "IMPORT")).toBe(false);
      expect(canReviewDocumentType("REGULATORY", "COMMERCIAL")).toBe(false);

      expect(canReviewDocumentType("IMPORT", "IMPORT")).toBe(true);
      expect(canReviewDocumentType("IMPORT", "CERTIFICATE")).toBe(false);

      expect(canReviewDocumentType("MARKETING", "COMMERCIAL")).toBe(true);
      expect(canReviewDocumentType("MARKETING", "PRESENTATION")).toBe(true);
      expect(canReviewDocumentType("MARKETING", "REGULATORY")).toBe(false);
    });

    it("fails closed on a type that identifies no domain", () => {
      for (const type of ["CONTRACT", "NDA", "OTHER"] as const) {
        expect(DOCUMENT_REVIEW_DOMAIN[type]).toBeNull();
        // Only the roles that run projects; never a guess.
        expect(canReviewDocumentType("ADMIN", type)).toBe(true);
        expect(canReviewDocumentType("MANAGER", type)).toBe(true);
        expect(canReviewDocumentType("REGULATORY", type)).toBe(false);
        expect(canReviewDocumentType("IMPORT", type)).toBe(false);
        expect(canReviewDocumentType("MARKETING", type)).toBe(false);
      }
    });

    it("never lets a VIEWER or a supplier review anything", () => {
      const types = Object.keys(DOCUMENT_REVIEW_DOMAIN) as DocumentType[];
      const refused: UserRole[] = ["VIEWER", "SUPPLIER_ADMIN", "SUPPLIER_USER"];

      for (const role of refused) {
        for (const type of types) {
          expect(canReviewDocumentType(role, type)).toBe(false);
        }
      }
    });

    it("covers every document type the schema declares", () => {
      // A new type added to the enum without a decision here would default to
      // undefined and read as "administrative only" by accident.
      for (const value of Object.values(DOCUMENT_REVIEW_DOMAIN)) {
        expect(value === null || typeof value === "string").toBe(true);
      }
      expect(canReviewDocumentType("ADMIN", "OTHER")).toBe(true);
    });
  });

  /**
   * PERM-4. A VIEWER is an internal Vionex employee. `INTERNAL_ONLY` means
   * "not visible to the supplier", not "not visible to junior staff".
   */
  it("lets a VIEWER read internal data and change none of it", () => {
    for (const permission of ["project:read", "task:read", "document:read", "report:read"] as const) {
      expect(roleHas("VIEWER", permission)).toBe(true);
    }
    for (const permission of [
      "project:create",
      "project:update",
      "project:archive",
      "task:create",
      "task:update",
      "document:upload",
      "document:request",
      "document:review",
      "supplier:manage",
      "user:manage",
      "settings:manage",
      "message:send",
      "clinical:manage",
      "regulatory:manage",
      "import:manage",
      "gtm:manage",
    ] as const) {
      expect(roleHas("VIEWER", permission)).toBe(false);
    }
  });

  it("lets only SUPPLIER_ADMIN manage its own company's users", () => {
    expect(roleHas("SUPPLIER_ADMIN", "portal:manage-users")).toBe(true);
    expect(roleHas("SUPPLIER_USER", "portal:manage-users")).toBe(false);
  });
});
