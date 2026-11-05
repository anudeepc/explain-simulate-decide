// Blocking: where each actor stands. Actors stand on marks along a shallow arc,
// like a small amphitheatre opening toward the audience, so nobody hides anybody.
// Positions never change during the film; the camera does the framing.

const SPACING = 3.3;
const MAX_ARC = (110 * Math.PI) / 180;
const STEP = (18 * Math.PI) / 180;

/**
 * @param {{id: string}[]} cast
 * @returns {Record<string, {x: number, z: number, rotY: number}>}
 */
export function layoutCast(cast) {
  const n = cast.length;
  const out = {};
  if (n === 1) {
    out[cast[0].id] = { x: 0, z: 0, rotY: 0 };
    return out;
  }
  const arc = Math.min(MAX_ARC, (n - 1) * STEP);
  const delta = arc / (n - 1);
  const R = Math.max(8, SPACING / (2 * Math.sin(delta / 2)));
  const zFront = R * Math.cos(arc / 2);
  cast.forEach((actor, i) => {
    const theta = -arc / 2 + i * delta;
    const x = R * Math.sin(theta);
    const z = zFront - R * Math.cos(theta); // ends of the arc at z=0, middle further back
    const rotY = 0.5 * Math.atan2(-x, zFront + 6 - z);
    out[actor.id] = { x: round(x), z: round(z), rotY: round(rotY) };
  });
  return out;
}

const round = (v) => Math.round(v * 1000) / 1000;

/** Extent of the set. */
export function bounds(layout) {
  const pts = Object.values(layout);
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}
