"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import {
  createDocumentRequest,
  reviewDocumentRequest,
  submitDocumentRequest,
  uploadDocument,
} from "@/server/services/documents";
import { fileSchema } from "@/lib/upload";
import { issueUploadTicket, redeemUploadTicket } from "@/server/services/upload-tickets";
import { requireSharedProjectAccess } from "@/server/authz/access";
import {
  optionalDate,
  optionalText,
  parseForm,
  toActionError,
  type ActionState,
} from "@/server/actions/utils";

const DOCUMENT_TYPES = [
  "CONTRACT", "NDA", "CERTIFICATE", "IFU", "CLINICAL",
  "REGULATORY", "PRESENTATION", "IMPORT", "COMMERCIAL", "OTHER",
] as const;

const uploadSchema = z.object({
  projectId: z.string().min(1, "Selecione um projeto."),
  documentId: optionalText,
  name: optionalText,
  type: z.enum(DOCUMENT_TYPES).default("OTHER"),
  shareWithSupplier: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  notes: optionalText,
  /**
   * Exactly one of the two is present. `file` is the file itself, for uploads
   * small enough to travel through the server; `uploadToken` is the receipt of
   * one that went straight to storage because it was not.
   */
  file: fileSchema.optional(),
  uploadToken: optionalText,
});

/**
 * Step one of a large upload: the server approves the file and hands back a
 * short-lived URL the browser may write one object to.
 *
 * Returns `url: null` when the storage driver cannot presign — local
 * development — and the caller then sends the file the ordinary way.
 */
export async function requestUploadTicketAction(input: {
  projectId: string;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<
  | { ok: true; url: string | null; token: string; contentType: string }
  | { ok: false; error: string }
> {
  try {
    const user = await requirePermission("document:upload");
    /**
     * The ticket authorises writing into one project, so the project has to be
     * the caller's before it is issued. `requireSharedProjectAccess` answers
     * that for both audiences: internal users see every project of the
     * organisation, a supplier only their own.
     */
    await requireSharedProjectAccess(user, input.projectId);

    const ticket = await issueUploadTicket(user, input);
    return { ok: true, url: ticket.url, token: ticket.token, contentType: ticket.contentType };
  } catch (error) {
    const state = toActionError(error);
    return { ok: false, error: state.error ?? "Não foi possível preparar o envio." };
  }
}

export async function uploadDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("document:upload");
    const input = parseForm(uploadSchema, formData);

    /**
     * A token is redeemed before anything is written: the signature proves the
     * server issued it, and storage is asked whether the object actually
     * landed and how big it really is. Nothing the browser claims is trusted.
     */
    const uploaded = input.uploadToken
      ? await redeemUploadTicket(user, input.uploadToken)
      : null;

    if (uploaded && uploaded.projectId !== input.projectId) {
      throw new Error("O envio pertence a outro projeto.");
    }

    const document = await uploadDocument(user, {
      projectId: input.projectId,
      documentId: input.documentId ?? undefined,
      name: input.name ?? undefined,
      type: input.type,
      visibility: input.shareWithSupplier ? "SHARED_WITH_SUPPLIER" : "INTERNAL_ONLY",
      notes: input.notes,
      file: input.file,
      uploaded: uploaded
        ? {
            storageKey: uploaded.key,
            fileName: uploaded.fileName,
            contentType: uploaded.contentType,
            size: uploaded.size,
          }
        : undefined,
    });

    revalidatePath("/documents");
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath(`/projects/${input.projectId}/documents`);
    revalidatePath("/supplier/documents");
    revalidatePath(`/supplier/projects/${input.projectId}/documents`);
    return { ok: true, createdId: document.id };
  } catch (error) {
    return toActionError(error);
  }
}

const requestSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "Informe o documento solicitado.").max(160),
  description: optionalText,
  type: z.enum(DOCUMENT_TYPES).default("OTHER"),
  dueDate: optionalDate,
  createTask: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
});

export async function requestDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("document:request");
    const input = parseForm(requestSchema, formData);

    const request = await createDocumentRequest(user, input);

    revalidatePath(`/projects/${input.projectId}/regulatory`);
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/documents");
    return { ok: true, createdId: request.id };
  } catch (error) {
    return toActionError(error);
  }
}

/** Supplier Portal: answer a request with a file and/or a note. */
export async function submitDocumentRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("document:upload");
    const input = parseForm(
      z.object({
        requestId: z.string().min(1),
        message: optionalText,
        file: fileSchema.optional(),
        uploadToken: optionalText,
      }),
      formData,
    );

    const uploaded = input.uploadToken
      ? await redeemUploadTicket(user, input.uploadToken)
      : null;

    await submitDocumentRequest(user, input.requestId, {
      file: input.file ?? null,
      uploaded: uploaded
        ? {
            storageKey: uploaded.key,
            fileName: uploaded.fileName,
            contentType: uploaded.contentType,
            size: uploaded.size,
          }
        : null,
      message: input.message,
    });

    revalidatePath("/supplier");
    revalidatePath("/supplier/action-required");
    revalidatePath(`/supplier/action-required/${input.requestId}`);
    revalidatePath("/supplier/documents");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reviewDocumentRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("document:review");
    const input = parseForm(
      z.object({
        requestId: z.string().min(1),
        projectId: z.string().min(1),
        status: z.enum(["IN_REVIEW", "APPROVED", "REJECTED"]),
        note: optionalText,
      }),
      formData,
    );

    await reviewDocumentRequest(user, input.requestId, {
      status: input.status,
      note: input.note,
    });

    revalidatePath(`/projects/${input.projectId}/regulatory`);
    revalidatePath("/documents");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
