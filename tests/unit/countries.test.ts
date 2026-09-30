import { describe, expect, it } from "vitest";
import { routesFrom } from "@/lib/geo/countries";

describe("routesFrom", () => {
  it("merges spellings of one country under its Portuguese name and drops unknown ones", () => {
    const routes = routesFrom([
      { country: "Germany", projects: 1 },
      { country: "ALEMANHA", projects: 2 },
      { country: "China", projects: 1 },
      { country: "Atlantis", projects: 5 },
    ]);
    expect(routes).toEqual([
      { label: "Alemanha", point: [10, 51], projects: 3 },
      { label: "China", point: [114, 23], projects: 1 },
    ]);
  });
});
