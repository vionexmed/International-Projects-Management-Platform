import "server-only";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/authz/errors";
import {
  documentRequestScope,
  documentScope,
  projectScope,
  supplierScope,
  taskScope,
  threadScope,
} from "@/server/authz/scopes";
import { isSupplierRole, type SessionUser } from "@/types/auth";
import { SUPPLIER_PROJECT_SELECT, type SupplierProject } from "@/server/authz/projections";

/**
 * Guards for direct-identifier access (§40 "proteção contra acesso direto a IDs").
 *
 * Each guard re-runs the caller's scope as part of the lookup, so an
 * out-of-scope identifier is indistinguishable from a non-existent one — the
 * caller learns nothing about records they may not see.
 */

/**
 * Full project row, for the Vionex environment.
 *
 * Refuses a supplier session outright. The scope would have kept a supplier to
 * their own project, so this is not about which row — it is about the columns
 * on it: `description`, `blockerNote` and the internal owner have no business
 * crossing into the portal, and the RSC payload carries every field a server
 * component receives whether or not it renders one.
 *
 * Supplier code paths call `requireSharedProjectAccess` instead. Throwing here
 * rather than quietly narrowing means a new portal page cannot leak by
 * forgetting which function to use — it fails on the first request.
 */
export async function requireProjectAccess(user: SessionUser, projectId: string) {
  if (isSupplierRole(user.role)) {
    throw new Error(
      "requireProjectAccess returns internal-only fields and cannot serve a supplier session. " +
        "Use requireSharedProjectAccess.",
    );
  }

  const project = await db.project.findFirst({
    where: { AND: [projectScope(user), { id: projectId }] },
    include: {
      supplier: { select: { id: true, name: true, country: true, status: true } },
      owner: { select: { id: true, name: true, jobTitle: true } },
    },
  });
  if (!project) throw new NotFoundError("Projeto não encontrado.");
  return project;
}

/**
 * Project row reduced to what both audiences may see.
 *
 * Safe for the Supplier Portal, and equally correct for internal pages that
 * only need the heading — the narrower shape is never wrong, just smaller.
 * The column allowlist lives in `projections.ts`.
 */
export async function requireSharedProjectAccess(
  user: SessionUser,
  projectId: string,
): Promise<SupplierProject> {
  const project = await db.project.findFirst({
    where: { AND: [projectScope(user), { id: projectId }] },
    select: SUPPLIER_PROJECT_SELECT,
  });
  if (!project) throw new NotFoundError("Projeto não encontrado.");
  return project;
}

export async function requireTaskAccess(user: SessionUser, taskId: string) {
  const task = await db.task.findFirst({
    where: { AND: [taskScope(user), { id: taskId }] },
    include: {
      project: { select: { id: true, name: true, projectCode: true, supplierId: true } },
      assignedTo: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!task) throw new NotFoundError("Tarefa não encontrada.");
  return task;
}

export async function requireDocumentAccess(user: SessionUser, documentId: string) {
  const document = await db.document.findFirst({
    where: { AND: [documentScope(user), { id: documentId }] },
    include: {
      project: { select: { id: true, name: true, projectCode: true } },
      supplier: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      currentVersion: true,
      versions: {
        orderBy: { version: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!document) throw new NotFoundError("Documento não encontrado.");
  return document;
}

/** Resolves a single stored file version, enforcing document-level access. */
export async function requireDocumentVersionAccess(user: SessionUser, versionId: string) {
  const version = await db.documentVersion.findFirst({
    where: { id: versionId, document: documentScope(user) },
    include: { document: { select: { id: true, name: true } } },
  });
  if (!version) throw new NotFoundError("Arquivo não encontrado.");
  return version;
}

export async function requireDocumentRequestAccess(user: SessionUser, requestId: string) {
  const request = await db.documentRequest.findFirst({
    where: { AND: [documentRequestScope(user), { id: requestId }] },
    include: {
      project: { select: { id: true, name: true, projectCode: true } },
      supplier: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true, jobTitle: true } },
      document: {
        include: {
          currentVersion: true,
          versions: { orderBy: { version: "desc" } },
        },
      },
      /**
       * The author comes with the reply now that the relation exists. The
       * screen used to show anonymous messages because `authorId` had no
       * foreign key and Prisma could not join it.
       *
       * Name and supplier link only — a supplier reading a thread needs to
       * know whether Vionex or a colleague wrote a line, and nothing else
       * about an internal account belongs in that answer.
       */
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, supplierId: true } } },
      },
    },
  });
  if (!request) throw new NotFoundError("Solicitação não encontrada.");
  return request;
}

export async function requireSupplierAccess(user: SessionUser, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: { AND: [supplierScope(user), { id: supplierId }] },
  });
  if (!supplier) throw new NotFoundError("Fornecedor não encontrado.");
  return supplier;
}

export async function requireThreadAccess(user: SessionUser, threadId: string) {
  const thread = await db.messageThread.findFirst({
    where: { AND: [threadScope(user), { id: threadId }] },
    include: { project: { select: { id: true, name: true, projectCode: true, supplierId: true } } },
  });
  if (!thread) throw new NotFoundError("Conversa não encontrada.");
  return thread;
}
