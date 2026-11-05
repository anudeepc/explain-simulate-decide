// Coin stack: more coins stack up as the value rises (1 → 12). New coins settle in from above.
import { clay, gold, mesh, group, PALETTE, THREE, lerp, clamp01 } from './kit.js';

const MAX = 12;
const R = 0.62;
const T = 0.16;

function coinGeometry() {
  const b = 0.045;
  const pts = [new THREE.Vector2(0, -T / 2), new THREE.Vector2(R - b, -T / 2)];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    pts.push(new THREE.Vector2(R - b + Math.cos(a) * b, Math.sin(a) * (T / 2)));
  }
  pts.push(new THREE.Vector2(0, T / 2));
  return new THREE.LatheGeometry(pts, 40);
}

export default function build() {
  const object = group();
  const geo = coinGeometry();
  const mat = gold();
  const faceMat = gold('#dba640');
  const faceGeo = new THREE.CylinderGeometry(R * 0.66, R * 0.66, 0.012, 36);
  const coins = [];
  for (let i = 0; i < MAX; i++) {
    const c = group();
    // deterministic slight jitter so the stack feels hand-made
    const jx = Math.sin(i * 12.9898) * 0.035;
    const jz = Math.cos(i * 78.233) * 0.035;
    c.userData.base = new THREE.Vector3(jx, T / 2 + i * T, jz);
    c.add(mesh(geo, mat));
    c.add(mesh(faceGeo, faceMat, { y: T / 2 + 0.001 }));
    object.add(c);
    coins.push(c);
  }
  return {
    object,
    height: MAX * T + 0.1,
    setValue(v) {
      const n = lerp(1, MAX, v);
      coins.forEach((c, i) => {
        const t = clamp01(n - i + (i === 0 ? 1 : 0));
        c.visible = t > 0.001;
        const b = c.userData.base;
        c.position.set(b.x, b.y + (1 - t) * T * 1.2, b.z);
        c.rotation.y = (1 - t) * 0.4;
        c.scale.setScalar(lerp(0.85, 1, t));
      });
    },
  };
}
