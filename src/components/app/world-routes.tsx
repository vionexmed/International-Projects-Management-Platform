/**
 * A dotted world map with the routes of the business: from each supplier
 * country to Brazil. Drawn as SVG on the server — no image file, no request —
 * from coarse continent outlines filled with a dot grid; at this density the
 * coarse outlines read as a map, and the routes come from real data.
 */

import { HOME, routesFrom, type LonLat, type RouteOrigin } from "@/lib/geo/countries";

export type { RouteOrigin };

/* Rough outlines (longitude, latitude). The dot grid hides their coarseness. */
const LAND: LonLat[][] = [
  // North America
  [[-168, 65], [-140, 70], [-110, 72], [-80, 72], [-62, 60], [-55, 50], [-66, 44], [-76, 35], [-81, 25], [-97, 26], [-97, 19], [-88, 15], [-80, 8], [-84, 10], [-92, 15], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-124, 48], [-135, 58], [-150, 60], [-165, 60]],
  // Greenland
  [[-50, 60], [-42, 60], [-20, 70], [-20, 82], [-60, 82], [-72, 77], [-55, 68]],
  // South America
  [[-80, 10], [-72, 12], [-60, 8], [-50, 2], [-35, -5], [-39, -15], [-48, -25], [-57, -38], [-65, -42], [-68, -55], [-73, -50], [-72, -30], [-71, -18], [-77, -10], [-81, -2]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 44], [-4, 48], [5, 52], [8, 54], [10, 57], [5, 60], [8, 63], [15, 69], [25, 71], [30, 70], [40, 67], [45, 60], [40, 50], [30, 45], [26, 40], [20, 40], [15, 38], [12, 44], [8, 44], [3, 43], [-5, 36]],
  // Great Britain and Ireland
  [[-5, 50], [1, 51], [2, 53], [-1, 55], [-3, 58], [-6, 58], [-5, 54], [-3, 52]],
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  // Africa
  [[-17, 15], [-17, 21], [-10, 30], [-6, 35], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 11], [42, -2], [40, -15], [35, -25], [20, -35], [17, -30], [12, -17], [13, -5], [9, 4], [-5, 5], [-12, 7]],
  // Madagascar
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // Asia
  [[26, 40], [36, 36], [35, 31], [48, 30], [57, 25], [60, 22], [67, 24], [72, 20], [77, 8], [80, 15], [88, 22], [92, 21], [98, 15], [100, 3], [104, 1], [105, 10], [108, 16], [106, 21], [110, 21], [117, 24], [122, 30], [121, 38], [126, 38], [129, 35], [130, 42], [135, 45], [142, 47], [140, 53], [155, 60], [163, 62], [180, 66], [180, 72], [140, 73], [110, 77], [80, 73], [70, 70], [60, 68], [50, 68], [45, 60], [40, 50], [30, 45]],
  // Arabia
  [[35, 28], [48, 30], [57, 25], [60, 22], [52, 17], [44, 12], [42, 16]],
  // Japan
  [[130, 31], [135, 34], [140, 36], [142, 40], [141, 45], [139, 42], [134, 35]],
  // Maritime Southeast Asia
  [[95, 5], [105, -6], [115, -8], [120, -10], [140, -8], [140, -2], [125, 1], [118, 5], [109, 2], [103, 1]],
  // Australia
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [131, -32], [116, -35], [114, -28]],
  // New Zealand
  [[172, -34], [178, -38], [175, -41], [168, -46], [167, -44]],
];

const W = 1000;
const H = 380;
const TOP = 72;
const BOTTOM = -50;

const project = ([lon, lat]: LonLat): [number, number] => [
  ((lon + 180) / 360) * W,
  ((TOP - lat) / (TOP - BOTTOM)) * H,
];

function inside([x, y]: [number, number], polygon: [number, number][]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* Computed once per server instance: the dot grid never changes. */
let dots: [number, number][] | null = null;
function landDots() {
  if (dots) return dots;
  const polygons = LAND.map((outline) => outline.map(project));
  const step = 9;
  const found: [number, number][] = [];
  for (let y = step / 2; y < H; y += step) {
    // Every other row shifted half a step: a hexagonal grid reads softer.
    const offset = Math.round(y / step) % 2 === 0 ? 0 : step / 2;
    for (let x = step / 2 + offset; x < W; x += step) {
      if (polygons.some((polygon) => inside([x, y], polygon))) found.push([x, y]);
    }
  }
  dots = found;
  return found;
}

export function WorldRoutes({ origins, className }: { origins: RouteOrigin[]; className?: string }) {
  const home = project(HOME);
  // Portuguese names, two spellings of one country merged into one route.
  const routes = routesFrom(origins).map((route) => ({ ...route, point: project(route.point) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden fill="none" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="vx-route-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="vx-route-glow">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g fill="#cfe6f2" fillOpacity="0.26">
        {landDots().map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.55} />
        ))}
      </g>

      {routes.map((route, index) => {
        const [x1, y1] = route.point;
        const [x2, y2] = home;
        const lift = Math.hypot(x2 - x1, y2 - y1) * 0.32;
        const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - lift} ${x2} ${y2}`;
        // Routes draw in one after another, then a shipment of light keeps travelling each one.
        const drawDelay = `${index * 0.35}s`;
        const cometDelay = `${1.4 + index * 0.9}s`;
        return (
          <g key={route.label}>
            <path d={d} stroke="var(--color-brand)" strokeOpacity="0.28" strokeWidth={1.2} />
            <path
              d={d}
              pathLength={1}
              stroke="var(--color-brand-line)"
              strokeOpacity="0.55"
              strokeWidth={1.3}
              className="vx-route-draw"
              style={{ animationDelay: drawDelay }}
            />
            <path
              d={d}
              pathLength={1}
              stroke="#d9fbff"
              strokeWidth={2.2}
              strokeLinecap="round"
              filter="url(#vx-route-blur)"
              className="vx-route-comet"
              style={{ animationDelay: cometDelay }}
            />
            <circle cx={x1} cy={y1} r={14} fill="url(#vx-route-glow)" />
            <circle cx={x1} cy={y1} r={3} fill="var(--color-brand-line)" />
            <text x={x1 + 8} y={y1 - 8} fill="white" fillOpacity="0.7" fontSize="12" fontWeight="500">
              {route.label}
            </text>
          </g>
        );
      })}

      <circle cx={home[0]} cy={home[1]} r={22} fill="url(#vx-route-glow)" />
      <circle cx={home[0]} cy={home[1]} r={4.5} fill="white" />
      <circle cx={home[0]} cy={home[1]} r={9} stroke="white" strokeOpacity="0.4" className="vx-route-pulse" />
      <text x={home[0] + 12} y={home[1] + 4} fill="white" fillOpacity="0.8" fontSize="12" fontWeight="600">
        Brasil
      </text>
    </svg>
  );
}
