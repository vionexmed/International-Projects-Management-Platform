import type { Language } from "@/generated/prisma";

export const LOCALES = ["pt-BR", "en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

/** The Vionex team works in Portuguese; the Supplier Portal defaults to English. */
/**
 * Offered in the language picker. `zh` stays in `LOCALES` because the database
 * enum and the dictionaries still carry it, but it is not presented for
 * selection.
 */
export const SELECTABLE_LOCALES = ["pt-BR", "en"] as const satisfies readonly Locale[];

export const DEFAULT_INTERNAL_LOCALE: Locale = "pt-BR";
export const DEFAULT_SUPPLIER_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português",
  en: "English",
  zh: "中文",
};

const LANGUAGE_TO_LOCALE: Record<Language, Locale> = {
  PT_BR: "pt-BR",
  EN: "en",
  ZH: "zh",
};

const LOCALE_TO_LANGUAGE: Record<Locale, Language> = {
  "pt-BR": "PT_BR",
  en: "EN",
  zh: "ZH",
};

export function localeFromLanguage(language: Language): Locale {
  return LANGUAGE_TO_LOCALE[language];
}

export function languageFromLocale(locale: Locale): Language {
  return LOCALE_TO_LANGUAGE[locale];
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
