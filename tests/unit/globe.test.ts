import { describe, expect, it } from "vitest";
import { arcPoints, isVisible, landDots, rotate, toVector, viewCentredOn } from "@/components/app/globe/geometry";
import { LAND_MASK } from "@/components/app/globe/land-mask";
import { HOME, routesFrom } from "@/lib/geo/countries";

const close = (a: number[], b: number[]) => a.forEach((value, index) => expect(value).toBeCloseTo(b[index], 6));

describe("globe geometry", () => {
  it("centres the chosen point, facing the viewer", () => {
    const view = viewCentredOn(HOME[0], HOME[1]);
    close(rotate(toVector(HOME[0], HOME[1]), view), [0, 0, 1]);
  });

  it("hides the far side but not what rises past the rim", () => {
    expect(isVisible([0, 0, -1])).toBe(false);
    expect(isVisible([1.1, 0, -0.2])).toBe(true);
  });

  it("starts and ends a route on its two countries, lifted in the middle", () => {
    const from = toVector(114, 23);
    const to = toVector(HOME[0], HOME[1]);
    const points = arcPoints(from, to, 40);
    close(points[0], from);
    close(points[40], to);
    expect(Math.hypot(...points[20])).toBeGreaterThan(1.1);
  });

  it("finds land where there is land and none in the open sea", () => {
    const dots = landDots(LAND_MASK);
    expect(dots.length / 3).toBeGreaterThan(2000);
    // Nothing in the middle of the South Atlantic (between 20°W–10°W, 20°S–35°S).
    for (let i = 0; i < dots.length; i += 3) {
      const lat = (Math.asin(dots[i + 1]) * 180) / Math.PI;
      const lon = (Math.atan2(dots[i], dots[i + 2]) * 180) / Math.PI;
      expect(lon > -20 && lon < -10 && lat > -35 && lat < -20).toBe(false);
    }
  });
});

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
