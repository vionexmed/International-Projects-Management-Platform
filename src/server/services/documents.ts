import "server-only";
import type {
  DocumentStatus,
  DocumentType,
  DocumentVisibility,
  Prisma,
} from "@/generated/prisma";
import { db } from "@/server/db";
import { documentRequestScope, documentScope } from "@/server/authz/scopes";
import { buildStorageKey, storage } from "@/lib/storage";
import { validateUpload } from "@/lib/upload";
import { recordAudit } from "@/server/services/audit";
import { recordTimelineEvent } from "@/server/services/timeline";
import { notify, supplierRecipients } from "@/server/services/notifications";
import { isSupplierRole, type SessionUser } from "@/types/auth";

export type DocumentListFilters = {
  query?: string;
  projectId?: string;
  supplierId?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  uploadedById?: string;
  page?: number;
  perPage?: number;
};

const documentInclude = {
  project: { select: { id: true, name: true, projectCode: true } },
  supplier: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  currentVersion: {
    select: { id: true, version: true, fileName: true, fileSize: true, createdAt: true },
  },
  _count: { select: { versions: true } },
} satisfies Prisma.DocumentInclude;

function buildWhere(user: SessionUser, filters: DocumentListFilters): Prisma.DocumentWhereInput {
  const conditions: Prisma.DocumentWhereInput[] = [documentScope(user)];

  if (filters.query) {
    conditions.push({
      OR: [
        { name: { contains: filters.query, mode: "insensitive" } },
        { project: { name: { contains: filters.query, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.projectId) conditions.push({ projectId: filters.projectId });
  if (filters.supplierId) conditions.push({ project: { supplierId: filters.supplierId } });
  if (filters.type) conditions.push({ type: filters.type });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.uploadedById) conditions.push({ createdById: filters.uploadedById });

  return { AND: conditions };
}

export async function listDocuments(user: SessionUser, filters: DocumentListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 25));
  const where = buildWhere(user, filters);

  const [items, total] = await Promise.all([
    db.document.findMany({
      where,
      include: documentInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.document.count({ where }),
  ]);

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export type UploadDocumentInput = {
  projectId: string;
  file: File;
  /** Omit to create a new document; provide to add a version to an existing one. */
  documentId?: string;
  name?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  visibility?: DocumentVisibility;
  notes?: string | null;
};

/**
 * Stores a file and attaches it as a new version. Creating the document, the
 * version and the pointer to the current version happens in one transaction
 * so a document can never point at a half-written version.
 *
 * The file is written to storage first: an orphaned object is harmless, while
 * a database row pointing at a missing object is not.
 */
export async function uploadDocument(user: SessionUser, input: UploadDocumentInput) {
  const invalid = validateUpload(input.file);
  if (invalid) throw new Error(invalid.message);

  const project = await db.project.findFirst({
    where: {
      id: input.projectId,
      organizationId: user.organizationId,
      ...(isSupplierRole(user.role) ? { supplierId: user.supplierId ?? "" } : {}),
    },
    select: { id: true, name: true, supplierId: true },
  });
  if (!project) throw new Error("Projeto não encontrado.");

  // Suppliers may only ever add to documents that are already shared with them.
  let existing = null;
  if (input.documentId) {
    existing = await db.document.findFirst({
      where: { AND: [documentScope(user), { id: input.documentId, projectId: project.id }] },
      select: { id: true, name: true, type: true, visibility: true },
    });
    if (!existing) throw new Error("Documento não encontrado.");
  }

  const fileName = input.file.name;
  const storageKey = buildStorageKey({
    organizationId: user.organizationId,
    projectId: project.id,
    fileName,
  });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  await storage().put(storageKey, buffer, input.file.type);

  const supplierUpload = isSupplierRole(user.role);

  const document = await db.$transaction(async (tx) => {
    const target = existing
      ? await tx.document.update({
          where: { id: existing.id },
          data: {
            status: input.status ?? (supplierUpload ? "RECEIVED" : undefined),
            notes: input.notes ?? undefined,
          },
        })
      : await tx.document.create({
          data: {
            organizationId: user.organizationId,
            projectId: project.id,
            supplierId: project.supplierId,
            createdById: user.id,
            name: input.name?.trim() || fileName.replace(/\.[^.]+$/, ""),
            type: input.type ?? "OTHER",
            status: input.status ?? (supplierUpload ? "RECEIVED" : "RECEIVED"),
            // Anything a supplier uploads is by definition shared with them.
            visibility: supplierUpload ? "SHARED_WITH_SUPPLIER" : (input.visibility ?? "INTERNAL_ONLY"),
            notes: input.notes,
          },
        });

    const last = await tx.documentVersion.findFirst({
      where: { documentId: target.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const version = await tx.documentVersion.create({
      data: {
        documentId: target.id,
        uploadedById: user.id,
        version: (last?.version ?? 0) + 1,
        storageKey,
        fileName,
        fileSize: buffer.byteLength,
        mimeType: input.file.type,
      },
    });

    await tx.document.update({
      where: { id: target.id },
      data: { currentVersionId: version.id },
    });

    return { ...target, currentVersionId: version.id, version: version.version };
  });

  await recordTimelineEvent({
    projectId: project.id,
    actorId: user.id,
    type: "DOCUMENT_UPLOADED",
    description: `${document.name} (v${document.version}) enviado.`,
    metadata: { documentId: document.id },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: existing ? "document.version" : "document.upload",
    entity: "Document",
    entityId: document.id,
    metadata: { projectId: project.id, version: document.version },
  });

  return document;
}

export type CreateDocumentRequestInput = {
  projectId: string;
  title: string;
  description?: string | null;
  type: DocumentType;
  dueDate?: Date | null;
  /** Optionally mirror the request as an internal task. */
  createTask?: boolean;
};

/**
 * Asks a supplier for a document. The request is addressed to the project's
 * supplier — the caller cannot choose an arbitrary one — and every active user
 * of that supplier is notified.
 */
export async function createDocumentRequest(user: SessionUser, input: CreateDocumentRequestInput) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, organizationId: user.organizationId },
    select: { id: true, name: true, supplierId: true },
  });
  if (!project) throw new Error("Projeto não encontrado.");

  const request = await db.$transaction(async (tx) => {
    const task = input.createTask
      ? await tx.task.create({
          data: {
            organizationId: user.organizationId,
            projectId: project.id,
            createdById: user.id,
            assignedToId: user.id,
            supplierId: project.supplierId,
            title: input.title,
            description: input.description,
            category: "REGULATORY",
            priority: "HIGH",
            status: "WAITING",
            dueDate: input.dueDate,
          },
        })
      : null;

    return tx.documentRequest.create({
      data: {
        projectId: project.id,
        supplierId: project.supplierId,
        requestedById: user.id,
        taskId: task?.id,
        title: input.title,
        description: input.description,
        type: input.type,
        dueDate: input.dueDate,
      },
    });
  });

  await recordTimelineEvent({
    projectId: project.id,
    actorId: user.id,
    type: "DOCUMENT_REQUESTED",
    description: `${input.title} solicitado ao fornecedor.`,
    metadata: { requestId: request.id },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "document.request",
    entity: "DocumentRequest",
    entityId: request.id,
    metadata: { projectId: project.id },
  });

  await notify({
    userIds: await supplierRecipients(project.supplierId),
    type: "DOCUMENT_REQUESTED",
    title: input.title,
    description: `New request for ${project.name}.`,
    href: `/supplier/action-required/${request.id}`,
  });

  return request;
}

/**
 * Supplier answers a request: optional file plus optional note. Both the
 * request and the mirrored task move forward, and Vionex is notified.
 */
export async function submitDocumentRequest(
  user: SessionUser,
  requestId: string,
  input: { file?: File | null; message?: string | null },
) {
  const request = await db.documentRequest.findFirst({
    where: { AND: [documentRequestScope(user), { id: requestId }] },
    include: {
      project: { select: { id: true, name: true, supplierId: true, ownerId: true } },
      requestedBy: { select: { id: true } },
    },
  });
  if (!request) throw new Error("Solicitação não encontrada.");
  if (request.status === "CANCELLED") throw new Error("Esta solicitação foi cancelada.");
  if (!input.file && !input.message?.trim()) {
    throw new Error("Anexe um arquivo ou escreva uma resposta.");
  }

  let documentId = request.documentId;

  if (input.file) {
    const document = await uploadDocument(user, {
      projectId: request.projectId,
      file: input.file,
      documentId: request.documentId ?? undefined,
      name: request.title,
      type: request.type,
      status: "RECEIVED",
      visibility: "SHARED_WITH_SUPPLIER",
    });
    documentId = document.id;
  }

  await db.$transaction(async (tx) => {
    await tx.documentRequest.update({
      where: { id: request.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        documentId,
      },
    });

    if (input.message?.trim()) {
      await tx.documentRequestReply.create({
        data: { requestId: request.id, authorId: user.id, body: input.message.trim() },
      });
    }

    if (request.taskId) {
      await tx.task.update({
        where: { id: request.taskId },
        data: { status: "IN_PROGRESS" },
      });
    }
  });

  await recordTimelineEvent({
    projectId: request.projectId,
    actorId: user.id,
    type: "DOCUMENT_SUBMITTED",
    description: `${request.title} enviado pelo fornecedor.`,
    metadata: { requestId: request.id },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "document.submit",
    entity: "DocumentRequest",
    entityId: request.id,
  });

  await notify({
    userIds: [request.requestedById, request.project.ownerId],
    type: "SUPPLIER_REPLIED",
    title: request.title,
    description: `${user.supplierName ?? "Fornecedor"} respondeu à solicitação.`,
    href: `/projects/${request.projectId}/regulatory`,
  });
}

/** Vionex reviews a submission: approve, reject or send back for review. */
export async function reviewDocumentRequest(
  user: SessionUser,
  requestId: string,
  input: { status: "IN_REVIEW" | "APPROVED" | "REJECTED"; note?: string | null },
) {
  const request = await db.documentRequest.findFirst({
    where: { AND: [documentRequestScope(user), { id: requestId }] },
    select: { id: true, title: true, projectId: true, documentId: true, supplierId: true },
  });
  if (!request) throw new Error("Solicitação não encontrada.");

  const documentStatus: DocumentStatus =
    input.status === "APPROVED" ? "APPROVED" : input.status === "REJECTED" ? "REJECTED" : "IN_REVIEW";

  await db.$transaction(async (tx) => {
    await tx.documentRequest.update({
      where: { id: request.id },
      data: { status: input.status, reviewedAt: new Date(), reviewNote: input.note },
    });
    if (request.documentId) {
      await tx.document.update({
        where: { id: request.documentId },
        data: { status: documentStatus },
      });
    }
  });

  await recordTimelineEvent({
    projectId: request.projectId,
    actorId: user.id,
    type: "DOCUMENT_REVIEWED",
    description: `${request.title}: ${documentStatus.replace("_", " ").toLowerCase()}.`,
    metadata: { requestId: request.id, status: input.status },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "document.review",
    entity: "DocumentRequest",
    entityId: request.id,
    metadata: { status: input.status },
  });

  await notify({
    userIds: await supplierRecipients(request.supplierId),
    type: "DOCUMENT_REVIEWED",
    title: request.title,
    description: `Vionex reviewed your submission.`,
    href: `/supplier/action-required/${request.id}`,
  });
}

export async function listDocumentRequests(
  user: SessionUser,
  filters: { projectId?: string; status?: "OPEN" | "ALL" } = {},
) {
  const conditions: Prisma.DocumentRequestWhereInput[] = [documentRequestScope(user)];
  if (filters.projectId) conditions.push({ projectId: filters.projectId });
  if (filters.status === "OPEN") conditions.push({ status: { in: ["PENDING", "REJECTED"] } });

  return db.documentRequest.findMany({
    where: { AND: conditions },
    include: {
      project: { select: { id: true, name: true, projectCode: true } },
      supplier: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true, jobTitle: true } },
      document: { select: { id: true, name: true, status: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}
