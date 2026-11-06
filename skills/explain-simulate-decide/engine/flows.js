// Flows: things travelling along a track between two nodes. The track shows the
// connection; the particles show the rate. Speed is fixed per carrier, so "more"
// always looks like "more of them", never "faster", and flows of one kind compare.
import * as THREE from './vendor/three/three.module.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';

const GREY = new THREE.Color('#c9c2b6');
const COIN_R = 0.2;

/** A minted coin: a lathe profile with a raised rim, so it catches light like metal. */
function coinGeometry() {
  const r = COIN_R;
  const t = 0.035; // half thickness
  const prof = [
    [0, t * 0.7], [r * 0.78, t * 0.7], [r * 0.82, t], [r * 0.97, t], [r, t * 0.75],
    [r, -t * 0.75], [r * 0.97, -t], [r * 0.82, -t], [r * 0.78, -t * 0.7], [0, -t * 0.7],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // lathe turns around Y; lay the coin's axle along Z so it can stand and roll along X
  return new THREE.LatheGeometry(prof, 40).rotateX(Math.PI / 2);
}

// carrier look: track (radius, colour, opacity) and particles (geometry, colour, spacing, speed)
// roll: stands on edge and rolls (coins). along: points along the track (pulses, beams).
const CARRIERS = {
  energy: { track: [0.075, '#4a5260', 0.55, 'glass'], color: '#f2a200', glow: 1.1, geo: () => new THREE.CapsuleGeometry(0.045, 0.42, 4, 10), gap: 0.62, speed: 1.35, lift: 0, along: true },
  money: { path: [0.42, '#efe2c2', '#c9b48a'], color: '#f2c14e', glow: 0.12, geo: coinGeometry, gap: 0.72, speed: 0.85, lift: COIN_R + 0.045, roll: true, metal: true },
  water: { track: [0.1, '#a9d3ea', 0.4, 'glass'], color: '#3f95d6', glow: 0.5, geo: () => new THREE.SphereGeometry(0.075, 16, 12), gap: 0.3, speed: 1.05, lift: 0 },
  heat: { track: [0.075, '#6b4a3d', 0.55, 'glass'], color: '#f0602a', glow: 1.2, geo: () => new THREE.SphereGeometry(0.06, 16, 12), gap: 0.36, speed: 0.95, lift: 0 },
  light: { track: null, beam: 0.34, color: '#fff0bf', glow: 3.2, geo: () => new THREE.CapsuleGeometry(0.022, 0.8, 4, 8), gap: 0.7, speed: 2.8, lift: 0, along: true },
  goods: { path: [0.46, '#e3d6bd', '#b9a581'], color: '#c98b5a', glow: 0.05, geo: () => new RoundedBoxGeometry(0.28, 0.24, 0.28, 2, 0.04), gap: 0.8, speed: 0.75, lift: 0.14 },
  people: { path: [0.46, '#e3d6bd', '#b9a581'], color: '#5b6b80', glow: 0.05, geo: () => new THREE.CapsuleGeometry(0.08, 0.2, 4, 10), gap: 0.7, speed: 0.6, lift: 0.18 },
  data: { track: [0.06, '#2a3344', 0.55, 'glass'], color: '#1fb3cc', glow: 1.2, geo: () => new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), gap: 0.34, speed: 1.9, lift: 0, along: true },
  // a cause: arrowheads along a fine line, "this pushes on that"; more arrows, a bigger effect
  influence: { track: [0.028, '#6f6491', 0.65], color: '#7a62c9', glow: 0.8, geo: () => new THREE.ConeGeometry(0.1, 0.24, 18), gap: 0.55, speed: 1.0, lift: 0, along: true },
  // hours and minutes: small glowing rings in a glass channel
  time: { track: [0.065, '#3f5866', 0.5, 'glass'], color: '#2f9ec0', glow: 0.9, geo: () => new THREE.TorusGeometry(0.07, 0.022, 10, 24), gap: 0.4, speed: 0.9, lift: 0, along: true },
  // carbon and other emissions: soft grey puffs drifting through the air, no pipe
  carbon: { track: null, color: '#7b7f86', glow: 0, geo: () => new THREE.IcosahedronGeometry(0.14, 3), gap: 0.5, speed: 0.55, lift: 0.4, puff: true },
  // medicine, food, pollutants, any stuff: capsules in a glass tube
  substance: { track: [0.07, '#5c4a6e', 0.5, 'glass'], color: '#9a62d6', glow: 0.9, geo: () => new THREE.CapsuleGeometry(0.045, 0.1, 4, 10), gap: 0.36, speed: 0.9, lift: 0, along: true },
};

