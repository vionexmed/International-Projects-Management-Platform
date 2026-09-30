import { ViewTransition } from "react";

const PAGE = { "nav-page": "nav-page", default: "none" };

/**
 * Remounts when the sidebar moves to another section, so the page can enter:
 * the old one fades out, the new one rises in. Only sidebar links carry the
 * `nav-page` type; everything else (tabs, filters, refreshes) swaps in place.
 * Reduced motion turns it off (globals.css).
 */
export default function InternalTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={PAGE} exit={PAGE} default="none">
      {children}
    </ViewTransition>
  );
}
