import { z } from "zod";
import { env, uploadMaxBytes } from "@/lib/env";

/** MIME type → canonical extension. Anything outside this map is rejected. */
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

export const ALLOWED_EXTENSIONS = Object.values(ALLOWED_FILE_TYPES).flat();
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.join(",");
/** Upload ceiling in MB. A function so no configuration is read at import. */
export function maxUploadMb(): number {
  return env.UPLOAD_MAX_SIZE_MB;
}

export type UploadValidationError = { message: string };

/**
 * Validates an uploaded file server-side. Both the declared MIME type and the
 * file extension must be allowed — a mismatch is treated as an attack, not a
 * mistake — and the size limit is re-checked here even though the browser
 * also enforces it.
 */
export function validateUpload(file: File): UploadValidationError | null {
  if (file.size === 0) {
    return { message: "O arquivo está vazio." };
  }
  if (file.size > uploadMaxBytes()) {
    return { message: `O arquivo excede o limite de ${maxUploadMb()} MB.` };
  }

  const allowedExtensions = ALLOWED_FILE_TYPES[file.type];
  if (!allowedExtensions) {
    return { message: "Tipo de arquivo não permitido." };
  }

  const lower = file.name.toLowerCase();
  if (!allowedExtensions.some((ext) => lower.endsWith(ext))) {
    return { message: "A extensão do arquivo não corresponde ao seu tipo." };
  }

  return null;
}

export const fileSchema = z.instanceof(File).superRefine((file, ctx) => {
  const error = validateUpload(file);
  if (error) {
    ctx.addIssue({ code: "custom", message: error.message });
  }
});
