// The camera is a director's camera: one setup per shot, eased travel between
// setups, then a slow push while the idea sinks in. No free orbit, ever.
import { bounds } from './layout.js';
import { TRAVEL, easeInOut, span, lerp } from './timing.js';

const add = (p, [x, y, z]) => [p.x + x, y, p.z + z];

/** Compute the camera setup (end pose) for every segment. */
export function cameraSetups(tl, sp, layout) {
  const b = bounds(layout);
  const width = b.maxX - b.minX + 6;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const wideDist = Math.max(14, width * 1.05);
  const wide = { position: [cx, wideDist * 0.38, cz + wideDist], target: [cx, 1.2, cz] };
  const sim = { position: [cx, wideDist * 0.42, cz + wideDist * 0.9], target: [cx + width * 0.12, 0.9, cz] };
  const pull = { position: [cx, wideDist * 0.5, cz + wideDist * 1.2], target: [cx, 1.4, cz] };
  const shots = sp.explain;

  return tl.segments.map((seg) => {
    if (seg.act === 'simulate') return { ...sim, push: 0.02 };
    if (seg.act === 'decide') return { ...pull, push: 0.03 };
    const shot = shots[seg.index];
    const p = layout[shot.focus] || { x: cx, z: cz };
    switch (shot.shot) {
      case 'establish':
        return { ...wide, push: 0.08 };
      case 'introduce': // three-quarter angle, actor on the left third
        return { position: add(p, [2.6, 2.4, 7]), target: add(p, [1.1, 1.1, 0]), push: 0.05 };
      case 'focus':
        return { position: add(p, [0.9, 1.9, 5]), target: add(p, [0.5, 1.0, 0]), push: 0.06 };
      case 'compare':
        return { position: add(p, [0, 1.8, 6.2]), target: add(p, [0, 1.1, 0]), push: 0.03 };
      case 'turn': // hold, then a slow reveal
        return { position: add(p, [-1.8, 1.6, 5.4]), target: add(p, [-0.7, 1.1, 0]), push: 0.12 };
      case 'handoff':
        return { ...sim, push: 0.02 };
      case 'cause': {
        const q = layout[shot.affects] || p;
        const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        return { position: add(mid, [0, 2.6 + d * 0.3, 6 + d * 0.95]), target: add(mid, [0, 1.1, 0]), push: 0.04 };
      }
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
    // slow push toward the subject during the hold
    const push = (to.push || 0) * easeInOut(span(local, TRAVEL, 1));
    for (let k = 0; k < 3; k++) position[k] = lerp(position[k], target[k], push);
  }
  return { position, target };
}
