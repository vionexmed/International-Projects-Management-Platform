/**
 * The globe's math, kept pure so it can be tested: points on the unit sphere,
 * the land dots, great-circle arcs lifted off the surface, and the rotation
 * that turns a world point into what the viewer sees (orthographic).
 */

export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;

/** Longitude/latitude in degrees → unit vector; +z faces the viewer at lon 0, lat 0. */
export function toVector(lon: number, lat: number): Vec3 {
  const cosLat = Math.cos(lat * RAD);
  return [cosLat * Math.sin(lon * RAD), Math.sin(lat * RAD), cosLat * Math.cos(lon * RAD)];
}

/** The view: `lambda` spins around the poles, `phi` tilts; both in radians. */
export type View = { lambda: number; phi: number };

/** A view that puts (lon, lat) at the centre of the disc. */
export const viewCentredOn = (lon: number, lat: number): View => ({ lambda: -lon * RAD, phi: lat * RAD });

/** Rotates a world point into view space: x right, y up, z toward the viewer. */
export function rotate([x, y, z]: Vec3, { lambda, phi }: View): Vec3 {
  const cosL = Math.cos(lambda);
  const sinL = Math.sin(lambda);
  const x1 = x * cosL + z * sinL;
  const z1 = z * cosL - x * sinL;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  return [x1, y * cosP - z1 * sinP, y * sinP + z1 * cosP];
}

/** A point in view space can be seen when it faces us or rises past the rim of the disc. */
export const isVisible = ([x, y, z]: Vec3) => z > 0 || x * x + y * y > 1;

/**
 * Land dots, evenly spaced: rows every `step` degrees, each row holding as
 * many dots as its circumference allows, kept where the mask says land.
 * Antarctica is left out — it only adds a white cap under the routes.
 */
export function landDots(mask: string, step = 1.7, southLimit = -58, northLimit = 80): Float32Array {
  const bits = Uint8Array.from(atob(mask), (c) => c.charCodeAt(0));
  const isLand = (lon: number, lat: number) => {
    const row = Math.min(179, Math.max(0, Math.floor(90 - lat)));
    const col = Math.min(359, Math.max(0, Math.floor(lon + 180)));
    const index = row * 360 + col;
    return (bits[index >> 3] >> (7 - (index & 7))) & 1;
  };
  const found: number[] = [];
  for (let lat = southLimit; lat <= northLimit; lat += step) {
    const count = Math.max(1, Math.round((360 / step) * Math.cos(lat * RAD)));
    // Every other row shifted half a step: the dots read as a soft hex grid.
    const shift = Math.round((lat - southLimit) / step) % 2 ? 0.5 : 0;
    for (let i = 0; i < count; i++) {
      const lon = -180 + ((i + shift) / count) * 360;
      if (isLand(lon, lat)) found.push(...toVector(lon, lat));
    }
  }
  return Float32Array.from(found);
}

/**
 * A route as a great circle from `from` to `to`, lifted off the surface in
 * the middle — longer routes fly higher, as on an airline map.
 */
export function arcPoints(from: Vec3, to: Vec3, samples = 72): Vec3[] {
  const dot = Math.min(1, Math.max(-1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega) || 1;
  const lift = 0.06 + 0.24 * (omega / Math.PI);
  const points: Vec3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const a = omega === 0 ? 1 - t : Math.sin((1 - t) * omega) / sinOmega;
    const b = omega === 0 ? t : Math.sin(t * omega) / sinOmega;
    const height = 1 + lift * Math.sin(Math.PI * t);
    points.push([
      (a * from[0] + b * to[0]) * height,
      (a * from[1] + b * to[1]) * height,
      (a * from[2] + b * to[2]) * height,
    ]);
  }
  return points;
}
