import { ViewTransition } from "react";

const PAGE = { "nav-page": "nav-page", default: "none" };

/**
 * Remounts when the sidebar moves to another section, so the page can enter:
 * the old one fades out (the `nav-page` view transition — only sidebar links
 * carry that type; tabs, filters and refreshes swap in place), and the new
 * one's blocks rise in one after another (`.vx-page` in globals.css). The
 * rise is plain CSS on newly mounted blocks, so it also plays when the real
 * content replaces the loading skeleton — which is what the eye actually
 * sees — and never on a refresh, where the blocks are the same nodes.
 * Reduced motion turns both off.
 */
export default function InternalTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={PAGE} exit={PAGE} default="none">
      <div className="vx-page">{children}</div>
    </ViewTransition>
  );
}
