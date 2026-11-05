// Water drop: a solid drop grows inside a faint full-size outline, on a small puddle.
import { clay, mesh, group, sphere, PALETTE, THREE, lerp } from './kit.js';

function dropGeometry(R, H) {
  const pts = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = Math.PI - (i / N) * Math.PI; // bottom → tip
    const x = R * Math.sin(t) * Math.pow(Math.sin(t / 2), 1.1);
    const y = (H / 2) * (1 + Math.cos(t)); // 0 at the bottom (t = π), H at the tip (t = 0)
    pts.push(new THREE.Vector2(Math.max(0, x), y));
  }
  return new THREE.LatheGeometry(pts, 48);
}

export default function build({ color = PALETTE.sky } = {}) {
  const object = group();
  const puddle = mesh(sphere(1, 40), clay('#a9c9e6'));
  puddle.scale.set(0.95, 0.05, 0.7);
  object.add(puddle);
  const geo = dropGeometry(0.98, 2.05);
  const ghost = mesh(geo, clay('#d6e6f3', { opacity: 0.38 }));
  ghost.material.depthWrite = false;
  ghost.castShadow = false;
  ghost.renderOrder = 2;
  object.add(ghost);
  const mat = clay(color, { emissive: 0.08 });
  mat.roughness = 0.55;
  const drop = mesh(geo, mat);
  object.add(drop);
  return {
    object,
    height: 2.1,
    setValue(v) {
      drop.scale.setScalar(lerp(0.32, 1, v));
      puddle.scale.set(lerp(0.55, 0.98, v), 0.05, lerp(0.42, 0.72, v));
    },
  };
}
