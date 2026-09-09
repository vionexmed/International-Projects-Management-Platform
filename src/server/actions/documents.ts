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
  file: fileSchema,
});

export async function uploadDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("document:upload");
    const input = parseForm(uploadSchema, formData);

    const document = await uploadDocument(user, {
      projectId: input.projectId,
      documentId: input.documentId ?? undefined,
      name: input.name ?? undefined,
      type: input.type,
      visibility: input.shareWithSupplier ? "SHARED_WITH_SUPPLIER" : "INTERNAL_ONLY",
      notes: input.notes,
      file: input.file,
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
      }),
      formData,
    );

    await submitDocumentRequest(user, input.requestId, {
      file: input.file ?? null,
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
