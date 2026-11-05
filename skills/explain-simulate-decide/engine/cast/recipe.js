// Custom-built actors: the AI describes simple shapes; this file builds them.
// The recipe is data, never code. Parts stack upward unless given "at".
import { clay, rounded, sphere, cylinder, cone, torus, mesh, group, PALETTE, lerp, THREE } from './kit.js';

const SAFE_COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const num = (x, d) => (Number.isFinite(x) ? Math.min(Math.max(x, -6), 6) : d);

export default function build({ recipe = [], color } = {}) {
  const object = group();
  const body = group();
  object.add(body);
  let stackY = 0;
  const glowMats = [];
  for (const part of recipe.slice(0, 12)) {
    const [sx, sy, sz] = (part.size || [1, 1, 1]).map((v) => Math.min(Math.max(Math.abs(num(v, 1)), 0.05), 3));
    const col = SAFE_COLOR.test(part.color || '') ? part.color : color || PALETTE.sky;
    const mat = clay(col);
    glowMats.push(mat);
    let geo;
    switch (part.shape) {
      case 'sphere': geo = sphere(0.5); break;
      case 'cylinder': geo = cylinder(0.5, 0.5, 1); break;
      case 'cone': geo = cone(0.5, 1); break;
      case 'torus': geo = torus(0.4, 0.12); break;
      default: geo = rounded(1, 1, 1, 0.08);
    }
    const at = Array.isArray(part.at) ? part.at.map((v) => num(v, 0)) : null;
    const m = mesh(geo, mat, at ? { x: at[0], y: at[1] + sy / 2, z: at[2] } : { y: stackY + sy / 2 });
    m.scale.set(sx, sy, sz);
    if (Array.isArray(part.rotate)) m.rotation.set(...part.rotate.map((v) => (num(v, 0) * Math.PI) / 180));
    if (!at) stackY += sy;
    body.add(m);
  }
  const box = new THREE.Box3().setFromObject(body);
  const h = Math.max(0.5, box.max.y);
  const scale = Math.min(1, 2.6 / h, 2.4 / Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 0.1));
  body.scale.setScalar(scale);
  return {
    object,
    height: h * scale,
    setValue(v) {
      body.scale.y = scale * lerp(0.7, 1.12, v);
      for (const m of glowMats) m.emissiveIntensity = lerp(0, 0.25, v);
    },
  };
}
