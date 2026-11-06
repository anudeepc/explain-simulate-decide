// Character: the film's hero, a friendly articulated clay person who walks, picks things up,
// reads, hands them over, sits, talks and reacts. pose(action, k) is pure: it resets every
// joint and rebuilds the whole body from (action, k, opts), so it can be called every frame,
// scrubbed backwards, or jumped to any moment.
//
// Units are metres. Origin at the feet, standing on y = 0, facing +Z (the character's right
// hand is on the -X side). Joint hierarchy:
//   hips -> spine -> chest -> neck -> head
//                    chest -> shoulderL/R -> elbowL/R -> wristL/R -> (fingersL/R, hand)
//   hips -> hipL/R -> kneeL/R -> ankleL/R
import { THREE, clay, rounded, cylinder, sphere, mesh, group, lerp, clamp01 } from './kit.js';
import { ACTIONS, EXPRESSIONS } from './actions.js';

// ---- proportions (metres) -------------------------------------------------------------
const THIGH = 0.375;
const SHIN = 0.39;
const ANKLE_H = 0.095; // ankle joint above the sole
const HIP_Y = THIGH + SHIN + ANKLE_H; // 0.86: hip joints when the legs are straight
const STAND_Y = HIP_Y - 0.006; // a hair of knee bend reads as relaxed, not locked
const HIP_X = 0.088;
const UPPER = 0.275;
const FORE = 0.245;
const PALM = 0.065; // wrist to the palm point (where carried things sit)
const SEAT_Y = 0.45;

const capsule = (r, len, cap = 5, radial = 14) => new THREE.CapsuleGeometry(r, len, cap, radial);
const ss = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const PI = Math.PI;
const TAU = PI * 2;

// fixed targets in character space (x right-of-character is -X)
const T = {
  rest: { R: new THREE.Vector3(-0.245, 0.8, 0.03), L: new THREE.Vector3(0.245, 0.8, 0.03) },
  floor: new THREE.Vector3(-0.1, 0.1, 0.4),
  give: new THREE.Vector3(-0.1, 1.12, 0.47),
  place: new THREE.Vector3(-0.1, 0.95, 0.46),
};
// targets that travel with the chest (so they still work seated or leaning), in the chest's frame
const C = {
  hold: new THREE.Vector3(-0.1, -0.02, 0.3),
  readR: new THREE.Vector3(-0.08, 0.04, 0.31),
  readL: new THREE.Vector3(0.08, 0.04, 0.31),
  foldR: new THREE.Vector3(0.15, 0.08, 0.17),
  foldL: new THREE.Vector3(-0.15, 0.035, 0.215),
  watch: new THREE.Vector3(0.03, 0.1, 0.3),
};
const FOLD = { R: new THREE.Vector3(-1, -0.9, -0.1), L: new THREE.Vector3(1, -0.9, -0.1) };
const POLE = {
  // where the elbow points, in the chest's frame: back and out
  armR: new THREE.Vector3(-0.45, -0.25, -1),
  armL: new THREE.Vector3(0.45, -0.25, -1),
  // where the knee points, in the hips' frame: forward (and a touch out)
  legR: new THREE.Vector3(-0.08, 0, 1),
  legL: new THREE.Vector3(0.08, 0, 1),
};

