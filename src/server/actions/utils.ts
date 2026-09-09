import "server-only";
import { z } from "zod";
import { isForbiddenError, isNotFoundError } from "@/server/authz/errors";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Identifier of the record the action created, when relevant. */
  createdId?: string;
};

/**
 * Turns any failure into a message that is safe to render. Unexpected errors
 * are logged server-side and replaced with a generic sentence so internals
 * never leak into the UI (§40, §59).
 */
export function toActionError(error: unknown): ActionState {
  if (isForbiddenError(error) || isNotFoundError(error)) {
    return { error: error.message };
  }
  if (error instanceof z.ZodError) {
    return { error: "Verifique os campos destacados.", fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
  }
  if (error instanceof Error && error.name === "PrismaClientKnownRequestError") {
    const code = (error as unknown as { code?: string }).code;
    if (code === "P2002") return { error: "Já existe um registro com estes dados." };
    if (code === "P2003") return { error: "Registro relacionado inválido." };
  }
  // Errors thrown deliberately by services carry user-facing messages.
  if (error instanceof Error && error.message && error.message.length < 200) {
    return { error: error.message };
  }
  console.error("[action] unexpected error", error);
  return { error: "Algo deu errado. Tente novamente." };
}

/** Parses form data with a schema, throwing a ZodError that `toActionError` maps. */
export function parseForm<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      raw[key] = value.size > 0 ? value : undefined;
      continue;
    }
    raw[key] = value === "" ? undefined : value;
  }
  return schema.parse(raw);
}

/** Coerces an optional date input; empty strings become null. */
export const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));
