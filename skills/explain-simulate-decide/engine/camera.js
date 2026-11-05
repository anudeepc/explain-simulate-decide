// The camera is a director's camera: one setup per shot, eased travel between
// setups, then a slow push while the idea sinks in. No free orbit, ever.
// Setups are computed by framing: "fit these actors, from this angle".
import { bounds } from './layout.js';
import { TRAVEL, easeInOut, span, lerp } from './timing.js';

export const FOV = 32; // vertical, degrees
const DEG = Math.PI / 180;
const LABEL_ROOM = 1.3; // space above an actor for its label card
const FOOT = 1.45; // half-width of an actor's mark

/**
 * Fit a box into view from a direction.
 * @param {{cx: number, cy: number, cz: number, hw: number, hh: number, hd?: number}} box
 * @param {{az?: number, el?: number, margin?: number, aspect: number, shiftX?: number, shiftY?: number}} o
 */
export function frame(box, { az = 0, el = 15, margin = 1.15, aspect, shiftX = 0, shiftY = 0 }) {
  const t = Math.tan((FOV / 2) * DEG);
  const dist = margin * Math.max(box.hh / t, box.hw / (t * aspect)) + (box.hd || 0) * 0.5;
  const a = az * DEG;
  const e = el * DEG;
  const dir = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  // shift moves the subject within the frame (fractions of the visible half-width/height)
  const right = [Math.cos(a), 0, -Math.sin(a)];
  const visHalfW = dist * t * aspect;
  const visHalfH = dist * t;
  const target = [
    box.cx - right[0] * shiftX * visHalfW,
    box.cy - shiftY * visHalfH,
    box.cz - right[2] * shiftX * visHalfW,
  ];
  return { position: target.map((v, k) => v + dir[k] * dist), target };
}

function boxOf(ids, layout, heights) {
  const pts = ids.map((id) => ({ ...layout[id], h: (heights[id] ?? 2.4) + LABEL_ROOM }));
  const minX = Math.min(...pts.map((p) => p.x)) - FOOT;
  const maxX = Math.max(...pts.map((p) => p.x)) + FOOT;
  const minZ = Math.min(...pts.map((p) => p.z)) - FOOT;
  const maxZ = Math.max(...pts.map((p) => p.z)) + FOOT;
  const top = Math.max(...pts.map((p) => p.h));
  return { cx: (minX + maxX) / 2, cy: top / 2, cz: (minZ + maxZ) / 2, hw: (maxX - minX) / 2, hh: top / 2, hd: (maxZ - minZ) / 2 };
}

/**
 * Camera setup (end pose) for every segment.
 * @param {{heights?: Record<string, number>, aspect?: number}} [o]
 */
export function cameraSetups(tl, sp, layout, { heights = {}, aspect = 16 / 9 } = {}) {
  const ids = Object.keys(layout);
  const all = boxOf(ids, layout, heights);
  const wide = frame(all, { el: 16, margin: 1.02, aspect, shiftY: 0.12 });
  const sim = frame(all, { el: 18, margin: 1.22, aspect, shiftX: -0.17, shiftY: 0.04 });
  const pull = frame(all, { el: 24, margin: 1.5, aspect, shiftY: -0.55 });
  const b = bounds(layout);
  const sideOf = (id) => (layout[id].x < (b.minX + b.maxX) / 2 ? -1 : 1);

  return tl.segments.map((seg) => {
    if (seg.act === 'simulate') return { ...sim, push: 0.02 };
    if (seg.act === 'decide') return { ...pull, push: 0.03 };
    const shot = sp.explain[seg.index];
    const one = boxOf([shot.focus], layout, heights);
    const s = sideOf(shot.focus);
    switch (shot.shot) {
      case 'establish':
        return { ...wide, push: 0.07 };
      case 'introduce': // three-quarter angle, subject on a third
        return { ...frame(one, { az: 24 * s, el: 14, margin: 1.75, aspect, shiftX: 0.3 * s, shiftY: -0.05 }), push: 0.05 };
      case 'focus':
        return { ...frame(one, { az: 10 * s, el: 12, margin: 1.5, aspect, shiftX: 0.22 * s }), push: 0.06 };
      case 'compare':
        return { ...frame(one, { az: 0, el: 10, margin: 1.85, aspect }), push: 0.03 };
      case 'turn': // hold, then a slow reveal
        return { ...frame(one, { az: -20 * s, el: 9, margin: 1.6, aspect, shiftX: -0.25 * s }), push: 0.12 };
      case 'handoff':
        return { ...sim, push: 0.02 };
      case 'cause':
        return { ...frame(boxOf([shot.focus, shot.affects], layout, heights), { el: 16, margin: 1.2, aspect, shiftY: -0.05 }), push: 0.04 };
      default:
        return { ...wide, push: 0.03 };
    }
  });
}

/**
 * Camera pose inside segment i at local progress (0..1).
 * @returns {{position: number[], target: number[]}}
 */
export function poseAt(setups, i, local, { reducedMotion = false } = {}) {
  const to = setups[i];
  const from = setups[Math.max(0, i - 1)];
  const travel = reducedMotion || i === 0 ? 1 : easeInOut(span(local, 0, TRAVEL));
  const position = to.position.map((v, k) => lerp(from.position[k], v, travel));
  const target = to.target.map((v, k) => lerp(from.target[k], v, travel));
  if (!reducedMotion) {
    const push = (to.push || 0) * easeInOut(span(local, TRAVEL, 1));
    for (let k = 0; k < 3; k++) position[k] = lerp(position[k], target[k], push);
  }
  return { position, target };
}
