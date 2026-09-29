import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Panel } from "@/components/ui/card";

describe("Panel focal treatment", () => {
  it("gives focal panels modest geometry and elevation while default panels stay flat", () => {
    const focal = renderToStaticMarkup(<Panel variant="focal" />);
    const standard = renderToStaticMarkup(<Panel />);

    expect(focal).toContain("rounded-lg");
    expect(focal).toContain("shadow-[0_2px_8px_rgba(5,41,47,0.06)]");
    expect(standard).toContain("rounded-sm");
    expect(standard).not.toContain("shadow-[0_2px_8px_rgba(5,41,47,0.06)]");
  });
});
