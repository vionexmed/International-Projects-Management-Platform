import type { Locale } from "@/lib/i18n/config";

/*
  Plain module on purpose (no "use client"): server pages call `trailLabels`
  and pass the result to the client `Breadcrumb` as props.
*/

export type TrailLabels = {
  /** Accessible name of the `<nav>`. */
  trail: string;
  /** The back arrow's name, before the parent: "Voltar" → "Voltar: Projetos". */
  back: string;
};

export const TRAIL_LABELS_PT: TrailLabels = { trail: "Navegação estrutural", back: "Voltar" };

/** Only the nav's accessible name is local; "back" comes from `dict.common.back`. */
const TRAIL_NAME: Record<Locale, string> = {
  "pt-BR": "Navegação estrutural",
  en: "Breadcrumb",
  zh: "导航路径",
};

export function trailLabels(locale: Locale, back: string): TrailLabels {
  return { trail: TRAIL_NAME[locale], back };
}