export default function build({ tint = '#5b7fb0', skin = '#e8c4a8', hair = '#3a2e28', outfit = 'casual' } = {}) {
  const scrubs = outfit === 'scrubs';
  const M = {
    skin: clay(skin),
    shirt: clay(tint),
    pants: clay(scrubs ? new THREE.Color(tint).multiplyScalar(0.86) : '#3b4352'),
    shoe: clay(scrubs ? '#6d7480' : '#2f3440'),
    sole: clay('#f1ece4'),
    hair: clay(hair),
    eye: new THREE.MeshStandardMaterial({ color: '#1f1b1a', roughness: 0.35, metalness: 0 }),
    white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    brow: clay(new THREE.Color(hair).multiplyScalar(0.85)),
    mouth: clay('#7a3b33'),
    cheek: clay('#f0a99a'),
    watch: clay('#2b2b30'),
    watchFace: clay('#f4ecdd'),
    badge: clay('#ffffff'),
  };

  const object = group();
  object.name = 'character';
  const J = {}; // joints by name
  const joint = (name, parent, x = 0, y = 0, z = 0) => {
    const g = group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    J[name] = g;
    return g;
  };

  // ---- torso -------------------------------------------------------------------------
  const hips = joint('hips', object, 0, STAND_Y, 0);
  hips.add(mesh(rounded(0.31, 0.18, 0.21, 0.085), M.pants, { y: 0.035, z: -0.005 }));
  const spine = joint('spine', hips, 0, 0.085, 0);
  spine.add(mesh(capsule(0.135, 0.07, 5, 16), M.shirt, { y: 0.07 }));
  spine.children.at(-1).scale.set(1.22, 1, 0.82);
  const chest = joint('chest', spine, 0, 0.14, 0);
  const chestMesh = mesh(capsule(0.16, 0.12, 6, 16), M.shirt, { y: 0.155 });
  chestMesh.scale.set(1.22, 0.83, 0.78);
  chest.add(chestMesh);
  chestMesh.userData.base = chestMesh.scale.clone();
  // collar
  chest.add(mesh(new THREE.TorusGeometry(0.06, 0.021, 8, 20), scrubs ? M.pants : M.shirt, { y: 0.3, z: 0.005, rx: PI / 2 + 0.25 }));
  if (scrubs) {
    // a V of skin at the neckline and a small ID badge
    const v = mesh(cylinder(0.05, 0.002, 0.075, 3), M.skin, { y: 0.27, z: 0.112, rx: -0.32, ry: PI });
    v.scale.set(1, 1, 0.25);
    chest.add(v);
    chest.add(mesh(rounded(0.05, 0.065, 0.012, 0.006, 2), M.badge, { x: 0.075, y: 0.17, z: 0.112, rx: -0.12 }));
    chest.add(mesh(rounded(0.04, 0.012, 0.004, 0.002, 1), clay(tint), { x: 0.075, y: 0.192, z: 0.119, rx: -0.12 }));
    chest.add(mesh(cylinder(0.003, 0.003, 0.07, 6), clay('#5a6270'), { x: 0.075, y: 0.235, z: 0.11, rx: -0.1 }));
  }

  // ---- head ---------------------------------------------------------------------------
  const neck = joint('neck', chest, 0, 0.315, -0.005);
  neck.add(mesh(cylinder(0.05, 0.058, 0.11, 16), M.skin, { y: 0.025 }));
  const head = joint('head', neck, 0, 0.055, 0.008);
  const HEAD_R = 0.14;
  const skull = group();
  skull.position.y = 0.128;
  head.add(skull);
  const headMesh = mesh(sphere(HEAD_R, 28), M.skin);
  headMesh.scale.set(1, 1.06, 0.98);
  skull.add(headMesh);
  const feat = group(); // nose, ears, cheeks, hair tufts and face, laid out for a 0.125 head
  feat.scale.setScalar(HEAD_R / 0.125);
  skull.add(feat);
  feat.add(mesh(sphere(0.019, 12), M.skin, { y: -0.012, z: 0.122, s: 1 })); // nose
  feat.children.at(-1).scale.set(1, 0.9, 0.8);
  for (const sx of [-1, 1]) {
    const ear = mesh(sphere(0.03, 12), M.skin, { x: sx * 0.122, y: -0.005, z: -0.005 });
    ear.scale.set(0.45, 1, 0.75);
    feat.add(ear);
    const cheek = mesh(sphere(0.022, 12), M.cheek, { x: sx * 0.07, y: -0.035, z: 0.097 });
    cheek.scale.set(1, 0.7, 0.35);
    cheek.rotation.y = sx * 0.6;
    cheek.castShadow = false;
    feat.add(cheek);
  }
  // hair: a cap tilted back (hairline high at the front, low at the nape) and a side swoop
  const cap = mesh(new THREE.SphereGeometry(HEAD_R * 1.07, 32, 14, 0, TAU, 0, PI * 0.46), M.hair, { rx: -0.5, y: 0.006, z: -0.006 });
  cap.scale.set(1, 1.06, 1);
  skull.add(cap); // sized from HEAD_R directly
  const swoop = mesh(sphere(0.07, 20), M.hair, { x: 0.035, y: 0.108, z: 0.058, rz: -0.42, rx: 0.45 });
  swoop.scale.set(1.25, 0.5, 0.75);
  feat.add(swoop);
  const swoop2 = mesh(sphere(0.06, 18), M.hair, { x: -0.05, y: 0.112, z: 0.045, rz: 0.4, rx: 0.4 });
  swoop2.scale.set(1.1, 0.45, 0.75);
  feat.add(swoop2);
  const back = mesh(sphere(0.12, 20), M.hair, { y: 0.0, z: -0.035 });
  back.scale.set(1.04, 0.98, 0.95);
  feat.add(back);

  // face
  const face = group();
  face.position.set(0, 0, 0);
  feat.add(face);
  const eyes = [];
  const brows = [];
  for (const sx of [-1, 1]) {
    const eye = group();
    eye.position.set(sx * 0.044, 0.018, 0.111);
    const ball = mesh(sphere(0.0175, 14), M.eye);
    ball.scale.set(1, 1.15, 0.55);
    ball.castShadow = false;
    eye.add(ball);
    const glint = mesh(sphere(0.0048, 8), M.white, { x: 0.006, y: 0.008, z: 0.008 });
    glint.castShadow = false;
    eye.add(glint);
    face.add(eye);
    eyes.push(eye);
    const brow = group();
    brow.position.set(sx * 0.046, 0.06, 0.104);
    brow.rotation.x = -0.45;
    const bar = mesh(capsule(0.0062, 0.026, 3, 8), M.brow, { rz: PI / 2 });
    bar.castShadow = false;
    brow.add(bar);
    face.add(brow);
    brows.push({ g: brow, side: sx });
  }
  const mouth = group();
  mouth.position.set(0, -0.052, 0.11);
  mouth.rotation.x = 0.3;
  face.add(mouth);
  const ARC = PI * 0.62;
  const smileGeo = new THREE.TorusGeometry(0.034, 0.0055, 6, 18, ARC);
  const smile = mesh(smileGeo, M.mouth, { rz: -PI / 2 - ARC / 2, y: 0.034 });
  const smileG = group();
  smileG.add(smile);
  const frown = mesh(smileGeo, M.mouth, { rz: PI / 2 - ARC / 2, y: -0.034 });
  const frownG = group();
  frownG.add(frown);
  const flat = mesh(capsule(0.0055, 0.034, 3, 8), M.mouth, { rz: PI / 2 });
  const open = mesh(sphere(0.02, 14), M.mouth);
  open.scale.set(1, 0.6, 0.35);
  for (const m of [smile, frown, flat, open]) m.castShadow = false;
  mouth.add(smileG, frownG, flat, open);

  // ---- arms ---------------------------------------------------------------------------
  const fingers = {};
  for (const [side, sx] of [['R', -1], ['L', 1]]) {
    chest.add(mesh(sphere(0.06, 16), M.shirt, { x: sx * 0.19, y: 0.268, z: -0.01 })); // shoulder ball
    const sh = joint(`shoulder${side}`, chest, sx * 0.2, 0.28, -0.01);
    sh.add(mesh(capsule(0.058, 0.08, 5, 14), M.shirt, { y: -0.065 })); // short sleeve
    sh.add(mesh(capsule(0.048, 0.19, 4, 12), M.skin, { y: -0.15 }));
    const el = joint(`elbow${side}`, sh, 0, -UPPER, 0);
    el.add(mesh(capsule(0.044, 0.19, 4, 12), M.skin, { y: -0.12 }));
    if (side === 'L') {
      el.add(mesh(new THREE.TorusGeometry(0.043, 0.008, 8, 20), M.watch, { y: -0.205, rx: PI / 2 }));
      el.add(mesh(cylinder(0.017, 0.017, 0.007, 16), M.watchFace, { x: 0.05, y: -0.205, rz: PI / 2 }));
    }
    const wr = joint(`wrist${side}`, el, 0, -FORE, 0);
    // mitten hand: palm faces the body when the arm hangs; thumb on the front
    wr.add(mesh(rounded(0.036, 0.078, 0.075, 0.017, 2), M.skin, { y: -0.036 }));
    wr.add(mesh(capsule(0.0135, 0.03, 3, 8), M.skin, { x: -sx * 0.008, y: -0.032, z: 0.043, rx: 0.5, rz: -sx * 0.2 }));
    const fg = joint(`fingers${side}`, wr, 0, -0.07, 0);
    fg.add(mesh(rounded(0.032, 0.062, 0.07, 0.015, 2), M.skin, { y: -0.026 }));
    fingers[side] = fg;
  }
  // the right palm: carried things are parented here
  const hand = new THREE.Object3D();
  hand.name = 'hand';
  hand.position.set(0.02, -PALM, 0);
  J.wristR.add(hand);

  // ---- legs ---------------------------------------------------------------------------
  for (const [side, sx] of [['R', -1], ['L', 1]]) {
    const hp = joint(`hip${side}`, hips, sx * HIP_X, 0, 0);
    hp.add(mesh(capsule(0.078, 0.27, 5, 14), M.pants, { y: -0.185 }));
    const kn = joint(`knee${side}`, hp, 0, -THIGH, 0);
    kn.add(mesh(capsule(0.07, 0.29, 5, 14), M.pants, { y: -0.195 }));
    const an = joint(`ankle${side}`, kn, 0, -SHIN, 0);
    an.add(mesh(rounded(0.115, 0.08, 0.255, 0.038, 2), M.shoe, { y: -0.048, z: 0.05 }));
    an.add(mesh(rounded(0.12, 0.024, 0.265, 0.011, 1), M.sole, { y: -0.083, z: 0.05 }));
  }

  object.traverse((o) => {
    if (o.isMesh && o.castShadow) o.receiveShadow = true;
  });

  // ---- rest state, so every pose starts from scratch -----------------------------------
  const JOINTS = Object.values(J);
  const rest = JOINTS.map((j) => ({ j, p: j.position.clone(), q: j.quaternion.clone() }));
  const handRest = { p: hand.position.clone(), q: hand.quaternion.clone() };

  // ---- scratch maths -------------------------------------------------------------------
  const _m = new THREE.Matrix4();
  const _mi = new THREE.Matrix4();
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _basis = new THREE.Matrix4();
  const _x = new THREE.Vector3();
  const _y = new THREE.Vector3();
  const _z = new THREE.Vector3();
  const _pp = new THREE.Vector3();
  const _e = new THREE.Euler();

  /** Matrix of `node` relative to the character (not the world), from local transforms only. */
  function chain(node, out) {
    const list = [];
    for (let n = node; n && n !== object; n = n.parent) list.push(n);
    out.identity();
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].updateMatrix();
      out.multiply(list[i].matrix);
    }
    return out;
  }
  /** Rotation of `node` relative to the character. */
  function chainQuat(node, out) {
    out.identity();
    const list = [];
    for (let n = node; n && n !== object; n = n.parent) list.push(n);
    for (let i = list.length - 1; i >= 0; i--) out.multiply(list[i].quaternion);
    return out;
  }
  /** Position of a joint (or a point local to it) in character space. */
  function where(node, local = null, out = new THREE.Vector3()) {
    chain(node, _m);
    return (local ? out.copy(local) : out.set(0, 0, 0)).applyMatrix4(_m);
  }

  /**
   * Two-bone IK: aim `upper` so the end of `lower` (+ reach past it) lands on `target`
   * (character space). `pole` (in upper's parent frame) is where the middle joint points.
   * Arms bend toward local +z (elbow rx < 0); legs bend toward -z (knee rx > 0).
   */
  function ik(upper, lower, target, pole, a, b, isLeg) {
    chain(upper.parent, _m);
    _mi.copy(_m).invert();
    const d = _v.copy(target).applyMatrix4(_mi).sub(upper.position);
    let c = d.length();
    const dn = d.normalize();
    c = Math.min(Math.max(c, Math.abs(a - b) + 1e-3), a + b - 1e-4);
    const alpha = Math.acos(Math.max(-1, Math.min(1, (a * a + c * c - b * b) / (2 * a * c))));
    const gamma = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b))));
    _pp.copy(pole).addScaledVector(dn, -pole.dot(dn)).normalize();
    // upper bone points along u = dn cos(alpha) + pp sin(alpha); local y = -u
    _y.copy(dn).multiplyScalar(-Math.cos(alpha)).addScaledVector(_pp, -Math.sin(alpha));
    _z.copy(dn).multiplyScalar(Math.sin(alpha)).addScaledVector(_pp, -Math.cos(alpha));
    if (isLeg) _z.negate();
    _x.crossVectors(_y, _z);
    _basis.makeBasis(_x, _y, _z);
    upper.quaternion.setFromRotationMatrix(_basis);
    lower.rotation.set(isLeg ? PI - gamma : -(PI - gamma), 0, 0);
  }

  // ---- building blocks of a pose --------------------------------------------------------
  let grip = { R: 0.2, L: 0.2 };
  let mouthOpen = 0;
  let handTilt = null; // null = carried things stay upright, aligned with the body

  function reset() {
    for (const r of rest) {
      r.j.position.copy(r.p);
      r.j.quaternion.copy(r.q);
      r.j.scale.set(1, 1, 1);
    }
    hand.position.copy(handRest.p);
    hand.quaternion.copy(handRest.q);
    chestMesh.scale.copy(chestMesh.userData.base);
    grip = { R: 0.2, L: 0.2 };
    mouthOpen = 0;
    handTilt = null;
  }

  const footR = new THREE.Vector3();
  const footL = new THREE.Vector3();
  /** Plant both feet (ankle targets in character space) and keep the soles flat. */
  function plantFeet({ rx = -HIP_X - 0.005, rz = 0, lx = HIP_X + 0.005, lz = 0, lift = 0 } = {}) {
    footR.set(rx, ANKLE_H + lift, rz);
    footL.set(lx, ANKLE_H, lz);
    ik(J.hipR, J.kneeR, footR, POLE.legR, THIGH, SHIN, true);
    ik(J.hipL, J.kneeL, footL, POLE.legL, THIGH, SHIN, true);
    flatFoot(J.ankleR);
    flatFoot(J.ankleL);
  }
  function flatFoot(ankle, pitch = 0) {
    chainQuat(ankle.parent, _q).invert();
    _q2.setFromEuler(_e.set(pitch, 0, 0));
    ankle.quaternion.copy(_q).multiply(_q2);
  }

  /** Arms hanging relaxed at the sides (forward kinematics). */
  function armRest(side, swing = 0) {
    const sx = side === 'R' ? -1 : 1;
    J[`shoulder${side}`].rotation.set(0.04 + swing, 0, sx * 0.075);
    J[`elbow${side}`].rotation.set(-0.16 - Math.max(0, -swing) * 0.5, 0, 0);
    J[`wrist${side}`].rotation.set(0, 0, -sx * 0.06);
  }

  /** A chest-frame point in character space. */
  const atChest = (v) => where(chest, v, new THREE.Vector3());

  /** Reach the hand (palm point) to a target; w < 1 blends from the relaxed arm toward it. */
  function reach(side, target, w = 1, pole = side === 'R' ? POLE.armR : POLE.armL) {
    const sh = J[`shoulder${side}`];
    const el = J[`elbow${side}`];
    armRest(side);
    if (w <= 0) return;
    const q0 = sh.quaternion.clone();
    const e0 = el.rotation.x;
    ik(sh, el, target, pole, UPPER, FORE + PALM, false);
    J[`wrist${side}`].rotation.set(0, 0, 0);
    if (w < 1) {
      sh.quaternion.slerpQuaternions(q0, sh.quaternion.clone(), w);
      el.rotation.x = lerp(e0, el.rotation.x, w);
    }
  }

  /** Lower body seated on a 0.45 m seat behind the feet (k = 0 standing .. 1 seated). */
  function sitLower(k) {
    const e = ss(0, 1, k);
    const seatedY = SEAT_Y + 0.055; // hip joints above the seat top (thigh thickness, a little squish)
    hips.position.y = lerp(STAND_Y, seatedY, e);
    // the bottom travels back over the seat; it leads a little on the way down
    hips.position.z = lerp(0, -(THIGH - 0.02), ss(0, 0.85, k));
    plantFeet({ rx: -HIP_X - 0.02, lx: HIP_X + 0.02, rz: 0.0, lz: 0.0 });
    // lean in to counterbalance on the way down, sit tall at the end
    spine.rotation.x = 0.42 * Math.sin(PI * Math.min(1, k * 1.15)) - 0.04 * e;
    chest.rotation.x = 0.12 * Math.sin(PI * Math.min(1, k * 1.15));
  }

  /** Standing lower body; shift > 0 moves the weight onto the left leg. */
  function standLower(shift = 0, dip = 0) {
    hips.position.set(0.032 * shift, STAND_Y - dip, 0);
    hips.rotation.z = 0.05 * shift;
    spine.rotation.z = -0.03 * shift;
    chest.rotation.z = -0.03 * shift;
    plantFeet({ rx: -HIP_X - 0.005 - 0.02 * Math.max(0, shift), rz: 0.05 * Math.max(0, shift), lx: HIP_X + 0.005 + 0.02 * Math.max(0, -shift) });
    if (shift > 0) flatFoot(J.ankleR, 0.08 * shift); // relaxed foot rolls onto its toe a little
  }

  function breath(k, n = 1, amt = 1) {
    const b = Math.sin(TAU * n * k);
    chestMesh.scale.set(chestMesh.userData.base.x * (1 + 0.012 * amt * b), chestMesh.userData.base.y * (1 + 0.012 * amt * b), chestMesh.userData.base.z * (1 + 0.025 * amt * b));
    chest.rotation.x += -0.012 * amt * b;
    J.shoulderR.position.y += 0.003 * amt * b;
    J.shoulderL.position.y += 0.003 * amt * b;
  }

  // ---- actions --------------------------------------------------------------------------
  const ACT = {
    idle(k) {
      standLower(0.35 * Math.sin(TAU * k));
      breath(k, 2);
      armRest('R');
      armRest('L');
      head.rotation.set(0.02, 0.06 * Math.sin(TAU * k + 1), 0.025 * Math.sin(TAU * k));
    },

    walk(k, opts) {
      const steps = opts.cycles ?? 2;
      const phi = PI * steps * k; // one step = half a stride
      const s = Math.sin(phi);
      const legs = [
        ['R', -1, phi],
        ['L', 1, phi + PI],
      ];
      for (const [side, , p] of legs) {
        const th = -0.38 * Math.sin(p) - 0.04; // negative = forward
        // knee folds early in the swing (the thigh travelling forward), straight again at heel strike
        const swing = Math.max(0, Math.cos(p + 0.15));
        const kn = 0.06 + 0.72 * swing ** 3 + 0.1 * Math.max(0, -Math.cos(p));
        J[`hip${side}`].rotation.set(th, 0, 0);
        J[`knee${side}`].rotation.set(kn, 0, 0);
        // foot: flat in stance, toe-off as the leg trails, toe up just before heel strike
        J[`ankle${side}`].rotation.set(-(th + kn) + 0.25 * swing * Math.max(0, Math.sin(p + 0.6)), 0, 0);
      }
      hips.rotation.set(0, 0.07 * s, 0);
      spine.rotation.set(0.06, 0, 0);
      chest.rotation.set(0.02, -0.12 * s, 0);
      head.rotation.set(-0.04, 0.05 * s, 0);
      // feet find the floor: the lowest ankle sets the hips height (the bob falls out of it)
      hips.position.set(0, HIP_Y, 0);
      const yR = where(J.ankleR).y;
      const yL = where(J.ankleL).y;
      hips.position.y += ANKLE_H - Math.min(yR, yL);
      // arms swing opposite the legs
      armRest('R', 0.36 * s);
      armRest('L', -0.36 * s);
      J.shoulderR.rotation.z = -0.1;
      J.shoulderL.rotation.z = 0.1;
      breath(k, steps / 2, 0.6);
    },

    pickUp(k, opts) {
      const target = opts.target ? new THREE.Vector3().copy(opts.target) : T.floor;
      // down by 0.45, a beat at the bottom, back up by 1
      const c = k < 0.5 ? ss(0.04, 0.46, k) : 1 - ss(0.56, 0.98, k);
      hips.position.set(0, lerp(STAND_Y, 0.42, c), lerp(0, -0.17, c));
      hips.rotation.x = 0.42 * c;
      spine.rotation.x = 0.42 * c;
      chest.rotation.x = 0.38 * c;
      neck.rotation.x = -0.15 * c;
      head.rotation.x = -0.25 * c + 0.12 * ss(0.6, 1, k);
      plantFeet({ rx: -HIP_X - 0.045 * c, lx: HIP_X + 0.045 * c, rz: 0.0, lz: -0.04 * c });
      // knees open a little in the squat so the hand fits between them
      // the hand travels to the thing, closes on it, then brings it up to the chest
      let tgt;
      if (k < 0.5) tgt = _v.copy(T.rest.R).lerp(target, ss(0.06, 0.46, k));
      else tgt = _v.copy(target).lerp(atChest(C.hold), ss(0.55, 0.97, k));
      reach('R', tgt.clone(), 1);
      grip.R = lerp(0.2, 1, ss(0.42, 0.52, k));
      // the free hand steadies on the left knee
      const knee = where(J.kneeL, null, new THREE.Vector3()).add(_v.set(0.0, 0.06, 0.03));
      reach('L', knee, 0.9 * c);
    },

    read(k, opts) {
      if (!opts.sitting) standLower(0.15 * Math.sin(TAU * k));
      breath(k, 1.5);
      reach('R', atChest(C.readR));
      reach('L', atChest(C.readL));
      J.wristR.rotation.set(0, 0.25, 0.2);
      J.wristL.rotation.set(0, -0.25, -0.2);
      grip.R = 0.9;
      grip.L = 0.7;
      neck.rotation.x = 0.2;
      head.rotation.set(0.32 + 0.03 * Math.sin(TAU * k), 0, 0.03);
      // the item faces the reader, top tipped away
      handTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, PI, 0, 'XYZ'));
    },

    hold(k, opts) {
      if (!opts.sitting) standLower(0.25 * Math.sin(TAU * k));
      breath(k, 1.5);
      reach('R', atChest(C.hold));
      J.wristR.rotation.set(0, 0, 0.15);
      grip.R = 1;
      armRest('L');
      head.rotation.set(0.04, 0.04 * Math.sin(TAU * k), 0);
    },

    give(k, opts) {
      giveOrPlace(k, opts, opts.target ? new THREE.Vector3().copy(opts.target) : T.give, 0.14);
    },
    place(k, opts) {
      giveOrPlace(k, opts, opts.target ? new THREE.Vector3().copy(opts.target) : T.place, 0.32);
    },

    sit(k) {
      sitLower(k);
      // hands come to rest on the knees
      const w = ss(0.35, 1, k);
      for (const side of ['R', 'L']) {
        const sx = side === 'R' ? -1 : 1;
        const knee = where(J[`knee${side}`], null, new THREE.Vector3()).add(_v.set(sx * 0.01, 0.075, -0.06));
        reach(side, knee, w);
      }
      head.rotation.x = -0.08 * Math.sin(PI * k);
    },

    talk(k, opts) {
      if (!opts.sitting) standLower(0.2 * Math.sin(TAU * k));
      const g = Math.sin(TAU * 2 * k);
      const g2 = Math.sin(TAU * 2 * k + 1.2);
      J.shoulderR.rotation.set(-0.5 - 0.16 * g, 0.3, -0.36 - 0.1 * g2);
      J.elbowR.rotation.set(-1.25 - 0.3 * g2, 0, 0);
      J.wristR.rotation.set(-0.2, -1.2, 0.3 + 0.2 * g);
      grip.R = 0.05;
      if (!opts.sitting) armRest('L');
      chest.rotation.y += -0.08 + 0.04 * g;
      head.rotation.set(0.05 + 0.07 * Math.sin(TAU * 3 * k), 0.08, 0.03 * g2);
      mouthOpen = Math.max(0, Math.sin(TAU * 7 * k)) * (0.6 + 0.4 * Math.sin(TAU * 3 * k) ** 2);
    },

    listen(k, opts) {
      if (!opts.sitting) {
        standLower(-0.4);
        armRest('R');
        armRest('L');
      }
      const nod = Math.sin(PI * ss(0.25, 0.75, k)) ** 2; // one slow nod
      neck.rotation.x = 0.04;
      head.rotation.set(0.04 + 0.16 * nod, -0.05, 0.16);
      spine.rotation.x += 0.03;
    },

    wait(k) {
      standLower(1, 0.01);
      // arms folded; the left wrist comes out for a glance at the watch
      const glance = ss(0.38, 0.52, k) * (1 - ss(0.78, 0.92, k));
      reach('R', atChest(C.foldR), 1, FOLD.R);
      reach('L', atChest(_v.copy(C.foldL).lerp(C.watch, glance)), 1, FOLD.L);
      J.wristL.rotation.y = -1.3 * glance;
      grip.R = 0.5;
      grip.L = 0.5 * (1 - glance);
      breath(k, 1);
      neck.rotation.x = 0.12 * glance;
      head.rotation.set(0.02 + 0.32 * glance, 0.12 * glance + 0.18 * Math.sin(TAU * k) * (1 - glance), -0.06 + 0.02 * glance);
    },

    react(k) {
      const inhale = ss(0, 0.32, k);
      const exhale = ss(0.32, 0.66, k);
      const lift = ss(0.6, 0.95, k);
      const rise = inhale - 1.35 * exhale + 0.35 * lift; // shoulders: up, then a sigh below rest, then settle
      standLower(0, 0.025 * exhale * (1 - lift));
      J.shoulderR.position.y += 0.05 * rise;
      J.shoulderL.position.y += 0.05 * rise;
      chestMesh.scale.set(
        chestMesh.userData.base.x * (1 + 0.04 * inhale - 0.04 * exhale),
        chestMesh.userData.base.y * (1 + 0.03 * inhale - 0.03 * exhale),
        chestMesh.userData.base.z * (1 + 0.1 * inhale - 0.1 * exhale),
      );
      spine.rotation.x = -0.06 * inhale + 0.12 * exhale - 0.08 * lift;
      chest.rotation.x = -0.05 * inhale + 0.1 * exhale - 0.06 * lift;
      armRest('R');
      armRest('L');
      J.shoulderR.rotation.z -= 0.12 * inhale * (1 - exhale);
      J.shoulderL.rotation.z += 0.12 * inhale * (1 - exhale);
      J.elbowR.rotation.x -= 0.25 * inhale * (1 - exhale);
      J.elbowL.rotation.x -= 0.25 * inhale * (1 - exhale);
      neck.rotation.x = 0.05 * exhale - 0.08 * lift;
      head.rotation.set(-0.15 * inhale + 0.35 * exhale - 0.5 * lift, 0, 0.05 * lift);
      mouthOpen = 0.55 * Math.sin(PI * ss(0.3, 0.6, k)); // the breath out
    },
  };

  function giveOrPlace(k, opts, target, lean) {
    const out = k < 0.5 ? ss(0.04, 0.5, k) : 1 - ss(0.55, 1, k); // reach .. back
    standLower(0, 0.02 * out);
    spine.rotation.x = lean * 0.6 * out;
    chest.rotation.x = lean * 0.4 * out;
    head.rotation.x = 0.1 * out + (target.y < 1 ? 0.2 * out : 0);
    const hold = atChest(C.hold);
    if (k <= 0.5) reach('R', hold.lerp(target, ss(0.04, 0.5, k)), 1);
    else reach('R', _v.copy(target).lerp(hold, ss(0.55, 0.85, k)).clone(), 1 - ss(0.62, 1, k));
    grip.R = k < 0.5 ? 1 : lerp(1, 0.2, ss(0.5, 0.6, k));
    armRest('L');
  }

  function finish() {
    // fingers curl with the grip
    fingers.R.rotation.z = lerp(0.1, 1.45, grip.R);
    fingers.L.rotation.z = -lerp(0.1, 1.45, grip.L);
    // the palm point keeps carried things upright (or as the action tilts them)
    chainQuat(J.wristR, _q).invert();
    hand.quaternion.copy(_q);
    if (handTilt) hand.quaternion.multiply(handTilt);
    applyFace();
  }

  // ---- face -----------------------------------------------------------------------------
  const FACES = {
    //          brow lift, inner brow tilt, eye open, mouth: [kind, width, depth]
    neutral: { lift: 0, tilt: 0, eye: 1, mouth: ['smile', 0.85, 0.3] },
    curious: { lift: 0.011, tilt: -0.08, eye: 1.12, mouth: ['flat', 0.65, 0], asym: 0.006 },
    worried: { lift: 0.004, tilt: 0.42, eye: 0.95, mouth: ['frown', 0.8, 0.55] },
    relieved: { lift: 0.002, tilt: 0.12, eye: 0.62, mouth: ['smile', 0.95, 0.65] },
    smile: { lift: 0.006, tilt: -0.05, eye: 0.82, mouth: ['smile', 1.1, 1.0] },
  };
  let expression = 'neutral';
  function applyFace() {
    const f = FACES[expression];
    for (const { g, side } of brows) {
      g.position.y = 0.06 + f.lift + (f.asym && side > 0 ? f.asym : 0);
      // inner end up = worried; brows sit at +-x, the inner end faces the nose
      g.rotation.z = -side * f.tilt;
    }
    for (const e of eyes) e.scale.set(1, f.eye, 1);
    const [kind, w, depth] = f.mouth;
    const talking = mouthOpen > 0.04;
    smileG.visible = !talking && kind === 'smile';
    frownG.visible = !talking && kind === 'frown';
    flat.visible = !talking && kind === 'flat';
    open.visible = talking;
    smileG.scale.set(w, depth, 1);
    frownG.scale.set(w, depth, 1);
    flat.scale.set(1, w, 1);
    open.scale.set(lerp(0.8, 1.1, mouthOpen) * (kind === 'smile' ? 1.1 : 0.9), 0.25 + 0.75 * mouthOpen, 0.35);
  }

  function pose(action, k = 0, opts = {}) {
    if (action === 'use') action = 'read'; // the clay figure has no "use": both hands up at the thing reads close enough
    const fn = ACT[action];
    if (!fn) throw new Error(`character: unknown action "${action}" (known: ${ACTIONS.join(', ')})`);
    reset();
    k = clamp01(Number.isFinite(k) ? k : 0);
    if (opts.sitting && action !== 'sit') ACT.sit(1); // seated legs, hands on knees; the action overrides the rest
    fn(k, opts);
    finish();
  }

  function setExpression(name) {
    if (!EXPRESSIONS.includes(name)) throw new Error(`character: unknown expression "${name}" (known: ${EXPRESSIONS.join(', ')})`);
    expression = name;
    applyFace();
  }

  pose('idle', 0);
  return {
    object,
    height: 1.75,
    hand,
    joints: J,
    /** Where a seat should be for 'sit', in character space: top surface height and centre. */
    seat: { y: SEAT_Y, z: -0.32 },
    pose,
    setExpression,
  };
}
