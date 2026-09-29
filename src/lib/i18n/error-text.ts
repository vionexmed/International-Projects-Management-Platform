import { errorsPtBR, type ErrorKey } from "@/lib/i18n/dictionaries/errors.pt-BR";

export type { ErrorKey };

/**
 * The Portuguese sentence a service throws or a schema reports.
 *
 * Services keep throwing plain text — that is what `toActionError` relays and
 * what the Vionex team reads today — but the text comes from the catalog, so
 * `translateError` can always recognise it and answer a supplier in their own
 * language. A literal typed at the throw site would silently stop translating
 * the day someone rewords it.
 */
export function errorText(key: ErrorKey, values: Record<string, string | number> = {}): string {
  return errorsPtBR[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
