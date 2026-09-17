import "server-only";
import { startOfTodayUtc } from "@/lib/format";
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
import { recalculateProject } from "@/server/services/projects";
import { ForbiddenError, NotFoundError } from "@/server/authz/errors";
import { assertRoleCan, canReviewDocumentType } from "@/server/authz/permissions";
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

/**
 * The file, either in hand or already in storage.
 *
 * A small upload still travels through the server, which keeps local
 * development working with no bucket at all. A large one cannot — the platform
 * refuses the request before our code runs — so it goes straight to storage
 * first and arrives here as a key that has already been verified. See
 * `upload-tickets.ts`.
 */
export type UploadSource =
  | { file: File }
  | { storageKey: string; fileName: string; contentType: string; size: number };

export type UploadDocumentInput = {
  projectId: string;
  /** Present for the in-band path; `uploaded` replaces it for the direct one. */
  file?: File;
  uploaded?: { storageKey: string; fileName: string; contentType: string; size: number };
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
  assertRoleCan(user.role, "document:upload");

  if (!input.file && !input.uploaded) {
    throw new Error("Nenhum arquivo enviado.");
  }
  if (input.file) {
    const invalid = validateUpload(input.file);
    if (invalid) throw new Error(invalid.message);
  }

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

  /**
   * One of two roads to the same place: either the bytes came with the request
   * and are written here, or they are already in storage and were checked by
   * `redeemUploadTicket` before this was called.
   */
  let fileName: string;
  let storageKey: string;
  let fileSize: number;
  let mimeType: string;

  if (input.file) {
    fileName = input.file.name;
    mimeType = input.file.type;
    storageKey = buildStorageKey({
      organizationId: user.organizationId,
      projectId: project.id,
      fileName,
    });
    const buffer = Buffer.from(await input.file.arrayBuffer());
    fileSize = buffer.byteLength;
    await storage().put(storageKey, buffer, mimeType);
  } else {
    const uploaded = input.uploaded!;
    fileName = uploaded.fileName;
    mimeType = uploaded.contentType;
    storageKey = uploaded.storageKey;
    fileSize = uploaded.size;
  }

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
        fileSize,
        mimeType,
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
    /**
     * A document the supplier cannot open should not announce itself in their
     * timeline either. `documentScope` already hides the row; without this the
     * event still leaked the file name — often the most telling part of it.
     */
    internal: document.visibility === "INTERNAL_ONLY",
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: existing ? "document.version" : "document.upload",
    entity: "Document",
    entityId: document.id,
    metadata: { projectId: project.id, version: document.version },
  });

  /**
   * An upload that nobody is told about is an upload nobody acts on.
   *
   * Two directions, and they are not symmetrical. A supplier sending a file on
   * their own initiative — a renewed certificate, a corrected datasheet — had
   * no signal at all and could sit unnoticed for weeks; the project owner is
   * told. A Vionex file marked as shared is news for the supplier, and only
   * then: an `INTERNAL_ONLY` document must not announce its own existence.
   */
  if (supplierUpload) {
    const owner = await db.project.findUnique({
      where: { id: project.id },
      select: { ownerId: true },
    });
    await notify({
      userIds: [owner?.ownerId].filter((id): id is string => Boolean(id)),
      type: "DOCUMENT_RECEIVED",
      title: document.name,
      description: `${user.supplierName ?? "O fornecedor"} enviou um documento em ${project.name}.`,
      href: `/projects/${project.id}/documents`,
    });
  } else if (document.visibility === "SHARED_WITH_SUPPLIER" && project.supplierId) {
    await notify({
      userIds: await supplierRecipients(project.supplierId),
      type: "DOCUMENT_RECEIVED",
      title: document.name,
      description: `Vionex shared a document in ${project.name}.`,
      href: `/supplier/projects/${project.id}/documents`,
    });
  }

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
  assertRoleCan(user.role, "document:request");

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
  input: {
    file?: File | null;
    /** A file already in storage, verified by `redeemUploadTicket`. */
    uploaded?: { storageKey: string; fileName: string; contentType: string; size: number } | null;
    message?: string | null;
  },
) {
  const request = await db.documentRequest.findFirst({
    where: { AND: [documentRequestScope(user), { id: requestId }] },
    include: {
      project: { select: { id: true, name: true, supplierId: true, ownerId: true } },
      requestedBy: { select: { id: true } },
    },
  });
  if (!request) throw new NotFoundError("Solicitação não encontrada.");
  if (request.status === "CANCELLED") throw new Error("Esta solicitação foi cancelada.");

  /**
   * Which states accept a submission.
   *
   * `PENDING` is the first answer and `REJECTED` is the corrected one — the
   * whole point of a rejection is that the supplier comes back. What is refused
   * is sending again *while Vionex is reading*: that used to be allowed, and it
   * let a supplier replace the file underneath a reviewer mid-decision.
   * `APPROVED` is closed; reopening it is Vionex's call, not the supplier's.
   */
  if (request.status === "SUBMITTED" || request.status === "IN_REVIEW") {
    throw new Error("Esta solicitação está em análise. Aguarde o retorno da Vionex.");
  }
  if (request.status === "APPROVED") {
    throw new Error("Esta solicitação já foi aprovada.");
  }

  if (!input.file && !input.message?.trim()) {
    throw new Error("Anexe um arquivo ou escreva uma resposta.");
  }

  let documentId = request.documentId;

  if (input.file || input.uploaded) {
    const document = await uploadDocument(user, {
      projectId: request.projectId,
      file: input.file ?? undefined,
      uploaded: input.uploaded ?? undefined,
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
        /**
         * The previous verdict stops being the current one. The reason itself
         * is not lost: the review wrote it into the conversation, where the
         * round survives the next one.
         */
        reviewNote: null,
        reviewedAt: null,
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
        data: { status: "IN_PROGRESS", completedAt: null },
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
    description:
      request.status === "REJECTED"
        ? `${user.supplierName ?? "Fornecedor"} enviou uma nova versão.`
        : `${user.supplierName ?? "Fornecedor"} respondeu à solicitação.`,
    href: `/projects/${request.projectId}/regulatory`,
  });
}

/** Vionex reviews a submission: approve, reject or send back for review. */
/**
 * How the mirror task follows the request it represents.
 *
 * The task exists so a document pending with a supplier shows up in the
 * project's own work, and it only earns that if it tells the truth. Approving
 * a document used to leave it open forever, which meant every project that had
 * ever asked for a document reported a progress lower than reality — and the
 * number nobody believes is the number nobody uses.
 */
const TASK_STATUS_FOR_REVIEW = {
  IN_REVIEW: "IN_PROGRESS",
  APPROVED: "COMPLETED",
  REJECTED: "WAITING",
} as const;

export async function reviewDocumentRequest(
  user: SessionUser,
  requestId: string,
  input: { status: "IN_REVIEW" | "APPROVED" | "REJECTED"; note?: string | null },
) {
  const request = await db.documentRequest.findFirst({
    where: { AND: [documentRequestScope(user), { id: requestId }] },
    select: {
      id: true,
      title: true,
      type: true,
      projectId: true,
      documentId: true,
      supplierId: true,
      taskId: true,
      // The exact file under judgement, recorded with the decision.
      document: { select: { currentVersionId: true } },
    },
  });
  if (!request) throw new NotFoundError("Solicitação não encontrada.");

  /**
   * The domain gate (PERM-2), checked here rather than only in the action.
   *
   * The type of the request is not known until it has been read, so the
   * action cannot make this decision — and a check that lives only in one
   * caller is not a rule, it is a habit. An unclassifiable type reaches only
   * the administrative roles; see `DOCUMENT_REVIEW_DOMAIN`.
   */
  if (!canReviewDocumentType(user.role, request.type)) {
    throw new ForbiddenError("Este documento é revisado por outra área.");
  }

  const documentStatus: DocumentStatus =
    input.status === "APPROVED" ? "APPROVED" : input.status === "REJECTED" ? "REJECTED" : "IN_REVIEW";
  const note = input.note?.trim() || null;

  await db.$transaction(async (tx) => {
    await tx.documentRequest.update({
      where: { id: request.id },
      data: { status: input.status, reviewedAt: new Date(), reviewNote: note },
    });

    if (request.documentId) {
      await tx.document.update({
        where: { id: request.documentId },
        data: { status: documentStatus },
      });
    }

    /**
     * The note is also written to the request's conversation.
     *
     * `reviewNote` holds the *current* verdict and is overwritten by the next
     * one, which is right for a field that answers "where does this stand".
     * It is wrong as a record: in a reject → resubmit → reject sequence the
     * first reason simply disappeared, from the supplier and from us. Keeping
     * each note as a reply preserves the rounds in the place a person already
     * reads them, and costs no schema.
     *
     * What this does *not* preserve is the verdict of each round as structured
     * data — see SCHEMA BLOCKED in docs/product-completion.
     */
    if (note) {
      await tx.documentRequestReply.create({
        data: { requestId: request.id, authorId: user.id, body: note },
      });
    }

    /**
     * The round, recorded as data.
     *
     * Written here rather than after the transaction so the two can never
     * disagree: a request cannot end up approved with no review, and a review
     * cannot claim an outcome the request never reached. A partial failure
     * rolls both back together.
     *
     * `IN_REVIEW` produces no row — it is somebody picking the request up, not
     * a verdict, and a history of "looked at it" is noise in the record of what
     * was decided.
     */
    if (input.status !== "IN_REVIEW") {
      await tx.documentRequestReview.create({
        data: {
          requestId: request.id,
          documentVersionId: request.document?.currentVersionId ?? null,
          reviewerId: user.id,
          decision: input.status === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED",
          note,
        },
      });
    }

    if (request.taskId) {
      await tx.task.update({
        where: { id: request.taskId },
        data: {
          status: TASK_STATUS_FOR_REVIEW[input.status],
          completedAt: input.status === "APPROVED" ? new Date() : null,
        },
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

  /**
   * The notification carries the verdict. It used to say "Vionex reviewed your
   * submission" for both outcomes, so a supplier had to open the request to
   * learn whether they still had work to do — which is the one thing a
   * notification exists to answer.
   */
  const outcome =
    input.status === "APPROVED"
      ? "Approved."
      : input.status === "REJECTED"
        ? "Changes requested — please send a new version."
        : "Under review.";

  await notify({
    userIds: await supplierRecipients(request.supplierId),
    type: "DOCUMENT_REVIEWED",
    title: request.title,
    description: outcome,
    href: `/supplier/action-required/${request.id}`,
  });

  // The mirror task moved, so the project's derived progress moved with it.
  await recalculateProject(request.projectId, user.id);
}

/**
 * The rounds a request has been through, newest last.
 *
 * Internal callers get the reviewer; the portal gets the decision, the note and
 * the date. The note is written for the supplier and shared verbatim — there is
 * no internal commentary in this table, by design, which is why the same rows
 * serve both audiences with only the reviewer withheld.
 */
export async function listRequestReviews(user: SessionUser, requestId: string) {
  // The request itself is scoped, so reaching its reviews requires reaching it.
  const request = await db.documentRequest.findFirst({
    where: { AND: [documentRequestScope(user), { id: requestId }] },
    select: { id: true },
  });
  if (!request) throw new NotFoundError("Solicitação não encontrada.");

  const internal = !isSupplierRole(user.role);

  return db.documentRequestReview.findMany({
    where: { requestId: request.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      decision: true,
      note: true,
      createdAt: true,
      documentVersion: { select: { id: true, version: true, fileName: true } },
      ...(internal ? { reviewer: { select: { id: true, name: true } } } : {}),
    },
  });
}

/**
 * The regulatory queue, filtered by where each request is waiting.
 *
 * The filter is applied in SQL rather than by the page, so the count in the
 * tab, the rows on screen and the pagination all describe the same set. The
 * portfolio-wide screen reads a page at a time; a project screen asks for that
 * project and gets all of it.
 */
export type RequestQueueFilter = "open" | "supplier" | "review" | "overdue" | "approved" | "all";

const REQUEST_QUEUE_WHERE: Record<RequestQueueFilter, () => Prisma.DocumentRequestWhereInput> = {
  open: () => ({ status: { in: ["PENDING", "SUBMITTED", "IN_REVIEW", "REJECTED"] } }),
  supplier: () => ({ status: { in: ["PENDING", "REJECTED"] } }),
  review: () => ({ status: { in: ["SUBMITTED", "IN_REVIEW"] } }),
  overdue: () => ({
    status: { in: ["PENDING", "REJECTED"] },
    dueDate: { lt: startOfTodayUtc() },
  }),
  approved: () => ({ status: "APPROVED" }),
  all: () => ({}),
};

export function isRequestQueueFilter(value: unknown): value is RequestQueueFilter {
  return typeof value === "string" && value in REQUEST_QUEUE_WHERE;
}

/** How many requests sit in each filter — the numbers on the tabs. */
export async function countDocumentRequestsByQueue(user: SessionUser) {
  const scope = documentRequestScope(user);
  const keys = Object.keys(REQUEST_QUEUE_WHERE) as RequestQueueFilter[];

  const counts = await Promise.all(
    keys.map((key) =>
      db.documentRequest.count({ where: { AND: [scope, REQUEST_QUEUE_WHERE[key]()] } }),
    ),
  );

  return Object.fromEntries(keys.map((key, index) => [key, counts[index]])) as Record<
    RequestQueueFilter,
    number
  >;
}

export async function listDocumentRequests(
  user: SessionUser,
  filters: {
    projectId?: string;
    status?: "OPEN" | "ALL";
    queue?: RequestQueueFilter;
    page?: number;
    perPage?: number;
  } = {},
) {
  const conditions: Prisma.DocumentRequestWhereInput[] = [documentRequestScope(user)];
  if (filters.projectId) conditions.push({ projectId: filters.projectId });
  if (filters.status === "OPEN") conditions.push({ status: { in: ["PENDING", "REJECTED"] } });
  if (filters.queue) conditions.push(REQUEST_QUEUE_WHERE[filters.queue]());

  return db.documentRequest.findMany({
    where: { AND: conditions },
    include: {
      project: { select: { id: true, name: true, projectCode: true } },
      supplier: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true, jobTitle: true } },
      /**
       * The current version comes along so a reviewer can open the file from
       * the screen where the decision is made. Just the pointer — one row, not
       * the whole version history.
       */
      document: {
        select: {
          id: true,
          name: true,
          status: true,
          currentVersion: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              version: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    ...(filters.page || filters.perPage
      ? {
          skip: ((Math.max(1, filters.page ?? 1)) - 1) * Math.min(100, filters.perPage ?? 25),
          take: Math.min(100, filters.perPage ?? 25),
        }
      : {}),
  });
}

/** The same query as a page, with the total, for a paginated screen. */
export async function pageDocumentRequests(
  user: SessionUser,
  filters: { queue?: RequestQueueFilter; page?: number; perPage?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 25));

  const [items, total] = await Promise.all([
    listDocumentRequests(user, { ...filters, page, perPage }),
    db.documentRequest.count({
      where: {
        AND: [
          documentRequestScope(user),
          filters.queue ? REQUEST_QUEUE_WHERE[filters.queue]() : {},
        ],
      },
    }),
  ]);

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}
