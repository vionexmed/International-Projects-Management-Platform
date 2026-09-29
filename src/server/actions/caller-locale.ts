import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { DEFAULT_INTERNAL_LOCALE, localeFromLanguage, type Locale } from "@/lib/i18n/config";
import { toActionError, type ActionState } from "@/server/actions/utils";

/**
 * The language the caller reads the product in.
 *
 * `getCurrentUser` is request-cached, so on the error path this is the lookup
 * the action already made. Without a session — or if even that lookup fails —
 * the answer is the internal default, which is what every refusal said before.
 */
export async function callerLocale(): Promise<Locale> {
  try {
    const user = await getCurrentUser();
    return user ? localeFromLanguage(user.language) : DEFAULT_INTERNAL_LOCALE;
  } catch {
    return DEFAULT_INTERNAL_LOCALE;
  }
}

/**
 * `toActionError` in the caller's language. Used by every action the Supplier
 * Portal reaches, so a manufacturer is refused in English (or Chinese), not in
 * the Vionex team's Portuguese.
 */
export async function toCallerActionError(error: unknown): Promise<ActionState> {
  unstable_rethrow(error);
  return toActionError(error, await callerLocale());
}
