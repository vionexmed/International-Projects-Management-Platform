import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type roles in globals.css (`text-body`, `text-meta`, …) are font sizes,
 * but tailwind-merge cannot know that and would file them as text colours —
 * `cn("text-body text-ink")` would silently drop the size. Registering them
 * keeps size and colour in separate groups.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["page", "section", "title", "body", "meta", "kpi", "kpi-sm"] },
    classGroups: { shadow: [{ shadow: ["panel"] }] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Initials used by the avatar component, e.g. "John Smith" -> "JS". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Clamp a number into the 0–100 range and round it. */
export function toPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
