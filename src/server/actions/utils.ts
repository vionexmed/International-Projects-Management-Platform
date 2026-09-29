import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { isForbiddenError, isNotFoundError } from "@/server/authz/errors";
import { DEFAULT_INTERNAL_LOCALE, type Locale } from "@/lib/i18n/config";
import { errorText } from "@/lib/i18n/error-text";
import { translateError } from "@/lib/i18n/translate-error";

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
 *
 * `locale` only changes the language of what is already safe to show: the
 * decision of *whether* to relay is taken first, in Portuguese, and the result
 * is then translated (see `translateError`). The default keeps the Vionex
 * team's wording exactly as it was.
 */
export function toActionError(
  error: unknown,
  locale: Locale = DEFAULT_INTERNAL_LOCALE,
): ActionState {
  return localizeActionState(classifyError(error), locale);
}

function classifyError(error: unknown): ActionState {
  // `redirect()` and `notFound()` are control flow, not failures: an expired
  // session must reach the login page, not a toast reading "NEXT_REDIRECT".
  unstable_rethrow(error);

  if (isForbiddenError(error) || isNotFoundError(error)) {
    return { error: error.message };
  }
  if (error instanceof z.ZodError) {
    return { error: errorText("validation"), fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
  }
  if (error instanceof Error && error.name === "PrismaClientKnownRequestError") {
    const code = (error as unknown as { code?: string }).code;
    if (code === "P2002") return { error: errorText("duplicate") };
    if (code === "P2003") return { error: errorText("invalidReference") };
  }
  // Errors thrown deliberately by services (`throw new Error("…")`) carry
  // user-facing messages. Anything else — a TypeError from a bug, a Prisma or
  // driver error — may name internals, so only a plain `Error` is relayed.
  if (error instanceof Error && error.name === "Error" && error.message && error.message.length < 200) {
    return { error: error.message };
  }
  console.error("[action] unexpected error", error);
  return { error: errorText("generic") };
}

/** Translates the message and every field error of a state into `locale`. */
export function localizeActionState(state: ActionState, locale: Locale): ActionState {
  if (locale === DEFAULT_INTERNAL_LOCALE) return state;
  return {
    ...state,
    ...(state.error ? { error: translateError(state.error, locale) } : {}),
    ...(state.fieldErrors
      ? {
          fieldErrors: Object.fromEntries(
            Object.entries(state.fieldErrors).map(([field, messages]) => [
              field,
              (messages ?? []).map((message) => translateError(message, locale)),
            ]),
          ),
        }
      : {}),
  };
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
