"use client";

import * as React from "react";
import { LAND_MASK } from "@/components/app/globe/land-mask";
import { arcPoints, isVisible, landDots, rotate, toVector, viewCentredOn, type Vec3 } from "@/components/app/globe/geometry";
import type { LonLat, Route } from "@/lib/geo/countries";
import { cn } from "@/lib/utils";

/**
 * A 3D globe of the business: land as dots on a deep-sea sphere, and from
 * every supplier country a route arcing to Brazil with shipments of light
 * travelling it. It turns slowly and can be dragged. Plain canvas 2D — no 3D
 * library — and it stops drawing when off screen, in a hidden tab, or for
 * people who asked their system for less motion (then it is a still image
 * that can still be turned by hand).
 */

const SPIN = 0.06; // rad/s — about a turn every 100 s
const BASE_TILT = 0.24; // rad — the north a little toward the viewer
const RADIUS = 0.37; // of the canvas side; leaves room for the glow and the arcs

const TRAVEL = 2.9; // s a shipment takes along a route
const PERIOD = 5.2; // s between two shipments on the same route
const TRAIL = 0.24; // share of the route the tail covers

const BUCKETS = 6;

type Arc = { label: string; origin: Vec3; points: Vec3[]; offset: number };

export function Globe({ routes, home, homeLabel = "Brasil", className }: { routes: Route[]; home: LonLat; homeLabel?: string; className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // Only the sphere takes the drag; the rest of the square lets clicks through to the page.
  const handleRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const handle = handleRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !handle || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const font = getComputedStyle(canvas).fontFamily;
    const dots = landDots(LAND_MASK);
    const homeVector = toVector(home[0], home[1]);
    const arcs: Arc[] = routes.map((route, index) => {
      const origin = toVector(route.point[0], route.point[1]);
      return { label: route.label, origin, points: arcPoints(origin, homeVector), offset: 0.6 + index * 1.35 };
    });

    // Start over the Atlantic, Brazil and the suppliers' side both in sight.
    const view = viewCentredOn(-28, 14);
    view.phi = BASE_TILT;
    let velocity = SPIN;
    let dragging: { x: number; y: number; t: number } | null = null;
    let size = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let onScreen = true;
    const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

    const draw = (now: number) => {
      const time = now / 1000;
      const width = size * dpr;
      const cx = width / 2;
      const cy = width / 2;
      const R = width * RADIUS;
      const px = dpr;
      ctx.clearRect(0, 0, width, width);

      // A soft shadow under the globe: an object floating over the page.
      const shadow = ctx.createRadialGradient(cx, cy + R * 1.18, 0, cx, cy + R * 1.18, R * 0.8);
      shadow.addColorStop(0, "rgba(10, 42, 64, 0.16)");
      shadow.addColorStop(1, "rgba(10, 42, 64, 0)");
      ctx.save();
      ctx.translate(cx, cy + R * 1.18);
      ctx.scale(1, 0.12);
      ctx.translate(-cx, -(cy + R * 1.18));
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(cx, cy + R * 1.18, R * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Atmosphere.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.3);
      glow.addColorStop(0, "rgba(72, 206, 224, 0.42)");
      glow.addColorStop(0.35, "rgba(72, 206, 224, 0.14)");
      glow.addColorStop(1, "rgba(64, 196, 214, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // The sea: lit from the upper left.
      const sea = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx, cy, R);
      sea.addColorStop(0, "#2386ad");
      sea.addColorStop(0.5, "#0f4566");
      sea.addColorStop(1, "#071f33");
      ctx.fillStyle = sea;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Land: rotated in place, bucketed by depth so a handful of fills draw thousands of dots.
      const cosL = Math.cos(view.lambda);
      const sinL = Math.sin(view.lambda);
      const cosP = Math.cos(view.phi);
      const sinP = Math.sin(view.phi);
      for (const bucket of buckets) bucket.length = 0;
      for (let i = 0; i < dots.length; i += 3) {
        const x = dots[i] * cosL + dots[i + 2] * sinL;
        const z1 = dots[i + 2] * cosL - dots[i] * sinL;
        const z = dots[i + 1] * sinP + z1 * cosP;
        if (z <= 0.02) continue;
        const y = dots[i + 1] * cosP - z1 * sinP;
        buckets[Math.min(BUCKETS - 1, Math.floor(z * BUCKETS))].push(cx + x * R, cy - y * R, z);
      }
      buckets.forEach((bucket, index) => {
        if (bucket.length === 0) return;
        ctx.fillStyle = `rgba(206, 238, 246, ${0.16 + (0.72 * (index + 0.5)) / BUCKETS})`;
        ctx.beginPath();
        for (let i = 0; i < bucket.length; i += 3) {
          const s = 1.5 * px * (0.55 + 0.45 * bucket[i + 2]);
          ctx.rect(bucket[i] - s / 2, bucket[i + 1] - s / 2, s, s);
        }
        ctx.fill();
      });

      // Rim light.
      ctx.strokeStyle = "rgba(170, 236, 244, 0.22)";
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      const screen = (point: Vec3) => {
        const r = rotate(point, view);
        return { x: cx + r[0] * R, y: cy - r[1] * R, z: r[2], visible: isVisible(r) };
      };

      // Routes, then the shipments travelling them.
      ctx.lineCap = "round";
      for (const arc of arcs) {
        const projected = arc.points.map(screen);
        ctx.strokeStyle = "rgba(125, 222, 232, 0.5)";
        ctx.lineWidth = 1.2 * px;
        ctx.beginPath();
        let open = false;
        for (const point of projected) {
          if (!point.visible) {
            open = false;
            continue;
          }
          if (open) ctx.lineTo(point.x, point.y);
          else ctx.moveTo(point.x, point.y);
          open = true;
        }
        ctx.stroke();

        if (reduced) continue;
        const phase = (((time - arc.offset) % PERIOD) + PERIOD) % PERIOD;
        if (phase <= TRAVEL) {
          const head = easeInOut(phase / TRAVEL);
          const steps = 14;
          for (let s = 0; s < steps; s++) {
            const t0 = Math.max(0, head - TRAIL * ((s + 1) / steps));
            const t1 = Math.max(0, head - TRAIL * (s / steps));
            const a = at(projected, t0);
            const b = at(projected, t1);
            if (!a.visible || !b.visible || t1 <= 0) continue;
            ctx.strokeStyle = `rgba(214, 252, 255, ${0.85 * (1 - s / steps)})`;
            ctx.lineWidth = (2.2 - (1.4 * s) / steps) * px;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
          const tip = at(projected, head);
          if (tip.visible) {
            ctx.save();
            ctx.shadowColor = "rgba(120, 240, 250, 0.95)";
            ctx.shadowBlur = 10 * px;
            ctx.fillStyle = "#f2feff";
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 2.1 * px, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        } else if (phase <= TRAVEL + 0.9) {
          // Arrival: a ring opens at home.
          const arrival = screen(homeVector);
          const k = (phase - TRAVEL) / 0.9;
          if (arrival.z > 0) ring(ctx, arrival.x, arrival.y, (5 + 16 * k) * px, 0.7 * (1 - k), px);
        }
      }

      // Origins; their labels wait until after home's, which always wins a clash.
      const pending: { text: string; x: number; y: number; depth: number }[] = [];
      arcs.forEach((arc, index) => {
        const point = screen(arc.origin);
        if (point.z <= 0) return;
        const depth = Math.min(1, point.z * 2.5);
        if (!reduced) {
          const k = ((time + index * 0.7) % 2.4) / 2.4;
          ring(ctx, point.x, point.y, (3 + 9 * k) * px, 0.55 * (1 - k) * depth, px);
        }
        ctx.fillStyle = `rgba(140, 232, 240, ${depth})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.6 * px, 0, Math.PI * 2);
        ctx.fill();
        pending.push({ text: arc.label, x: point.x, y: point.y, depth });
      });

      // Home.
      const homePoint = screen(homeVector);
      const taken: Box[] = [];
      if (homePoint.z > 0) {
        const depth = Math.min(1, homePoint.z * 2.5);
        if (!reduced) {
          const k = (time % 2.8) / 2.8;
          ring(ctx, homePoint.x, homePoint.y, (5 + 12 * k) * px, 0.5 * (1 - k) * depth, px);
        }
        ctx.save();
        ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
        ctx.shadowBlur = 8 * px;
        ctx.fillStyle = `rgba(255, 255, 255, ${depth})`;
        ctx.beginPath();
        ctx.arc(homePoint.x, homePoint.y, 3.4 * px, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        label(ctx, taken, homeLabel, homePoint.x, homePoint.y, cx, cy, R, depth, px, font, true);
      }
      for (const item of pending) label(ctx, taken, item.text, item.x, item.y, cx, cy, R, item.depth, px, font, false);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) {
        // After a flick, ease back to the steady spin and the resting tilt.
        velocity += ((reduced ? 0 : SPIN) - velocity) * Math.min(1, dt * 1.6);
        view.lambda += velocity * dt;
        view.phi += (BASE_TILT - view.phi) * Math.min(1, dt * 0.8);
      }
      draw(now);
      raf = !reduced || dragging || Math.abs(velocity) > 0.001 ? requestAnimationFrame(frame) : 0;
    };

    const start = () => {
      if (raf || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      size = rect.width;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      draw(performance.now());
      canvas.style.opacity = "1";
    };

    const onDown = (event: PointerEvent) => {
      handle.setPointerCapture(event.pointerId);
      dragging = { x: event.clientX, y: event.clientY, t: performance.now() };
      velocity = 0;
      handle.style.cursor = "grabbing";
      start();
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const R = size * RADIUS;
      const dLambda = (event.clientX - dragging.x) / R;
      view.lambda += dLambda;
      view.phi = Math.max(-0.9, Math.min(0.9, view.phi + (event.clientY - dragging.y) / R));
      velocity = dLambda / Math.max(0.008, (now - dragging.t) / 1000);
      dragging = { x: event.clientX, y: event.clientY, t: now };
    };
    const onUp = () => {
      dragging = null;
      velocity = Math.max(-3, Math.min(3, velocity));
      handle.style.cursor = "";
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    intersection.observe(canvas);
    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    if (!reduced) start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      handle.removeEventListener("pointerdown", onDown);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [routes, home, homeLabel]);

  return (
    <div className={cn("relative aspect-square w-full", className)}>
      <canvas
        ref={canvasRef}
        aria-label={`Globo com as rotas dos fornecedores até o ${homeLabel}`}
        role="img"
        className="pointer-events-none block size-full opacity-0 transition-opacity duration-700"
      />
      <div ref={handleRef} aria-hidden className="absolute inset-[13%] cursor-grab touch-pan-y rounded-full" />
    </div>
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** A point part-way along a projected polyline. */
function at(points: { x: number; y: number; z: number; visible: boolean }[], t: number) {
  const f = Math.max(0, Math.min(1, t)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  const k = f - i;
  const a = points[i];
  const b = points[i + 1];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, visible: a.visible && b.visible };
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number, px: number) {
  if (alpha <= 0) return;
  ctx.strokeStyle = `rgba(190, 246, 250, ${alpha})`;
  ctx.lineWidth = px;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

type Box = [number, number, number, number];

/**
 * Labels lean toward the centre of the globe, so they stay over the sea and
 * readable; one that would overlap a label already drawn is left out (the
 * busiest routes come first).
 */
function label(
  ctx: CanvasRenderingContext2D,
  taken: Box[],
  text: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  R: number,
  depth: number,
  px: number,
  font: string,
  strong: boolean,
) {
  if (depth < 0.35) return;
  ctx.save();
  ctx.font = `${strong ? 600 : 500} ${11 * px}px ${font}`;
  const width = ctx.measureText(text).width;
  const left = x > cx ? x - 9 * px - width : x + 9 * px;
  const box: Box = [left - 3 * px, y - 15 * px, left + width + 3 * px, y - px];
  // White text must stay over the sea: a label reaching past the rim is left out.
  const outside = [box[0], box[2]].some((bx) => [box[1], box[3]].some((by) => Math.hypot(bx - cx, by - cy) > R * 0.97));
  if (outside || taken.some(([x0, y0, x1, y1]) => box[0] < x1 && box[2] > x0 && box[1] < y1 && box[3] > y0)) {
    ctx.restore();
    return;
  }
  taken.push(box);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(3, 16, 28, 0.8)";
  ctx.shadowBlur = 4 * px;
  ctx.fillStyle = `rgba(255, 255, 255, ${(strong ? 0.95 : 0.8) * Math.min(1, (depth - 0.35) * 3)})`;
  ctx.fillText(text, left, y - 8 * px);
  ctx.restore();
}
