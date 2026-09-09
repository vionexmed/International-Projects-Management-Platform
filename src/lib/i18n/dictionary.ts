import { ptBR } from "@/lib/i18n/dictionaries/pt-BR";
import { en } from "@/lib/i18n/dictionaries/en";
import { zh } from "@/lib/i18n/dictionaries/zh";
import { DEFAULT_INTERNAL_LOCALE, type Locale } from "@/lib/i18n/config";

/** Mutable mirror of the canonical dictionary shape. */
export type Dictionary = {
  -readonly [K in keyof typeof ptBR]: {
    -readonly [S in keyof (typeof ptBR)[K]]: (typeof ptBR)[K][S] extends string
      ? string
      : { -readonly [T in keyof (typeof ptBR)[K][S]]: string };
  };
};

export type PartialDictionary = {
  [K in keyof Dictionary]?: {
    [S in keyof Dictionary[K]]?: Dictionary[K][S] extends string
      ? string
      : Partial<Dictionary[K][S]>;
  };
};

const base = ptBR as unknown as Dictionary;

/** Two levels of merge is exactly the depth of the dictionary shape. */
function merge(fallback: Dictionary, override: PartialDictionary): Dictionary {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(fallback) as (keyof Dictionary)[]) {
    const fallbackSection = fallback[key] as Record<string, unknown>;
    const overrideSection = (override[key] ?? {}) as Record<string, unknown>;
    const section: Record<string, unknown> = {};

    for (const field of Object.keys(fallbackSection)) {
      const fallbackValue = fallbackSection[field];
      const overrideValue = overrideSection[field];

      if (typeof fallbackValue === "string") {
        section[field] = typeof overrideValue === "string" ? overrideValue : fallbackValue;
      } else {
        section[field] = {
          ...(fallbackValue as Record<string, string>),
          ...((overrideValue as Record<string, string>) ?? {}),
        };
      }
    }
    result[key] = section;
  }
  return result as Dictionary;
}

let cached: Partial<Record<Locale, Dictionary>> = {};

/**
 * Resolves a dictionary with a fallback chain: requested locale → English →
 * Portuguese. Adding a locale means dropping a file in `dictionaries/` and
 * registering it here; no page needs to change.
 */
export function getDictionary(locale: Locale = DEFAULT_INTERNAL_LOCALE): Dictionary {
  const hit = cached[locale];
  if (hit) return hit;

  const english = merge(base, en);
  const resolved =
    locale === "pt-BR" ? base : locale === "en" ? english : merge(english, zh);

  cached = { ...cached, [locale]: resolved };
  return resolved;
}

/** Interpolates `{name}` placeholders. */
export function interpolate(template: string, values: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Picks the singular or plural half of a `"one|many"` template and
 * interpolates it. Keeps plural rules out of the components.
 */
export function plural(template: string, count: number, values: Record<string, string | number> = {}) {
  const [one, many] = template.split("|");
  const chosen = count === 1 ? one : (many ?? one);
  return interpolate(chosen, { count, ...values });
}
