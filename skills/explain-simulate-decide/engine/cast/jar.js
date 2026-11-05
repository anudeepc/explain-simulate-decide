// Jar: a glass jar that fills with coins. Shows a store's level, a target line
// (e.g. what the system cost), a flag when the target is reached, and a ghost ring
// at the level of the viewer's previous try.
import { clay, rounded, cylinder, torus, mesh, group, PALETTE, THREE, lerp, clamp01 } from './kit.js';

const R = 0.95;
const H = 2.3;
const COINS = 46;
const T = (H - 0.25) / COINS;

export default function build() {
  const object = group();
  // coins inside (instanced, stacked with a little jitter)
  const coinGeo = new THREE.CylinderGeometry(R * 0.8, R * 0.8, T * 0.92, 40);
  const coinMat = clay(PALETTE.gold, { emissive: 0.12 });
  coinMat.roughness = 0.45;
  coinMat.metalness = 0.35;
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, COINS);
  coins.castShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  object.add(coins);

  // glass
  const glass = new THREE.MeshPhysicalMaterial({ color: '#eaf4f6', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  const body = mesh(cylinder(R, R, H, 48), glass, { y: H / 2 + 0.05 });
  body.castShadow = false;
  body.renderOrder = 2;
  object.add(body);
  object.add(mesh(cylinder(R + 0.04, R + 0.04, 0.08, 48), clay('#d9d2c4'), { y: 0.04 }));
  object.add(mesh(cylinder(R * 0.82, R * 0.86, 0.12, 40), clay(PALETTE.slate), { y: H + 0.12 }));
  object.add(mesh(rounded(0.5, 0.05, 0.1, 0.02), clay(PALETTE.ink), { y: H + 0.19 }));

  // target ring + flag
  const targetMat = clay(PALETTE.terracotta, { emissive: 0.2 });
  const target = mesh(torus(R + 0.06, 0.035, 64), targetMat, { rx: Math.PI / 2 });
  object.add(target);
  const flag = group();
  flag.add(mesh(cylinder(0.025, 0.025, 0.9, 10), clay(PALETTE.ink), { y: 0.45 }));
  const flagMat = clay(PALETTE.green, { emissive: 0.2 });
  flag.add(mesh(rounded(0.45, 0.28, 0.03, 0.02), flagMat, { x: 0.23, y: 0.75 }));
  flag.position.set(R + 0.06, 0, 0);
  object.add(flag);

  // ghost ring: previous try
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false });
  const ghost = mesh(torus(R + 0.02, 0.02, 64), ghostMat, { rx: Math.PI / 2 });
  object.add(ghost);

  const yOf = (f) => 0.1 + clamp01(f) * (H - 0.2);
  let reached = 0;
  const api = {
    object,
    height: H + 0.3,
    footprint: 1.3,
    anchor: new THREE.Vector3(0, H + 0.3, 0),
    setValue(v) {
      const n = clamp01(v) * COINS;
      for (let i = 0; i < COINS; i++) {
        const t = clamp01(n - i);
        const s = t > 0.001 ? 1 : 0;
        e.set(0, i * 0.7, 0);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(Math.sin(i * 12.9898) * 0.05, 0.1 + T / 2 + i * T + (1 - t) * 0.4, Math.cos(i * 78.233) * 0.05), q, new THREE.Vector3(s, s, s));
        coins.setMatrixAt(i, m4);
      }
      coins.instanceMatrix.needsUpdate = true;
    },
    /** @param {number|null} f target level 0..1 (null hides) */
    setTarget(f) {
      target.visible = f !== null;
      if (f === null) return;
      target.position.y = yOf(f);
      flag.position.y = yOf(f);
    },
    /** 0..1: flag rises and the ring turns green once the target is reached. */
    setReached(k) {
      reached = clamp01(k);
      flag.scale.setScalar(Math.max(0.001, reached));
      targetMat.color.set(reached > 0.5 ? PALETTE.green : PALETTE.terracotta);
      targetMat.emissive.copy(targetMat.color);
    },
    /** @param {number|null} f previous try's level (null hides) */
    setGhost(f) {
      ghostMat.opacity = f === null ? 0 : 0.85;
      if (f !== null) ghost.position.y = yOf(f);
    },
  };
  api.setTarget(0.7);
  api.setReached(0);
  api.setGhost(null);
  api.setValue(0.3);
  return api;
}
