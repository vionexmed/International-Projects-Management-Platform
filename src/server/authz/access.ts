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
import type { SessionUser } from "@/types/auth";

/**
 * Guards for direct-identifier access (§40 "proteção contra acesso direto a IDs").
 *
 * Each guard re-runs the caller's scope as part of the lookup, so an
 * out-of-scope identifier is indistinguishable from a non-existent one — the
 * caller learns nothing about records they may not see.
 */

export async function requireProjectAccess(user: SessionUser, projectId: string) {
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
      replies: { orderBy: { createdAt: "asc" } },
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
