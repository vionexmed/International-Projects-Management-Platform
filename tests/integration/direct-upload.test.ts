import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { storage } from "@/lib/storage";
import {
  issueUploadTicket,
  redeemUploadTicket,
  validateDescribedUpload,
} from "@/server/services/upload-tickets";
import {
  createDocumentRequest,
  submitDocumentRequest,
  uploadDocument,
} from "@/server/services/documents";
import {
  ensureProjectThread,
  getThread,
  issueAttachmentTicket,
  sendMessage,
} from "@/server/services/messages";
import { requireDocumentVersionAccess } from "@/server/authz/access";
import { NotFoundError } from "@/server/authz/errors";
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
let otherSupplierUser: SessionUser;
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
  otherSupplierUser = await createUser({
    organizationId,
    role: "SUPPLIER_USER",
    supplierId: second.id,
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

/** Stand-in for the browser's PUT: put the object where the ticket says. */
async function putFor(token: string, bytes = Buffer.alloc(64 * 1024, 7)) {
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  await storage().put(claims.key, bytes, "application/pdf");
  return { claims, bytes };
}

describe("a large file answering a request", () => {
  it("counts as an answer even without a note", async () => {
    const request = await createDocumentRequest(admin, {
      projectId,
      title: "Big certificate",
      type: "CERTIFICATE",
    });
    const ticket = await issueUploadTicket(supplierUser, { ...described, projectId });
    await putFor(ticket.token);
    const redeemed = await redeemUploadTicket(supplierUser, ticket.token);

    // Used to be refused with "attach a file or write a reply": the file had
    // gone straight to storage, so the form carried no bytes.
    await submitDocumentRequest(supplierUser, request.id, {
      file: null,
      uploaded: {
        storageKey: redeemed.key,
        fileName: redeemed.fileName,
        contentType: redeemed.contentType,
        size: redeemed.size,
      },
      message: null,
    });

    const after = await db.documentRequest.findUniqueOrThrow({
      where: { id: request.id },
      select: { status: true },
    });
    expect(after.status).toBe("SUBMITTED");
    await storage().delete(redeemed.key);
  });
});

/**
 * Message attachments take the same road as documents: above the platform's
 * body limit the bytes cannot travel with the send. The ticket is issued for a
 * conversation the caller can see and is bound to it.
 */
describe("a large attachment on a message", () => {
  let threadId: string;
  let otherThreadId: string;
  const attachment = { fileName: "packing-list.pdf", contentType: "application/pdf", size: 6 * 1024 * 1024 };

  beforeAll(async () => {
    threadId = await ensureProjectThread(projectId, "Upload Project");
    otherThreadId = await ensureProjectThread(otherProjectId, "Other Project");
  });

  it("is approved for the thread, under a key the server chose in its project", async () => {
    const ticket = await issueAttachmentTicket(supplierUser, threadId, attachment);
    const claims = JSON.parse(Buffer.from(ticket.token.split(".")[1], "base64url").toString("utf8"));
    expect(claims.threadId).toBe(threadId);
    expect(claims.projectId).toBe(projectId);
    expect(claims.userId).toBe(supplierUser.id);
    expect(claims.key).toContain(`projects/${projectId}/`);
    expect(claims.key).not.toContain("packing");
  });

  it("applies the same type and size rules as documents", async () => {
    await expect(
      issueAttachmentTicket(supplierUser, threadId, { ...attachment, fileName: "list.exe" }),
    ).rejects.toThrow(/extensão/i);
    await expect(
      issueAttachmentTicket(supplierUser, threadId, { ...attachment, size: 900 * 1024 * 1024 }),
    ).rejects.toThrow(/limite/i);
  });

  it("is never issued for another supplier's conversation", async () => {
    await expect(
      issueAttachmentTicket(supplierUser, otherThreadId, attachment),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot be spent on another thread, as a document, or by someone else", async () => {
    const ticket = await issueAttachmentTicket(admin, threadId, attachment);
    await putFor(ticket.token);

    await expect(
      redeemUploadTicket(admin, ticket.token, { threadId: otherThreadId }),
    ).rejects.toThrow(/outra conversa/i);
    // Without a thread it is being redeemed as a document upload.
    await expect(redeemUploadTicket(admin, ticket.token)).rejects.toThrow(/outra conversa/i);
    await expect(
      redeemUploadTicket(other, ticket.token, { threadId }),
    ).rejects.toThrow(/outra sessão/i);

    // And a document ticket is not an attachment ticket.
    const documentTicket = await issueUploadTicket(admin, { ...described, projectId });
    await putFor(documentTicket.token);
    await expect(
      redeemUploadTicket(admin, documentTicket.token, { threadId }),
    ).rejects.toThrow(/outra conversa/i);
  });

  it("refuses a file that never arrived", async () => {
    const ticket = await issueAttachmentTicket(supplierUser, threadId, attachment);
    await expect(
      redeemUploadTicket(supplierUser, ticket.token, { threadId }),
    ).rejects.toThrow(/não chegou/i);
  });

  it("arrives attached, recorded at the size storage reports, and audited", async () => {
    const ticket = await issueAttachmentTicket(supplierUser, threadId, attachment);
    const { claims, bytes } = await putFor(ticket.token);
    const redeemed = await redeemUploadTicket(supplierUser, ticket.token, { threadId });

    const message = await sendMessage(supplierUser, threadId, "", {
      projectId: redeemed.projectId,
      storageKey: redeemed.key,
      fileName: redeemed.fileName,
      contentType: redeemed.contentType,
      size: redeemed.size,
    });
    // No text: the file name stands in, as it does for a small file.
    expect(message.body).toBe("packing-list.pdf");

    const { messages } = await getThread(admin, threadId);
    const sent = messages.find((entry) => entry.id === message.id)!;
    const versionId = sent.attachments[0]!.documentVersion.id;

    const version = await db.documentVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: {
        storageKey: true,
        fileSize: true,
        fileName: true,
        document: { select: { visibility: true, projectId: true } },
      },
    });
    expect(version.storageKey).toBe(claims.key);
    expect(version.fileSize).toBe(bytes.byteLength);
    expect(version.fileName).toBe("packing-list.pdf");
    expect(version.document).toEqual({ visibility: "SHARED_WITH_SUPPLIER", projectId });

    const audit = await db.auditLog.findMany({
      where: { organizationId, actorId: supplierUser.id, action: { in: ["message.send", "document.upload"] } },
      select: { action: true },
    });
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["message.send", "document.upload"]),
    );

    // The project owner hears about it; the file stays inside the tenancy.
    const notified = await db.notification.findFirst({
      where: { userId: admin.id, type: "MESSAGE_RECEIVED" },
    });
    expect(notified).not.toBeNull();
    await expect(requireDocumentVersionAccess(supplierUser, versionId)).resolves.toBeDefined();
    await expect(
      requireDocumentVersionAccess(otherSupplierUser, versionId),
    ).rejects.toBeInstanceOf(NotFoundError);

    await storage().delete(version.storageKey);
  });

  it("refuses a stored object that belongs to another project", async () => {
    const ticket = await issueUploadTicket(admin, { ...described, projectId: otherProjectId });
    const { claims } = await putFor(ticket.token);

    await expect(
      sendMessage(admin, threadId, "Wrong place", {
        projectId: otherProjectId,
        storageKey: claims.key,
        fileName: "certificado.pdf",
        contentType: "application/pdf",
        size: 64 * 1024,
      }),
    ).rejects.toThrow(/outro projeto/i);

    await storage().delete(claims.key);
  });
});