/** A soft shaft of light along a curve: brightest down its middle, gently pulsing. */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color('#ffe9b0') }, strength: { value: 0 }, phase: { value: 0 }, len: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; uniform float phase; uniform float len; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.5);
        float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float waves = 0.72 + 0.28 * sin((vUv.x * len - phase) * 2.2);
        gl_FragColor = vec4(color * core * ends * waves * strength, 1.0);
      }`,
  });
}

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
    const [r, color, opacity = 1, kind] = look.track;
    trackOpacity = opacity;
    trackMat =
      kind === 'glass'
        ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity, depthWrite: false })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: true, opacity });
    const track = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(length * 8)), r, 14), trackMat);
    track.receiveShadow = true;
    track.castShadow = kind !== 'glass' && r > 0.08;
    track.renderOrder = 1; // glass first, so what travels inside it is drawn over it
    group.add(track);
  }
  let beam = null;
  if (look.beam) {
    beam = beamMaterial();
    beam.uniforms.len.value = length;
    const shaft = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(length * 6)), look.beam, 20), beam);
    shaft.renderOrder = 3;
    group.add(shaft);
  }
  const color = new THREE.Color(look.color);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: look.glow, roughness: look.metal ? 0.3 : look.puff ? 1 : 0.5, metalness: look.metal ? 0.7 : 0, envMapIntensity: look.metal ? 3 : 1, transparent: true });
  const slots = Math.max(2, Math.ceil(length / look.gap));
  const rank = spreadOrder(slots);
  const parts = new THREE.InstancedMesh(look.geo(), mat, slots);
  parts.castShadow = !look.along;
  parts.frustumCulled = false;
  parts.renderOrder = 2;
  group.add(parts);

  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const spin = new THREE.Quaternion();
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
    const travelled = time * look.speed;
    const phase = travelled / length;
    if (beam) {
      beam.uniforms.strength.value = visible * (0.25 + 0.75 * emphasis) * (amount > 1e-6 ? 0.35 + 0.65 * Math.sqrt(amount) : 0);
      beam.uniforms.phase.value = travelled;
    }
    for (let i = 0; i < slots; i++) {
      const s0 = Math.min(1, Math.max(0, n - rank[i]));
      const u = (((i / slots + phase) % 1) + 1) % 1;
      // ease in and out of the ends rather than popping
      const e = Math.min(1, u / 0.07, (1 - u) / 0.07);
      const edge = e * e * (3 - 2 * e);
      const s = s0 * edge * visible;
      curve.getPointAt(u, pos);
      curve.getTangentAt(u, tan);
      pos.y += look.lift;
      let grow = 1;
      if (look.puff) {
        // a puff rises and swells a little as it drifts, like smoke
        pos.y += 0.18 * Math.sin(u * length * 1.3 + i * 2.1) + u * 0.35;
        grow = 0.7 + 0.6 * u;
      }
      if (look.along) q.setFromUnitVectors(up, tan);
      else {
        tan.y = 0;
        if (tan.lengthSq() < 1e-6) tan.set(1, 0, 0);
        q.setFromUnitVectors(X, tan.normalize());
        // a coin rolls on its edge: it turns about its axle by distance / radius
        if (look.roll) {
          pos.y += COIN_R * (s - 1); // keeps a growing coin touching the path
          q.multiply(spin.setFromAxisAngle(Z, -(u * length) / COIN_R));
        }
      }
      m4.compose(pos, q, scl.setScalar(Math.max(s * grow, 1e-4)));
      parts.setMatrixAt(i, m4);
    }
    parts.instanceMatrix.needsUpdate = true;
  }

  return { update, curve, length, midpoint: () => curve.getPointAt(0.5) };
}
