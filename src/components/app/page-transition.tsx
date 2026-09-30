import { ViewTransition } from "react";

const DIRECTIONAL = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

/**
 * A page that slides with the navigation that opened it: forward (deeper,
 * e.g. the plan's "Ver completo") comes in from the right, back from the
 * left. Links opt in with `transitionTypes={["nav-forward"]}` or
 * `["nav-back"]`; anything else — browser Back, a refresh, a revalidation —
 * swaps without motion. The CSS is in globals.css and honours reduced motion.
 *
 * It wraps each page, not the layout: a layout stays mounted across the
 * navigation, so it would never enter or exit.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONAL} exit={DIRECTIONAL} default="none">
      {children}
    </ViewTransition>
  );
}
