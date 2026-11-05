// Flows: things travelling along a track between two nodes. The track shows the
// connection; the particles show the rate. Speed is fixed per carrier, so "more"
// always looks like "more of them", never "faster", and flows of one kind compare.
import * as THREE from './vendor/three/three.module.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';

const GREY = new THREE.Color('#c9c2b6');

// carrier look: track (radius, colour) and particles (geometry, colour, spacing, speed)
const CARRIERS = {
  energy: { track: [0.04, '#3f4552'], color: '#ffc93c', glow: 1.4, geo: () => new THREE.CapsuleGeometry(0.09, 0.22, 4, 10).rotateZ(Math.PI / 2), gap: 0.42, speed: 1.35, lift: 0.07 },
  money: { path: [0.42, '#efe2c2', '#c9b48a'], color: '#e7b448', glow: 0.25, geo: () => new THREE.CylinderGeometry(0.2, 0.2, 0.06, 28).rotateX(Math.PI / 2), gap: 0.7, speed: 0.85, lift: 0.28, hop: true, metal: true },
  water: { track: [0.1, '#a9d3ea', 0.45], color: '#4d9fd8', glow: 0.35, geo: () => new THREE.SphereGeometry(0.1, 16, 12), gap: 0.36, speed: 1.05, lift: 0 },
  heat: { track: [0.07, '#b9806a'], color: '#ff7a3d', glow: 1.2, geo: () => new THREE.SphereGeometry(0.11, 16, 12), gap: 0.4, speed: 0.95, lift: 0.06 },
  light: { track: null, color: '#fff1b0', glow: 2.2, geo: () => new THREE.CapsuleGeometry(0.05, 0.6, 4, 8), gap: 0.55, speed: 2.8, lift: 0, along: true },
  goods: { path: [0.46, '#e3d6bd', '#b9a581'], color: '#c98b5a', glow: 0.05, geo: () => new RoundedBoxGeometry(0.28, 0.24, 0.28, 2, 0.04), gap: 0.8, speed: 0.75, lift: 0.18 },
  people: { path: [0.46, '#e3d6bd', '#b9a581'], color: '#5b6b80', glow: 0.05, geo: () => new THREE.CapsuleGeometry(0.08, 0.2, 4, 10), gap: 0.7, speed: 0.6, lift: 0.22 },
  data: { track: [0.04, '#3f4656'], color: '#5fd4e6', glow: 1.4, geo: () => new THREE.BoxGeometry(0.12, 0.12, 0.12), gap: 0.3, speed: 1.9, lift: 0.06 },
};

/** A flat strip that follows the curve on the ground (a path, not a pipe). */
function ribbon(curve, width, y0) {
  const n = Math.max(24, Math.round(curve.getLength() * 6));
  const pos = [];
  const idx = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, p);
    curve.getTangentAt(i / n, t);
    side.crossVectors(t, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().multiplyScalar(width / 2);
    const y = Math.max(y0, p.y - 0.15 + y0);
    pos.push(p.x - side.x, y, p.z - side.z, p.x + side.x, y, p.z + side.z);
    if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Slot order that spreads any first-n slots evenly along the track. */
function spreadOrder(n) {
  const bits = Math.max(1, Math.ceil(Math.log2(n)));
  const out = [];
  for (let i = 0; out.length < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    if (r < n) out.push(r);
  }
  const rank = new Array(n);
  out.forEach((slot, k) => (rank[slot] = k));
  return rank;
}

/**
 * @param {THREE.Scene} scene
 * @param {string} carrier
 * @param {number[][]} points
 */
export function createFlow(scene, carrier, points) {
  const look = CARRIERS[carrier] || CARRIERS.energy;
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const length = curve.getLength();
  const group = new THREE.Group();
  scene.add(group);

  let trackMat = null;
  let trackOpacity = 1;
  if (look.path) {
    const [w, color, edge] = look.path;
    const edgeMat = new THREE.MeshStandardMaterial({ color: edge, roughness: 1, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
    const under = new THREE.Mesh(ribbon(curve, w + 0.1, 0.03), edgeMat);
    trackMat = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    const top = new THREE.Mesh(ribbon(curve, w, 0.04), trackMat);
    under.receiveShadow = top.receiveShadow = true;
    group.add(under, top);
  } else if (look.track) {
    const [r, color, opacity = 1] = look.track;
    trackOpacity = opacity;
    trackMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: true, opacity });
    const track = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(length * 8)), r, 10), trackMat);
    track.receiveShadow = true;
    track.castShadow = r > 0.08;
    group.add(track);
  }
  const color = new THREE.Color(look.color);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: look.glow, roughness: look.metal ? 0.35 : 0.6, metalness: look.metal ? 0.4 : 0, transparent: true });
  const slots = Math.max(2, Math.ceil(length / look.gap));
  const rank = spreadOrder(slots);
  const parts = new THREE.InstancedMesh(look.geo(), mat, slots);
  parts.castShadow = carrier !== 'light';
  parts.frustumCulled = false;
  group.add(parts);

  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3(1, 0, 0);
  const scl = new THREE.Vector3();
  const base = new THREE.Color(look.color);
  const trackBase = trackMat ? trackMat.color.clone() : null;

  /**
   * @param {{amount: number, emphasis: number, visible: number, time: number}} s
   *   amount 0..1 share of the busiest flow of this kind; emphasis 0..1; visible 0..1 (node appearing); time in seconds
   */
  function update({ amount, emphasis, visible, time }) {
    group.visible = visible > 0.01;
    if (!group.visible) return;
    if (trackMat) {
      trackMat.opacity = trackOpacity * visible * (0.35 + 0.65 * emphasis);
      trackMat.color.copy(trackBase).lerp(GREY, (1 - emphasis) * 0.5);
    }
    mat.color.copy(base).lerp(GREY, (1 - emphasis) * 0.6);
    mat.emissive.copy(mat.color);
    mat.emissiveIntensity = look.glow * (0.3 + 0.7 * emphasis);
    mat.opacity = visible * (0.45 + 0.55 * emphasis);
    // a trickle never disappears entirely while there is any flow at all
    const n = amount > 1e-6 ? Math.max(1.2, amount * slots) : 0;
    const phase = (time * look.speed) / length;
    for (let i = 0; i < slots; i++) {
      const s0 = Math.min(1, Math.max(0, n - rank[i]));
      const u = (((i / slots + phase) % 1) + 1) % 1;
      const edge = Math.min(1, u / 0.05, (1 - u) / 0.05);
      const s = s0 * edge * visible;
      curve.getPointAt(u, pos);
      curve.getTangentAt(u, tan);
      if (look.hop) pos.y += Math.abs(Math.sin(u * length * 2.2)) * look.lift + 0.12;
      else pos.y += look.lift;
      if (look.along) q.setFromUnitVectors(up, tan);
      else {
        tan.y = 0;
        if (tan.lengthSq() < 1e-6) tan.set(1, 0, 0);
        q.setFromUnitVectors(X, tan.normalize());
        if (look.hop) q.multiply(new THREE.Quaternion().setFromAxisAngle(X, u * length * 3));
      }
      m4.compose(pos, q, scl.setScalar(Math.max(s, 1e-4)));
      parts.setMatrixAt(i, m4);
    }
    parts.instanceMatrix.needsUpdate = true;
  }

  return { update, curve, length, midpoint: () => curve.getPointAt(0.5) };
}
