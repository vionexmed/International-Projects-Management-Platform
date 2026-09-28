import { errorsPtBR, type ErrorKey } from "@/lib/i18n/dictionaries/errors.pt-BR";
import { getDictionary, interpolate } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";

/**
 * Re-renders a relayed server message in another language.
 *
 * The message itself is the key: every sentence in `errors.pt-BR.ts` is
 * unique, and templated ones (`{size}`) are matched by pattern so their values
 * carry over. Anything not in the catalog comes back unchanged — an
 * untranslated sentence is better than a wrong one.
 *
 * This only ever sees text `toActionError` has already decided is safe to
 * show; translating never widens what is relayed.
 */
type Matcher = { key: ErrorKey; pattern: RegExp; names: string[] };

const exact = new Map<string, ErrorKey>();
const templated: Matcher[] = [];

for (const [key, template] of Object.entries(errorsPtBR) as [ErrorKey, string][]) {
  const names = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  if (names.length === 0) {
    exact.set(template, key);
    continue;
  }
  const source = template
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("(.+?)");
  templated.push({ key, pattern: new RegExp(`^${source}$`), names });
}

/** The catalog key a Portuguese message came from, with its values. */
export function matchErrorKey(
  message: string,
): { key: ErrorKey; values: Record<string, string> } | null {
  const key = exact.get(message);
  if (key) return { key, values: {} };

  for (const matcher of templated) {
    const found = matcher.pattern.exec(message);
    if (!found) continue;
    const values: Record<string, string> = {};
    matcher.names.forEach((name, index) => {
      values[name] = found[index + 1];
    });
    return { key: matcher.key, values };
  }
  return null;
}

export function translateError(message: string, locale: Locale): string {
  if (locale === "pt-BR") return message;
  const match = matchErrorKey(message);
  if (!match) return message;
  return interpolate(getDictionary(locale).errors[match.key], match.values);
}
