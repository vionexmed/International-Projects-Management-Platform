import type { Locale } from "@/lib/i18n/config";

const INTL_LOCALE: Record<Locale, string> = {
  "pt-BR": "pt-BR",
  en: "en-US",
  zh: "zh-CN",
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12 de set. de 2026" / "Sep 12, 2026" */
export function formatDate(value: Date | string | null | undefined, locale: Locale = "pt-BR") {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Compact form used inside dense tables: "12 set" / "Sep 12". */
export function formatDateShort(value: Date | string | null | undefined, locale: Locale = "pt-BR") {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Two-line deadline marker: { month: "SET", day: "08" } */
export function formatDeadlineParts(value: Date | string | null | undefined, locale: Locale = "pt-BR") {
  const date = toDate(value);
  if (!date) return { month: "—", day: "—" };
  const month = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const day = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "2-digit", timeZone: "UTC" }).format(date);
  return { month, day };
}

export function formatDateTime(value: Date | string | null | undefined, locale: Locale = "pt-BR") {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "há 3 dias" / "3 days ago" */
export function formatRelative(value: Date | string | null | undefined, locale: Locale = "pt-BR") {
  const date = toDate(value);
  if (!date) return "—";
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return rtf.format(0, "minute");
}

/** Whole days from today until the given date; negative when overdue. */
export function daysUntil(value: Date | string | null | undefined): number | null {
  const date = toDate(value);
  if (!date) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
