/**
 * A sent file flies into the place it now lives.
 *
 * A card with the file's name lifts off where it was dropped, arcs across the
 * screen shrinking as it goes, and lands in the navigation entry marked
 * `data-fly-target` (the supplier's "Documents") — which glows and counts it
 * with a "+1". Plain DOM and Web Animations: nothing to mount, nothing left
 * behind, and nothing at all for people who asked their system for less
 * motion. When the entry is not on screen (a phone, where the menu is
 * folded), the card rises toward the top corner where the menu opens.
 */

const FILE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';

const STEPS = 14;

function visibleTarget(name: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-fly-target="${name}"]`)].find(
    (element) => element.getClientRects().length > 0 && element.getBoundingClientRect().width > 0,
  );
}

export function flyFile({ from, name, target = "documents" }: { from: DOMRect; name: string; target?: string }) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ghost = document.createElement("div");
  ghost.className = "vx-fly-ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.innerHTML = FILE_ICON;
  const label = document.createElement("span");
  label.textContent = name; // text, never markup: the name is the user's
  ghost.append(label);
  document.body.append(ghost);

  const width = ghost.offsetWidth;
  const height = ghost.offsetHeight;
  const startX = from.left + from.width / 2 - width / 2;
  const startY = from.top + from.height / 2 - height / 2;
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;

  const dest = visibleTarget(target);
  const rect = dest?.getBoundingClientRect();
  // Land on the entry's icon, not the middle of its label.
  const landX = rect ? rect.left + Math.min(rect.width / 2, 26) : 28;
  const landY = rect ? rect.top + rect.height / 2 : 24;
  const endX = landX - (startX + width / 2);
  const endY = landY - (startY + height / 2);
  // The arc's control point: up and out, so the card is thrown rather than slid.
  const controlX = endX * 0.25;
  const controlY = Math.min(0, endY) - 140;

  const frames: Keyframe[] = [];
  for (let step = 0; step <= STEPS; step++) {
    const t = step / STEPS;
    const inv = 1 - t;
    const x = 2 * inv * t * controlX + t * t * endX;
    const y = 2 * inv * t * controlY + t * t * endY;
    const scale = step === 1 ? 1.06 : 1 - 0.9 * t * t;
    const rotate = Math.sin(t * Math.PI) * -8;
    frames.push({
      offset: t,
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(1)}deg)`,
      opacity: t < 0.82 ? 1 : 1 - (t - 0.82) * 3.5,
    });
  }

  const flight = ghost.animate(frames, { duration: 980, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" });
  flight.onfinish = () => {
    ghost.remove();
    if (!dest || !rect) return;
    dest.classList.remove("vx-landed");
    // Restart the glow even when two files land in a row.
    void dest.offsetWidth;
    dest.classList.add("vx-landed");
    window.setTimeout(() => dest.classList.remove("vx-landed"), 1200);

    const plus = document.createElement("span");
    plus.className = "vx-fly-plus";
    plus.setAttribute("aria-hidden", "true");
    plus.textContent = "+1";
    plus.style.left = `${rect.right - 34}px`;
    plus.style.top = `${rect.top + rect.height / 2 - 10}px`;
    document.body.append(plus);
    window.setTimeout(() => plus.remove(), 1000);
  };
}
