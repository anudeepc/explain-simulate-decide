// Blocking: where each actor stands on the set. Like marks on a theatre floor,
// positions never change during the film; the camera does the framing.

const SPACING = 3.4;
const ROW_GAP = 3.2;

/**
 * @param {{id: string}[]} cast
 * @returns {Record<string, {x: number, z: number, rotY: number}>}
 */
export function layoutCast(cast) {
  const n = cast.length;
  const rows = n <= 5 ? [cast] : [cast.slice(0, Math.ceil(n / 2)), cast.slice(Math.ceil(n / 2))];
  const out = {};
  rows.forEach((row, r) => {
    const offset = rows.length > 1 && r === 1 ? SPACING / 2 : 0;
    row.forEach((actor, i) => {
      const x = (i - (row.length - 1) / 2) * SPACING + offset - (rows.length > 1 ? SPACING / 4 : 0);
      const z = -r * ROW_GAP - 0.035 * x * x; // gentle arc toward the audience
      const rotY = Math.atan2(-x, 24 - z) * 0.6; // turn slightly to face the house
      out[actor.id] = { x: round(x), z: round(z), rotY: round(rotY) };
    });
  });
  return out;
}

const round = (v) => Math.round(v * 1000) / 1000;

/** Extent of the set, for the wide shot. */
export function bounds(layout) {
  const pts = Object.values(layout);
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}
