"use client";

import * as React from "react";

/**
 * Brings the element named in the URL hash into view and tints it briefly.
 *
 * A stage segment on the project lists links to `#stage-REGULATORY` on the
 * overview. The browser's own `:target` only works on a full page load — a
 * client-side navigation never updates it — so without this the supplier
 * clicked "Regulatory" and landed on a page that did not say where to look.
 */
export function HashHighlight() {
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const element = document.getElementById(id);
      if (!element) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      element.dataset.highlight = "true";
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete element.dataset.highlight;
      }, 2400);
    };

    apply();
    window.addEventListener("hashchange", apply);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", apply);
    };
  }, []);

  return null;
}
