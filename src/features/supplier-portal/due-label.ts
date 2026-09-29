import { interpolate, plural, type Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";
import { daysUntil, formatDate } from "@/lib/format";

export type DueTone = "overdue" | "soon" | "later";

/**
 * One wording for every deadline in the portal.
 *
 * A manufacturer reading a second language should not have to do date
 * arithmetic: "Overdue by 2 days" and "Due in 3 days" answer the question a
 * bare "Oct 07, 2026" leaves open. Past a week the date itself is the useful
 * fact, so it is shown as "Due Oct 20, 2026".
 *
 * Only an item still waiting on the supplier can be late; anything already
 * sent, approved or closed just shows its date.
 */
export function dueLabel(
  dueDate: Date | string | null | undefined,
  dict: Dictionary,
  locale: Locale,
  { open = true }: { open?: boolean } = {},
): { text: string; tone: DueTone; days: number | null } | null {
  const days = daysUntil(dueDate);
  if (days === null) return null;

  const onDate = interpolate(dict.portal.requests.dueOn, { date: formatDate(dueDate, locale) });
  if (!open) return { text: onDate, tone: "later", days };

  if (days < 0) {
    return { text: plural(dict.portal.requests.overdueBy, -days), tone: "overdue", days };
  }
  if (days === 0) return { text: dict.portal.requests.dueToday, tone: "soon", days };
  if (days === 1) return { text: dict.portal.requests.dueTomorrow, tone: "soon", days };
  if (days <= 7) return { text: plural(dict.portal.requests.dueInDays, days), tone: "soon", days };
  return { text: onDate, tone: "later", days };
}

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: "font-medium text-risk",
  soon: "font-medium text-warn",
  later: "text-muted",
};
