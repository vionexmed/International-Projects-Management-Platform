import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { storage } from "@/lib/storage";
import {
  issueUploadTicket,
  redeemUploadTicket,
  validateDescribedUpload,
} from "@/server/services/upload-tickets";
import { uploadDocument } from "@/server/services/documents";
import type { SessionUser } from "@/types/auth";
import { createProject, createSupplier, createTestOrg, createUser, destroyOrg } from "../factories";

/**
 * Uploading a file that does not fit through the application.
 *
 * Vercel rejects any request to a function above roughly 4.5 MB, at the edge,
 * before our code runs — while the product accepts documents up to 25 MB. A
 * manufacturer sending a 5 MB certificate got an error page with nothing in
 * it, on the one screen where delivering a document is the entire point.
 *
 * So large files go straight to storage and the form carries a signed receipt
 * instead of the bytes. Everything below is about that receipt being
 * impossible to forge, reuse or stretch: it is the only thing standing between
 * "the server chose this key" and "the client said so".
 */
let organizationId: string;
let admin: SessionUser;
let other: SessionUser;
let supplierUser: SessionUser;
let projectId: string;
let otherProjectId: string;

beforeAll(async () => {
  const org = await createTestOrg("Upload");
  organizationId = org.id;

  const supplier = await createSupplier(organizationId, `Maker ${org.slug}`);
  const second = await createSupplier(organizationId, `Other ${org.slug}`, "Germany");

  admin = await createUser({ organizationId, role: "ADMIN" });
  other = await createUser({ organizationId, role: "ADMIN" });
  supplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: supplier.id,
  });

  projectId = (
    await createProject({
      organizationId,
      supplierId: supplier.id,
      ownerId: admin.id,
      name: "Upload Project",
    })
  ).id;

  otherProjectId = (
    await createProject({
      organizationId,
      supplierId: second.id,
      ownerId: admin.id,
      name: "Other Project",
    })
  ).id;
});

afterAll(async () => {
  await destroyOrg(organizationId);
});

const described = {
  projectId: "",
  fileName: "certificado.pdf",
  contentType: "application/pdf",
  size: 5 * 1024 * 1024,
};

describe("the file is described before it is sent", () => {
  it("applies the same rules as a file in hand", () => {
    expect(validateDescribedUpload({ ...described, size: 0 })).toMatch(/vazio/i);
    expect(validateDescribedUpload({ ...described, size: 900 * 1024 * 1024 })).toMatch(/limite/i);
    expect(
      validateDescribedUpload({ ...described, contentType: "application/x-msdownload" }),
    ).toMatch(/não permitido/i);
    // Declared as a PDF, named as something else: treated as an attack.
    expect(validateDescribedUpload({ ...described, fileName: "certificado.exe" })).toMatch(
      /extensão/i,
    );
    expect(validateDescribedUpload(described)).toBeNull();
  });

  it("accepts a 5 MB document — the size that used to fail", () => {
    expect(validateDescribedUpload({ ...described, size: 5 * 1024 * 1024 })).toBeNull();
  });
});

describe("the ticket cannot be forged or borrowed", () => {
  it("chooses the storage key itself", async () => {
    const ticket = await issueUploadTicket(admin, { ...described, projectId });
    const claims = JSON.parse(
      Buffer.from(ticket.token.split(".")[1], "base64url").toString("utf8"),
    );

    // Scoped to the project, unguessable, and never built from client input.
    expect(claims.key).toContain(projectId);
    expect(claims.key).not.toContain("certificado");
    expect(claims.userId).toBe(admin.id);
  });

  it("refuses a token that was tampered with", async () => {
    const ticket = await issueUploadTicket(admin, { ...described, projectId });
    const [header, payload, signature] = ticket.token.split(".");
    const forged = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    forged.key = "projects/somewhere-else/evil.pdf";

    const tampered = [
      header,
      Buffer.from(JSON.stringify(forged)).toString("base64url"),
      signature,
    ].join(".");

    await expect(redeemUploadTicket(admin, tampered)).rejects.toThrow();
  });

  it("refuses a token issued to somebody else", async () => {
    const ticket = await issueUploadTicket(admin, { ...described, projectId });
    await expect(redeemUploadTicket(other, ticket.token)).rejects.toThrow(/outra sessão/i);
  });

  it("refuses a token for a file that never arrived", async () => {
    const ticket = await issueUploadTicket(admin, { ...described, projectId });
    // Nothing was uploaded, so storage has no object under that key.
    await expect(redeemUploadTicket(admin, ticket.token)).rejects.toThrow(/não chegou/i);
  });

  it("refuses garbage", async () => {
    await expect(redeemUploadTicket(admin, "not-a-token")).rejects.toThrow();
  });
});

describe("the round trip, end to end", () => {
  it("records the size storage reports, not the one the client promised", async () => {
    const ticket = await issueUploadTicket(admin, { ...described, projectId });
    const claims = JSON.parse(
      Buffer.from(ticket.token.split(".")[1], "base64url").toString("utf8"),
    );

    // Stand in for the browser's PUT: put the object where the ticket says.
    const bytes = Buffer.alloc(64 * 1024, 7);
    await storage().put(claims.key, bytes, described.contentType);

    const redeemed = await redeemUploadTicket(admin, ticket.token);
    expect(redeemed.key).toBe(claims.key);
    // The ticket promised 5 MB; 64 KB landed. Storage wins.
    expect(redeemed.size).toBe(bytes.byteLength);

    const document = await uploadDocument(admin, {
      projectId,
      name: "Certificado",
      type: "CERTIFICATE",
      uploaded: {
        storageKey: redeemed.key,
        fileName: redeemed.fileName,
        contentType: redeemed.contentType,
        size: redeemed.size,
      },
    });

    const version = await db.documentVersion.findFirstOrThrow({
      where: { documentId: document.id },
      select: { storageKey: true, fileSize: true, mimeType: true, fileName: true },
    });

    expect(version.storageKey).toBe(claims.key);
    expect(version.fileSize).toBe(bytes.byteLength);
    expect(version.mimeType).toBe("application/pdf");

    // And the file is readable through the ordinary path.
    const back = await storage().get(version.storageKey);
    expect(back.body.byteLength).toBe(bytes.byteLength);

    await storage().delete(version.storageKey);
  });

  it("does not let a supplier get a ticket for another company's project", async () => {
    const { requireSharedProjectAccess } = await import("@/server/authz/access");
    await expect(requireSharedProjectAccess(supplierUser, otherProjectId)).rejects.toThrow();
  });
});
