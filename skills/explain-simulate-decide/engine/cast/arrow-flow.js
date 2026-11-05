// Arrow flow: a curved arrow rising from its mark. It reaches further and thickens as the value rises.
import { clay, cylinder, cone, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

const SEGS = 160;
const RADIAL = 14;
const R0 = 0.14;

export default function build({ color = PALETTE.clay } = {}) {
  const object = group();
  object.add(mesh(cylinder(0.34, 0.38, 0.1, 32), clay(PALETTE.sand), { x: -0.9, y: 0.05 }));
  const path = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-0.9, 0.1, 0),
    new THREE.Vector3(-0.9, 1.45, 0),
    new THREE.Vector3(-0.35, 1.95, 0),
    new THREE.Vector3(0.6, 1.9, 0),
  );
  const mat = clay(color, { emissive: 0.08 });
  const geo = new THREE.TubeGeometry(path, SEGS, R0, RADIAL, false);
  const tube = mesh(geo, mat);
  tube.frustumCulled = false; // vertices are rescaled in setValue
  object.add(tube);
  // remember each vertex's ring centre so thickness can change without new geometry
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  const centres = new Float32Array(pos.count * 3);
  const tmp = new THREE.Vector3();
  for (let j = 0; j <= SEGS; j++) {
    path.getPointAt(j / SEGS, tmp);
    for (let i = 0; i <= RADIAL; i++) tmp.toArray(centres, (j * (RADIAL + 1) + i) * 3);
  }
  const head = mesh(cone(0.3, 0.5, 32), mat);
  object.add(head);
  const tail = mesh(sphere(R0, 24), mat, { x: -0.9, y: 0.1 }); // rounded tail cap
  object.add(tail);
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  let lastK = -1;
  return {
    object,
    height: 2.25,
    setValue(v) {
      const k = lerp(0.6, 1.4, v); // thickness factor
      if (Math.abs(k - lastK) > 1e-4) {
        const a = pos.array;
        for (let n = 0; n < a.length; n++) a[n] = centres[n] + (base[n] - centres[n]) * k;
        pos.needsUpdate = true;
        lastK = k;
      }
      tail.scale.setScalar(k);
      const segs = Math.max(1, Math.round(lerp(0.32, 1, v) * SEGS));
      geo.setDrawRange(0, segs * RADIAL * 6);
      const u = segs / SEGS;
      path.getPointAt(u, p);
      path.getTangentAt(u, tan);
      head.quaternion.setFromUnitVectors(up, tan);
      head.scale.setScalar(lerp(0.65, 1.15, v));
      head.position.copy(p).addScaledVector(tan, 0.22 * head.scale.x);
      mat.emissiveIntensity = lerp(0.05, 0.25, v);
    },
  };
}
