// Human: the film's people. Rigged, motion-captured adults in real clothes.
//
// Bodies, hairstyles and motion are Quaternius's CC0 "Universal Base Characters" and "Universal
// Animation Library" (one shared UE-mannequin skeleton), packed by scripts/build-humans.mjs into
// engine/assets/*.glb. The clothes are grown from the body at load time (cast/wardrobe.js).
//
//   await loadHumans();                  // once: reads the assets (embedded in the page, or fetched)
//   const h = build({ tint: '#2a9d8f' }); // then synchronous
//   h.pose('walk', 0.3, { cycles: 2 });   // pure: same arguments, same pose, whatever came before
//
// build(opts)
//   body      'male' | 'female'                      (default 'male')
//   skin      skin colour, e.g. '#c99878'             (default a light tone)
//   hair      hair colour                              (default '#3a2e28')
//   hairStyle 'SimpleParted' | 'Buzzed' | 'Long' | 'Buns' | 'BuzzedFemale' | 'none'
//             (default: SimpleParted for male, Buns for female); beard: true adds a beard
//   tint      the film's accent colour; recipes may use the word 'tint' for a colour
//   outfit    'casual' | 'smart' | 'scrubs' | a recipe | { preset: 'smart', ...overrides }
//
// An outfit recipe (every field optional; colours are CSS colours or 'tint'):
//   top:    { kind: 'shirt' | 'jumper' | 'tee' | 'scrubs',
//             colour,
//             sleeve: 0..1     0 = short sleeve, 1 = to the wrist,
//             neck: 'collar' | 'crew' | 'v',
//             tucked: boolean  (shirts are tucked in by default),
//             buttoned: boolean (a collared shirt done up to the collar; otherwise one button open),
//             trim: colour     (piping at the neck and cuffs, e.g. NHS tunics),
//           }
//   jacket: { colour }         a blazer over the top: open front, lapels, hip length
//   bottom: { kind: 'trousers', colour, fit: 'straight' | 'loose' }
//   belt:   colour             (with a tucked top)
//   tie:    colour | null      (buttons the collar; the smart preset gives the male body a tie)
//   shoes:  { colour, sole }
//   badge:  { image: url,      an ID card on the chest (data: or blob: URL in offline pages),
//             card: colour,    the card's colour when there is no image,
//             lanyard: colour  hang it from a lanyard round the neck instead of clipping it on }
// Not available: skirts, dresses and long coats (a shell grown from the body cannot hang
// free of the legs; they need modelled garments).
//
// The returned character has the same shape as cast/character.js:
//   { object, height, hand, joints, seat: {y, z}, pose(action, k, opts), setExpression(name),
//     recipe, ready }
// Origin at the feet on y = 0, facing +Z. `hand` is in the right palm; things parented to it stay
// upright (or tilt as the action needs, e.g. a paper faces the reader).
// pose opts: cycles (walk steps across k, 0.7 m each) or distance (metres walked across k; with
// `distance` and the body moved distance * k, the planted foot does not slide: `stride` is the
// metres per walk cycle),
// sitting, target {x, y, z} (where the right hand must reach, character space),
// prev {action, k, opts} + blend (0..1, weight of this action) to crossfade from the last beat.
import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import { clone as cloneRig } from '../vendor/three/SkeletonUtils.js';
import { ACTIONS, EXPRESSIONS } from './actions.js';
import { prepareBase, resolveRecipe, dress, PRESETS } from './wardrobe.js';

export { PRESETS };
export const ASSETS = ['human-male', 'human-female', 'hair', 'moves'];
export const HAIR_STYLES = ['SimpleParted', 'Buzzed', 'Long', 'Buns', 'BuzzedFemale', 'none'];
/**
 * Metres one walk cycle (two steps) covers, measured from the clip's planted feet
 * (tests/character-check.mjs re-measures it). A walk of `distance` metres plays
 * distance / stride cycles, so the planted foot stays still on the floor.
 */
export const STRIDE = { male: 1.25, female: 1.21 };
const STEP = 0.7; // what one `cycles` step means, as the director counts them

const PI = Math.PI;
const TAU = PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const SEAT_Y = 0.45;
const SEAT_Z = -0.32;
const SOLE = 0.012; // shoes lift the body this much
const HEIGHT = { male: 1.76, female: 1.69 };

// ---- assets ---------------------------------------------------------------------------------
let LOADED = null;
let loading = null;

function decode64(s) {
  const bin = atob(s.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function bytesOf(name) {
  const el = typeof document !== 'undefined' && document.getElementById(`esd-asset-${name}`);
  if (el) return decode64(el.textContent);
  let url;
  try {
    url = new URL(`../assets/${name}.glb`, import.meta.url);
  } catch {
    // an inlined module has a data: URL: the page itself must carry the asset (export.js assetsFor)
    throw new Error(`human: this page does not carry ${name}.glb (build it with toHtml(..., { assets }))`);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`human: could not load ${name}.glb (${res.status})`);
  return res.arrayBuffer();
}

const parse = (loader, buf) => new Promise((res, rej) => loader.parse(buf, '', res, rej));

/** Load and prepare the bodies, hair and motion once. After it resolves, build() is synchronous. */
export function loadHumans() {
  if (LOADED) return Promise.resolve(LOADED);
  if (!loading) loading = load().then((x) => (LOADED = x));
  return loading;
}
export const humansReady = () => !!LOADED;

async function load() {
  const loader = new GLTFLoader();
  const [male, female, hair, moves] = await Promise.all(ASSETS.map(async (n) => parse(loader, await bytesOf(n))));
  moves.scene.updateMatrixWorld(true);
  const animPelvis = moves.scene.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3()).y;
  const bases = {};
  for (const [sex, gltf] of [['male', male], ['female', female]]) bases[sex] = prepare(sex, gltf, moves.animations, animPelvis);
  const hairs = {};
  for (const m of hair.scene.children) if (m.isMesh) hairs[m.name] = m;
  return { bases, hairs };
}

function prepare(sex, gltf, animations, animPelvis) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const body = scene.getObjectByName('Body');
  const W = prepareBase(body, sex);
  const bones = body.skeleton.bones;
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  const bindQ = (n) => new THREE.Quaternion().setFromRotationMatrix(W.bind[W.names.indexOf(n)]);
  const bindP = (n) => new THREE.Vector3().setFromMatrixPosition(W.bind[W.names.indexOf(n)]);
  const toLocal = (n, p) => p.clone().applyMatrix4(body.skeleton.boneInverses[W.names.indexOf(n)]);

  // eyebrows become two rigid pieces on the head (so an expression can lift and tilt them)
  const browMesh = scene.getObjectByName('Eyebrows');
  const brows = [];
  if (browMesh) {
    const g = browMesh.geometry;
    const head = W.names.indexOf('Head');
    const inv = body.skeleton.boneInverses[head];
    const p = g.attributes.position;
    for (const side of [-1, 1]) {
      const pts = [];
      const idx = [];
      const map = new Map();
      for (let t = 0; t < g.index.count; t += 3) {
        const tri = [g.index.getX(t), g.index.getX(t + 1), g.index.getX(t + 2)];
        if (Math.sign(p.getX(tri[0]) || 1) !== side) continue;
        for (const i of tri) {
          if (!map.has(i)) {
            map.set(i, pts.length);
            pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(inv));
          }
          idx.push(map.get(i));
        }
      }
      if (!pts.length) continue;
      const pivot = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map((q) => q.clone().sub(pivot)));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      brows.push({ side, geo, pivot });
    }
    browMesh.removeFromParent();
  }

  // motion: the pelvis travels in proportion to this body's legs
  const ratio = W.LM.pelvis.y / animPelvis;
  const clips = {};
  for (const c of animations) {
    const clip = c.clone();
    for (const t of clip.tracks) if (t.name === 'pelvis.position') for (let i = 0; i < t.values.length; i++) t.values[i] *= ratio;
    // one interpolant per track; evaluated directly (see pose())
    clips[clip.name] = {
      duration: clip.duration,
      tracks: clip.tracks.map((t) => {
        const [bone, prop] = t.name.split('.');
        return { bone, quat: prop === 'quaternion', interp: t.createInterpolant() };
      }),
    };
  }

  // the palm point and the finger bend axes, from the bind pose (T-pose, palms down)
  const palm = {};
  const curlAxis = {};
  for (const s of ['r', 'l']) {
    const mid = bindP(`middle_01_${s}`);
    const wrist = bindP(`hand_${s}`);
    palm[s] = toLocal(`hand_${s}`, wrist.clone().lerp(mid, 0.55).add(new THREE.Vector3(0, -0.03, 0.005)));
    // the fingers point along -X (right) / +X (left); curling them toward the palm turns about ±Z
    const worldAxis = new THREE.Vector3(0, 0, s === 'r' ? 1 : -1);
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
      for (const j of [1, 2, 3]) {
        const n = `${f}_0${j}_${s}`;
        if (!byName[n]) continue;
        curlAxis[n] = worldAxis.clone().applyQuaternion(bindQ(n).invert());
      }
    }
  }
  // sole points (heel, toe) in the foot bones' space, for planting the feet
  const soles = [];
  for (const s of ['r', 'l']) {
    const foot = bindP(`foot_${s}`);
    const ball = bindP(`ball_${s}`);
    soles.push({ bone: `foot_${s}`, p: toLocal(`foot_${s}`, new THREE.Vector3(foot.x, 0.0, foot.z - 0.04)) });
    soles.push({ bone: `ball_${s}`, p: toLocal(`ball_${s}`, new THREE.Vector3(ball.x, 0.0, ball.z + 0.07)) });
    soles.push({ bone: `ball_${s}`, p: toLocal(`ball_${s}`, new THREE.Vector3(ball.x, 0.0, ball.z)) });
  }
  const height = W.LM.Head.y + (sex === 'male' ? 0.21 : 0.217); // crown of the head
  const headInv = bindQ('Head').invert();
  const headUp = new THREE.Vector3(0, 1, 0).applyQuaternion(headInv);
  const headFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(headInv);
  return { sex, scene, body, W, clips, brows, palm, curlAxis, soles, headUp, headFwd, scale: HEIGHT[sex] / height, bindQ, bindP };
}

// ---- materials --------------------------------------------------------------------------------
const colour = (c) => new THREE.Color(c);
function fabric(c, { rough = 0.88, sheen = 0.6 } = {}) {
  const col = colour(c);
  return new THREE.MeshPhysicalMaterial({
    color: col,
    roughness: rough,
    metalness: 0,
    sheen,
    sheenRoughness: 0.75,
    sheenColor: col.clone().lerp(new THREE.Color('#ffffff'), 0.35),
  });
}

// mean colour of the skin texture on the face and hands, measured once: material colour =
// wanted tone / this, so the texture's freckles, lips and shading stay while the tone is any colour
const SKIN_MEAN = { male: new THREE.Color(0.80, 0.56, 0.42), female: new THREE.Color(0.82, 0.58, 0.45) };
const HAIR_MEAN = new THREE.Color(0.42, 0.29, 0.2);
function tone(target, mean) {
  const t = colour(target);
  return new THREE.Color(t.r / mean.r, t.g / mean.g, t.b / mean.b);
}

// ---- build ---------------------------------------------------------------------------------------
/**
 * @param {{body?: 'male'|'female', tint?: string, skin?: string, hair?: string, hairStyle?: string, beard?: boolean, outfit?: any}} [opts]
 */
export default function build(opts = {}) {
  if (!LOADED) throw new Error('human: call `await loadHumans()` before build()');
  const sex = opts.body === 'female' ? 'female' : 'male';
  const B = LOADED.bases[sex];
  const tint = opts.tint || '#5b7fb0';
  const recipe = resolveRecipe(opts.outfit || 'casual', tint, sex);
  const kit = dress(B.W, recipe);

  const object = new THREE.Group();
  object.name = 'human';
  const rig = cloneRig(B.scene);
  rig.name = 'rig';
  rig.scale.setScalar(B.scale);
  object.add(rig);
  const J = {};
  let body = null;
  rig.traverse((o) => {
    if (o.isBone) J[o.name] = o;
    if (o.isSkinnedMesh && o.name === 'Body') body = o;
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // the body only where the clothes leave it showing
  if (!kit.bodyGeometry) {
    const g = new THREE.BufferGeometry();
    for (const [k, v] of Object.entries(B.body.geometry.attributes)) g.setAttribute(k, v);
    g.setIndex(kit.bodyIndex);
    g.boundingSphere = B.body.geometry.boundingSphere;
    kit.bodyGeometry = g;
  }
  body.geometry = kit.bodyGeometry;
  const skinMat = body.material.clone();
  skinMat.color = tone(opts.skin || '#e0b896', SKIN_MEAN[sex]);
  skinMat.roughness = 0.6;
  skinMat.normalScale = new THREE.Vector2(0.6, 0.6);
  body.material = skinMat;

  // clothes: skinned to the same skeleton
  const col = {
    top: recipe.top.colour,
    collar: recipe.top.colour,
    trim: recipe.top.trim || recipe.top.colour,
    tie: recipe.tie,
    lapels: recipe.jacket?.colour,
    bottom: recipe.bottom.colour,
    belt: recipe.belt || '#2a211c',
    jacket: recipe.jacket?.colour,
    shoes: recipe.shoes.colour,
    sole: recipe.shoes.sole,
  };
  for (const part of kit.parts) {
    if (!part.geometry.attributes.position) continue;
    const c = col[part.name] ?? col.top;
    const leather = part.name === 'shoes' || part.name === 'belt';
    const mat = fabric(c, leather ? { rough: 0.5, sheen: 0.1 } : part.name === 'sole' ? { rough: 0.8, sheen: 0 } : part.name === 'tie' ? { rough: 0.45, sheen: 0.35 } : {});
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.SkinnedMesh(part.geometry, mat);
    mesh.name = part.name;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.parent.add(mesh);
    mesh.bind(body.skeleton, body.bindMatrix);
  }

  // hair and brows ride on the head
  const hairCol = opts.hair || '#3a2e28';
  const style = opts.hairStyle || (sex === 'male' ? 'SimpleParted' : 'Buns');
  const hairPieces = [style, opts.beard ? 'Beard' : null].filter((s) => s && s !== 'none');
  for (const s of hairPieces) {
    const src = LOADED.hairs[s];
    if (!src) throw new Error(`human: unknown hair style "${s}" (known: ${HAIR_STYLES.join(', ')})`);
    const m = new THREE.Mesh(src.geometry, src.material.clone());
    m.material.color = tone(hairCol, HAIR_MEAN);
    m.material.roughness = 0.75;
    m.castShadow = true;
    J.Head.add(m);
  }
  const browMat = new THREE.MeshStandardMaterial({ color: colour(hairCol).multiplyScalar(0.8), roughness: 0.9 });
  const brows = B.brows.map(({ side, geo, pivot }) => {
    const m = new THREE.Mesh(geo, browMat);
    m.position.copy(pivot);
    J.Head.add(m);
    return { side, mesh: m, pivot };
  });

  // badge on the chest (optional)
  let ready = Promise.resolve();
  if (recipe.badge) ready = addBadge(J, B, recipe.badge, kit);

  // the right-hand anchor: carried things go here
  const hand = new THREE.Object3D();
  hand.name = 'hand';
  hand.position.copy(B.palm.r);
  J.hand_r.add(hand);
  const handScale = 1 / B.scale;
  hand.scale.setScalar(handScale);

  const joints = { ...J, hips: J.pelvis, spine: J.spine_01, chest: J.spine_03, neck: J.neck_01, head: J.Head, shoulderR: J.upperarm_r, shoulderL: J.upperarm_l, elbowR: J.lowerarm_r, elbowL: J.lowerarm_l, wristR: J.hand_r, wristL: J.hand_l, hipR: J.thigh_r, hipL: J.thigh_l, kneeR: J.calf_r, kneeL: J.calf_l, ankleR: J.foot_r, ankleL: J.foot_l };

  const rest = Object.values(J).map((b) => ({ b, p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
  const rigRest = rig.position.clone();
  const motion = createMotion({ B, J, rig, object, rest, rigRest, hand, brows });

  const me = {
    object,
    height: 0,
    hand,
    joints,
    seat: { y: SEAT_Y, z: SEAT_Z },
    stride: STRIDE[sex],
    recipe,
    ready,
    pose: motion.pose,
    setExpression: motion.setExpression,
  };
  motion.pose('idle', 0);
  object.updateMatrixWorld(true);
  me.height = +new THREE.Box3().setFromObject(object, true).max.y.toFixed(3);
  return me;
}

function addBadge(J, B, badge, kit) {
  // an ID card on the left chest (clipped on) or hanging from a lanyard round the neck
  const top = kit.parts.find((p) => p.name === 'jacket') || kit.parts.find((p) => p.name === 'top');
  const S = top.S;
  const LM = B.W.LM;
  const want = badge.lanyard ? new THREE.Vector3(0.0, LM.neck_01.y - 0.25, 0.3) : new THREE.Vector3(0.09, LM.spine_03.y + 0.05, 0.3);
  // the cloth point in front of `want`
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < S.count; i++) {
    if (S.b[i * 3 + 2] < 0) continue;
    const d = Math.hypot(S.pos[i * 3] - want.x, S.pos[i * 3 + 1] - want.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  const p = new THREE.Vector3(S.pos[best * 3], S.pos[best * 3 + 1], S.pos[best * 3 + 2] + 0.006);
  const chest = J.spine_03;
  const inv = B.body.skeleton.boneInverses[B.W.names.indexOf('spine_03')];
  const card = new THREE.Group();
  card.position.copy(p.clone().applyMatrix4(inv));
  card.quaternion.copy(B.bindQ('spine_03').invert());
  const w = 0.055, h = 0.085;
  const mat = new THREE.MeshStandardMaterial({ color: badge.card || '#ffffff', roughness: 0.4 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.003), mat);
  plate.rotation.x = -0.12;
  card.add(plate);
  let ready = Promise.resolve();
  if (badge.image) {
    const face = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.92), face);
    quad.position.z = 0.0017;
    plate.add(quad);
    ready = new THREE.TextureLoader()
      .loadAsync(badge.image)
      .then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        face.map = t;
        face.needsUpdate = true;
      })
      .catch(() => {});
  } else {
    // a plain card: a coloured band and a photo square
    const band = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.22), new THREE.MeshStandardMaterial({ color: badge.lanyard || '#1d3f8a', roughness: 0.5 }));
    band.position.set(0, h * 0.39, 0.0017);
    plate.add(band);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.36, h * 0.3), new THREE.MeshStandardMaterial({ color: '#9aa7b6', roughness: 0.6 }));
    photo.position.set(-w * 0.22, h * 0.05, 0.0017);
    plate.add(photo);
  }
  if (badge.lanyard) {
    // the cord: two strands from behind the neck down to the card's clip
    const lm = new THREE.MeshStandardMaterial({ color: badge.lanyard, roughness: 0.8 });
    const neckP = LM.neck_01.clone();
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(s * 0.055, neckP.y - 0.02, neckP.z + 0.06);
      const b = new THREE.Vector3(s * 0.012, p.y + h / 2, p.z - 0.004);
      const len = a.distanceTo(b);
      const cord = new THREE.Mesh(new THREE.BoxGeometry(0.012, len, 0.002), lm);
      cord.position.copy(a.clone().add(b).multiplyScalar(0.5).applyMatrix4(inv));
      const dir = b.clone().sub(a).normalize().applyQuaternion(B.bindQ('spine_03').invert());
      cord.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      chest.add(cord);
    }
  }
  chest.add(card);
  return ready;
}

// ---- motion -------------------------------------------------------------------------------------
function createMotion({ B, J, rig, object, rest, rigRest, hand, brows }) {
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const bones = Object.values(J);
  const restOf = new Map(rest.map((r) => [r.b, r]));
  let expression = 'neutral';
  let last = null;

  function reset() {
    for (const r of rest) {
      r.b.position.copy(r.p);
      r.b.quaternion.copy(r.q);
      r.b.scale.copy(r.s);
    }
    rig.position.copy(rigRest);
  }

  // sample a weighted set of clips straight from their keyframes and blend them
  const accQ = {};
  const accP = {};
  function sample(layers) {
    for (const k in accQ) delete accQ[k];
    for (const k in accP) delete accP[k];
    for (const { clip, t, w } of layers) {
      if (w <= 0) continue;
      const c = B.clips[clip];
      const time = ((t % c.duration) + c.duration) % c.duration;
      for (const tr of c.tracks) {
        const r = tr.interp.evaluate(time);
        if (tr.quat) {
          let a = accQ[tr.bone];
          if (!a) a = accQ[tr.bone] = [0, 0, 0, 0];
          const sgn = a[0] * r[0] + a[1] * r[1] + a[2] * r[2] + a[3] * r[3] < 0 ? -1 : 1;
          for (let i = 0; i < 4; i++) a[i] += r[i] * w * sgn;
        } else {
          let a = accP[tr.bone];
          if (!a) a = accP[tr.bone] = [0, 0, 0, 0];
          for (let i = 0; i < 3; i++) a[i] += r[i] * w;
          a[3] += w;
        }
      }
    }
    for (const n in accQ) if (J[n]) J[n].quaternion.fromArray(accQ[n]).normalize();
    for (const n in accP) if (J[n]) J[n].position.set(accP[n][0] / accP[n][3], accP[n][1] / accP[n][3], accP[n][2] / accP[n][3]);
  }

  const update = () => object.updateMatrixWorld(true);
  const wpos = (b, out = new THREE.Vector3()) => b.getWorldPosition(out);
  /** a point in character space → world */
  const charToWorld = (p, out = new THREE.Vector3()) => out.copy(p).applyMatrix4(object.matrixWorld);
  const worldToChar = (p, out = new THREE.Vector3()) => out.copy(p).applyMatrix4(q2Inv(object.matrixWorld));
  const _m = new THREE.Matrix4();
  const q2Inv = (m) => _m.copy(m).invert();
  /** an axis in character space → world */
  const objQ = new THREE.Quaternion();
  const charAxis = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z).applyQuaternion(object.getWorldQuaternion(objQ));

  /** rotate a bone about an axis given in character space, in its parent's frame */
  function turn(b, ax, ay, az, angle) {
    if (!angle) return;
    const axis = charAxis(ax, ay, az, v4);
    b.parent.getWorldQuaternion(q1);
    axis.applyQuaternion(q1.invert());
    q2.setFromAxisAngle(axis.normalize(), angle);
    b.quaternion.premultiply(q2);
  }

  /** rotate bone b (about its own origin) so that world point `from` moves toward `to` */
  function aim(b, from, to) {
    const pivot = wpos(b, v3);
    const a = from.clone().sub(pivot).normalize();
    const c = to.clone().sub(pivot).normalize();
    if (a.lengthSq() < 1e-9 || c.lengthSq() < 1e-9) return;
    q2.setFromUnitVectors(a, c);
    b.getWorldQuaternion(q1);
    q1.premultiply(q2);
    b.parent.getWorldQuaternion(objQ);
    b.quaternion.copy(objQ.invert().multiply(q1));
    b.updateMatrixWorld(true);
  }

  /** two-bone IK: end of (upper → lower → end) to `target`, the middle joint bending toward `pole` (world) */
  function ik(upper, lower, end, target, pole, w = 1, endOffset = null) {
    if (w <= 0) return;
    update();
    const A = wpos(upper, new THREE.Vector3());
    const Bp = wpos(lower, new THREE.Vector3());
    const C = endOffset ? end.localToWorld(endOffset.clone()) : wpos(end, new THREE.Vector3());
    const T = C.clone().lerp(target, w);
    const la = A.distanceTo(Bp);
    const lb = Bp.distanceTo(C);
    const dir = T.clone().sub(A);
    const d = Math.min(Math.max(dir.length(), Math.abs(la - lb) + 1e-3), la + lb - 1e-4);
    dir.normalize();
    const pv = pole.clone().sub(A);
    pv.addScaledVector(dir, -pv.dot(dir));
    if (pv.lengthSq() < 1e-8) pv.copy(Bp).sub(A).addScaledVector(dir, -Bp.clone().sub(A).dot(dir));
    pv.normalize();
    const cosA = (la * la + d * d - lb * lb) / (2 * la * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const Bn = A.clone().addScaledVector(dir, la * cosA).addScaledVector(pv, la * sinA);
    aim(upper, Bp, Bn);
    const C2 = endOffset ? end.localToWorld(endOffset.clone()) : wpos(end, new THREE.Vector3());
    aim(lower, C2, A.clone().addScaledVector(dir, d));
  }

  /** the hand's world rotation for fingers pointing along `finger` with the palm facing `palm` (character space) */
  const handBind = { r: B.bindQ('hand_r'), l: B.bindQ('hand_l') };
  function handQuat(s, finger, palm) {
    const f0 = new THREE.Vector3(s === 'r' ? -1 : 1, 0, 0);
    const p0 = new THREE.Vector3(0, -1, 0);
    const m0 = new THREE.Matrix4().makeBasis(f0, p0, f0.clone().cross(p0));
    const f = charAxis(finger.x, finger.y, finger.z, new THREE.Vector3()).normalize();
    const p = charAxis(palm.x, palm.y, palm.z, new THREE.Vector3());
    p.addScaledVector(f, -p.dot(f)).normalize();
    const m1 = new THREE.Matrix4().makeBasis(f, p, f.clone().cross(p));
    // rotation that takes the bind (T-pose) hand to the wanted one, applied to the bind rotation
    return new THREE.Quaternion().setFromRotationMatrix(m1.multiply(m0.transpose())).multiply(handBind[s]);
  }
  function setHand(s, want, w = 1) {
    const b = J[`hand_${s}`];
    b.getWorldQuaternion(q2);
    q2.slerp(want, w);
    b.parent.getWorldQuaternion(q1);
    b.quaternion.copy(q1.invert().multiply(q2));
    b.updateMatrixWorld(true);
  }

  /** fingers: 0 relaxed and slightly open .. 1 a closed grip; w blends from the clip's own fingers */
  function fingers(s, grip, w = 1) {
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
      for (const j of [1, 2, 3]) {
        const n = `${f}_0${j}_${s}`;
        const b = J[n];
        if (!b) continue;
        const r = restOf.get(b);
        const amt = f === 'thumb' ? (j === 1 ? 0.15 + 0.3 * grip : 0.1 + 0.4 * grip) : (j === 1 ? 0.25 : 0.3) + (j === 1 ? 0.9 : 1.0) * grip;
        q2.setFromAxisAngle(B.curlAxis[n], amt);
        q1.copy(r.q).multiply(q2);
        b.quaternion.slerp(q1, w);
      }
    }
  }

  // points that travel with the chest: given in character space at rest, carried by spine_03
  const chestRestInv = new THREE.Matrix4();
  const chestRest = new THREE.Vector3();
  /** a point offset (x, y, z) from the chest, in character axes at rest, carried by the chest as it moves */
  const atChest = (x, y, z) => new THREE.Vector3(x, y, z).add(chestRest).applyMatrix4(chestRestInv).applyMatrix4(J.spine_03.matrixWorld);

  /** lift the rig so the lowest sole point is on the floor */
  function ground(extra = []) {
    update();
    let min = Infinity;
    for (const s of B.soles) {
      const p = worldToChar(J[s.bone].localToWorld(v1.copy(s.p)), v2);
      min = Math.min(min, p.y);
    }
    for (const [b, r] of extra) min = Math.min(min, worldToChar(wpos(J[b], v1), v2).y - r);
    rig.position.y += SOLE - min;
    update();
  }

  /**
   * Bring the feet in under the hips (the clips stand with a wide, superhero stance): each ankle
   * moves toward the hip line by `amt`, the hips rise just enough to keep the knee bend, and the
   * feet keep their angle on the floor.
   */
  function narrowStance(amt) {
    if (amt <= 0) return;
    update();
    const legs = ['r', 'l'].map((s) => {
      const hip = worldToChar(wpos(J[`thigh_${s}`], v1), new THREE.Vector3());
      const ankle = worldToChar(wpos(J[`foot_${s}`], v1), new THREE.Vector3());
      const want = ankle.clone();
      want.x = lerp(ankle.x, hip.x * 0.98, amt); // feet about hip width apart
      const v = ankle.clone().sub(hip);
      const len = v.length();
      const dx = want.x - hip.x;
      const rise = Math.sqrt(Math.max(0, len * len - dx * dx - v.z * v.z)) - Math.abs(v.y);
      return { s, want, rise };
    });
    rig.position.y += Math.min(legs[0].rise, legs[1].rise);
    update();
    for (const { s, want } of legs) {
      const foot = J[`foot_${s}`];
      const fq = foot.getWorldQuaternion(new THREE.Quaternion());
      ik(J[`thigh_${s}`], J[`calf_${s}`], foot, charToWorld(want, new THREE.Vector3()), poleLeg(s), 1);
      foot.parent.getWorldQuaternion(q1);
      foot.quaternion.copy(q1.invert().multiply(fq));
    }
    update();
  }

  /** bring the arms in toward the body (the clips stand like superheroes) */
  function armsIn(amt = 1, lower = 0.12) {
    turn(J.upperarm_r, 0, 0, 1, 0.1 * amt);
    turn(J.upperarm_l, 0, 0, 1, -0.1 * amt);
    turn(J.lowerarm_r, 0, 0, 1, lower * amt);
    turn(J.lowerarm_l, 0, 0, 1, -lower * amt);
  }

  const restTarget = { R: new THREE.Vector3(-0.22, 0.82, 0.04), L: new THREE.Vector3(0.22, 0.82, 0.04) };
  const T = {
    floor: new THREE.Vector3(-0.1, 0.1, 0.4),
    give: new THREE.Vector3(-0.1, 1.12, 0.47),
    place: new THREE.Vector3(-0.1, 0.95, 0.46),
  };
  // elbow poles in character space: out to the side and behind
  const poleArm = (s, back = 1) => charToWorld(new THREE.Vector3(s === 'r' ? -0.6 : 0.6, -0.2, -0.6 * back).add(worldToChar(wpos(J[`upperarm_${s}`], v1), v2)), new THREE.Vector3());
  const poleLeg = (s) => charToWorld(new THREE.Vector3(s === 'r' ? -0.05 : 0.05, 0, 1).add(worldToChar(wpos(J[`thigh_${s}`], v1), v2)), new THREE.Vector3());
  const palmOff = { r: B.palm.r, l: B.palm.l };
  /**
   * Put the palm point of hand `s` on `targetChar` (character space). `orient` = [finger, palm]
   * directions: the hand takes that angle and the wrist goes where the palm lands on the target.
   * `lean` (0..1) lets the shoulder come forward and the back bend when the target is too far.
   */
  function reach(s, targetChar, w = 1, back = 1, orient = null, lean = 0) {
    if (w <= 0) return;
    const hb = J[`hand_${s}`];
    const upper = J[`upperarm_${s}`], lower = J[`lowerarm_${s}`];
    if (!orient) {
      if (lean > 0) leanToReach(s, targetChar, w * lean, armLength(s));
      return ik(upper, lower, hb, charToWorld(targetChar, new THREE.Vector3()), poleArm(s, back), w, palmOff[s]);
    }
    // the wrist goes where the turned hand puts the palm point on the target
    const want = handQuat(s, orient[0], orient[1]);
    const off = palmOff[s].clone().multiply(hb.getWorldScale(new THREE.Vector3())).applyQuaternion(want);
    const wristChar = worldToChar(charToWorld(targetChar, new THREE.Vector3()).sub(off), new THREE.Vector3());
    if (lean > 0) leanToReach(s, wristChar, w * lean, armLength(s, false));
    ik(upper, lower, hb, charToWorld(wristChar, new THREE.Vector3()), poleArm(s, back), w);
    update();
    setHand(s, want, w);
  }
  const armLength = (s, palm = true) => {
    update();
    const a = wpos(J[`upperarm_${s}`], new THREE.Vector3()), b = wpos(J[`lowerarm_${s}`], new THREE.Vector3()), c = wpos(J[`hand_${s}`], new THREE.Vector3());
    return a.distanceTo(b) + b.distanceTo(c) + (palm ? palmOff[s].length() * J[`hand_${s}`].getWorldScale(v4).x : 0);
  };
  const palmAt = (s) => worldToChar(J[`hand_${s}`].localToWorld(palmOff[s].clone()), new THREE.Vector3());

  // ---- clip timing ----
  const D = (n) => B.clips[n].duration;
  const loopT = (n, k, cycles = 1) => k * cycles * D(n);

  let handTilt = null;
  let grip = { r: 0.3, l: 0.3 };

  /** the seated lower body: hips over the seat, feet on the floor in front */
  function seatLower(k = 1) {
    update();
    const pelvisNow = worldToChar(wpos(J.pelvis, v1), new THREE.Vector3());
    // where the clip has the hips relative to the feet doesn't matter: put them on the seat
    const hipY = SEAT_Y + 0.075 * B.scale;
    const want = new THREE.Vector3(0, hipY + (B.W.LM.pelvis.y - B.W.LM.thigh_r.y) * B.scale, SEAT_Z + 0.02);
    const e = ss(0, 1, k);
    const d = want.sub(pelvisNow).multiplyScalar(e);
    rig.position.add(d);
    update();
    plantFeet(e);
  }
  /** feet on the floor where the seated knees put them */
  function plantFeet(w = 1) {
    for (const s of ['r', 'l']) {
      const knee = worldToChar(wpos(J[`calf_${s}`], v1), new THREE.Vector3());
      const foot = worldToChar(wpos(J[`foot_${s}`], v1), new THREE.Vector3());
      const ankleH = (B.W.LM.foot_r.y + SOLE) * B.scale;
      const target = new THREE.Vector3(s === 'r' ? -0.13 : 0.13, ankleH, knee.z - 0.03);
      ik(J[`thigh_${s}`], J[`calf_${s}`], J[`foot_${s}`], charToWorld(foot.lerp(target, w), new THREE.Vector3()), poleLeg(s), 1);
      // the foot flat on the floor
      update();
      const toe = J[`ball_${s}`];
      const heelW = wpos(J[`foot_${s}`], new THREE.Vector3());
      const toeW = wpos(toe, new THREE.Vector3());
      const heelC = worldToChar(heelW.clone(), new THREE.Vector3());
      const toeC = worldToChar(toeW.clone(), new THREE.Vector3());
      const flat = toeC.clone();
      flat.y = heelC.y - (B.W.LM.foot_r.y - B.W.LM.ball_r.y) * B.scale;
      aim(J[`foot_${s}`], toeW, charToWorld(toeC.lerp(flat, w), new THREE.Vector3()));
    }
  }

  // ---- actions ----
  // each returns the clip layers; `after` runs once the clips are applied and the feet planted
  const ACT = {
    idle: (k) => ({ layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 }], arms: 1 }),
    walk: (k, o) => {
      const cycles = (o.distance != null ? o.distance : (o.cycles ?? 2) * STEP) / STRIDE[B.sex];
      return { layers: [{ clip: 'Walk_Formal_Loop', t: loopT('Walk_Formal_Loop', k, cycles), w: 1 }], arms: 0.4, stance: 0.35 };
    },
    talk: (k, o) => (o.sitting ? { layers: [{ clip: 'Sitting_Talking_Loop', t: loopT('Sitting_Talking_Loop', k), w: 1 }], seated: true } : { layers: [{ clip: 'Idle_Talking_Loop', t: loopT('Idle_Talking_Loop', k), w: 1 }], arms: 0.6 }),
    listen: (k, o) => ({
      ...(o.sitting ? { layers: [{ clip: 'Sitting_Idle_Loop', t: loopT('Sitting_Idle_Loop', k, 2), w: 1 }], seated: true } : { layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k) + 0.7, w: 1 }], arms: 1 }),
      after() {
        const nod = Math.sin(PI * ss(0.25, 0.75, k)) ** 2; // one slow nod
        turn(J.neck_01, 1, 0, 0, 0.05);
        turn(J.Head, 1, 0, 0, 0.04 + 0.16 * nod);
        turn(J.Head, 0, 0, 1, -0.12);
        turn(J.Head, 0, 1, 0, -0.05);
      },
    }),
    wait: (k) => ({
      layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 }],
      arms: 1,
      after() {
        // hands clasped in front; the left wrist comes up for a glance at the watch
        const glance = ss(0.38, 0.52, k) * (1 - ss(0.78, 0.92, k));
        const clasp = new THREE.Vector3(0, 0.86, 0.17);
        reach('r', clasp.clone().add(new THREE.Vector3(-0.025, 0.02, 0.0)), 1, 0.6, [new THREE.Vector3(0.7, -0.6, 0.3), new THREE.Vector3(0.6, 0.3, -0.7)]);
        reach('l', clasp.clone().add(new THREE.Vector3(0.03, 0, 0.01)).lerp(new THREE.Vector3(0.05, 1.12, 0.3), glance), 1, 0.6, [new THREE.Vector3(-0.8, -0.4 + 0.6 * glance, 0.3), new THREE.Vector3(-0.3, 0.2 + 0.6 * glance, -0.9 + 0.6 * glance)]);
        grip = { r: 0.5, l: 0.45 };
        turn(J.neck_01, 1, 0, 0, 0.12 * glance);
        turn(J.Head, 1, 0, 0, 0.3 * glance);
        turn(J.Head, 0, 1, 0, 0.2 * glance + 0.15 * Math.sin(TAU * k) * (1 - glance));
      },
    }),
    hold: (k, o) => ({
      ...(o.sitting ? { layers: [{ clip: 'Sitting_Idle_Loop', t: loopT('Sitting_Idle_Loop', k, 2), w: 1 }], seated: true } : { layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 }], arms: 1 }),
      after() {
        reach('r', worldToChar(atChest(-0.1, -0.05, 0.3), new THREE.Vector3()), 1, 0.5, [new THREE.Vector3(0.6, 0.0, 0.8), new THREE.Vector3(0.7, 0.3, -0.4)]);
        grip = { r: 0.85, l: 0.3 };
        turn(J.Head, 1, 0, 0, 0.06);
      },
    }),
    use: (k, o) => ({
      ...(o.sitting ? { layers: [{ clip: 'Sitting_Idle_Loop', t: loopT('Sitting_Idle_Loop', k, 2), w: 1 }], seated: true } : { layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 }], arms: 1 }),
      after() {
        // both hands working on the thing in hand (open it, take a sample, write on it, seal it):
        // at a spot such as the counter, or in front of the chest; small, careful movements
        const base = o.target ? new THREE.Vector3().copy(o.target).add(new THREE.Vector3(0, 0.07, -0.02)) : worldToChar(atChest(0, -0.07, 0.4), new THREE.Vector3());
        const work = Math.sin(TAU * k * 3);
        const r = base.clone().add(new THREE.Vector3(-0.045 + 0.025 * work, 0.012 * Math.cos(TAU * k * 3), 0.01 * work));
        const l = base.clone().add(new THREE.Vector3(0.06, 0.005, 0));
        const lean = o.target ? 0.6 : 0;
        reach('r', r, 1, 0.5, null, lean);
        reach('l', l, 1, 0.5, null, lean);
        grip = { r: 0.85, l: 0.6 };
        turn(J.neck_01, 1, 0, 0, 0.2);
        turn(J.Head, 1, 0, 0, 0.32 + 0.03 * work);
      },
    }),
    read: (k, o) => ({
      ...(o.sitting ? { layers: [{ clip: 'Sitting_Idle_Loop', t: loopT('Sitting_Idle_Loop', k, 2), w: 1 }], seated: true } : { layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k) + 0.4, w: 1 }], arms: 1 }),
      after() {
        // a paper held up in front of the chest with both hands, head bowed to it
        reach('r', worldToChar(atChest(-0.09, 0.0, 0.3), new THREE.Vector3()), 1, 0.5, [new THREE.Vector3(0.2, 0.9, 0.3), new THREE.Vector3(0.8, 0.0, 0.4)]);
        reach('l', worldToChar(atChest(0.11, 0.0, 0.3), new THREE.Vector3()), 1, 0.5, [new THREE.Vector3(-0.2, 0.9, 0.3), new THREE.Vector3(-0.8, 0.0, 0.4)]);
        grip = { r: 0.7, l: 0.7 };
        turn(J.neck_01, 1, 0, 0, 0.18);
        turn(J.Head, 1, 0, 0, 0.3 + 0.03 * Math.sin(TAU * k));
        handTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, PI, 0, 'XYZ'));
      },
    }),
    give: (k, o) => reachOut(k, o, o.target ? new THREE.Vector3().copy(o.target) : T.give, 0.14),
    place: (k, o) => reachOut(k, o, o.target ? new THREE.Vector3().copy(o.target) : T.place, 0.3),
    pickUp: (k, o) => {
      const target = o.target ? new THREE.Vector3().copy(o.target) : T.floor;
      // down on one knee .. a beat at the bottom .. back up
      const c = k < 0.5 ? ss(0.04, 0.44, k) : 1 - ss(0.58, 0.98, k);
      return {
        layers: [
          { clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 - c },
          { clip: 'Crouch_Idle_Loop', t: 0.6, w: c },
        ],
        arms: 1 - c,
        stance: 1 - c,
        knees: c > 0.3,
        after() {
          // the hand travels to the thing, closes on it, then brings it up to the chest
          const hold = worldToChar(atChest(-0.1, -0.05, 0.3), new THREE.Vector3());
          const start = palmAt('r');
          let tgt;
          if (k < 0.5) tgt = start.clone().lerp(target, ss(0.08, 0.46, k));
          else tgt = target.clone().lerp(hold, ss(0.55, 0.97, k));
          // palm down over the thing, then turned in to carry it; lean in if the floor is far
          const down = ss(0.1, 0.45, k) * (1 - ss(0.6, 0.9, k));
          const orient = [new THREE.Vector3(0.1, -1, 0.5).lerp(new THREE.Vector3(0.6, 0, 0.8), 1 - down), new THREE.Vector3(0.0, -0.3, -1).lerp(new THREE.Vector3(0.7, 0.3, -0.4), 1 - down)];
          // a short body kneels a little closer to a far thing (up to 10 cm), then reaches
          const before = rest.map((r) => r.b.quaternion.clone());
          reach('r', tgt, 1, 0.3, orient, Math.max(c, 0.3));
          const miss = tgt.clone().sub(palmAt('r')).setY(0);
          if (miss.length() > 0.005 && c > 0) {
            rest.forEach((r, i) => r.b.quaternion.copy(before[i]));
            rig.position.addScaledVector(miss.clampLength(0, 0.1), c);
            update();
            reach('r', tgt, 1, 0.3, orient, Math.max(c, 0.3));
          }
          grip = { r: lerp(0.25, 0.9, ss(0.42, 0.52, k)), l: 0.4 };
          turn(J.Head, 1, 0, 0, 0.3 * c - 0.1 * ss(0.6, 1, k) * c);
        },
      };
    },
    sit: (k) => ({
      layers: [
        { clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 - ss(0, 0.25, k) },
        { clip: 'Sitting_Enter', t: D('Sitting_Enter') * Math.min(0.999, k), w: ss(0, 0.25, k) * (1 - ss(0.85, 1, k)) },
        { clip: 'Sitting_Idle_Loop', t: 0, w: ss(0.85, 1, k) },
      ],
      arms: 1 - ss(0, 0.3, k),
      seated: ss(0.05, 0.9, k),
    }),
    react: (k) => ({
      layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 }],
      arms: 1,
      after() {
        // a breath in, a long sigh out, then settle: relief carried in the shoulders and chest
        const inhale = ss(0, 0.32, k);
        const exhale = ss(0.32, 0.66, k);
        const lift = ss(0.6, 0.95, k);
        const rise = inhale - 1.35 * exhale + 0.35 * lift;
        shoulders(0.06 * rise);
        turn(J.spine_02, 1, 0, 0, -0.06 * inhale + 0.1 * exhale - 0.08 * lift);
        turn(J.spine_03, 1, 0, 0, -0.05 * inhale + 0.08 * exhale - 0.05 * lift);
        turn(J.Head, 1, 0, 0, -0.15 * inhale + 0.3 * exhale - 0.4 * lift);
      },
    }),
  };

  function reachOut(k, o, target, lean) {
    const out = k < 0.5 ? ss(0.04, 0.5, k) : 1 - ss(0.55, 1, k);
    const seated = o.sitting;
    return {
      ...(seated ? { layers: [{ clip: 'Sitting_Idle_Loop', t: 0, w: 1 }], seated: true } : { layers: [{ clip: 'Idle_Loop', t: loopT('Idle_Loop', k), w: 1 }], arms: 1 }),
      after() {
        turn(J.spine_01, 1, 0, 0, lean * 0.5 * out);
        turn(J.spine_02, 1, 0, 0, lean * 0.4 * out);
        turn(J.Head, 1, 0, 0, 0.08 * out + (target.y < 1 ? 0.2 * out : 0));
        update();
        const hold = worldToChar(atChest(-0.1, -0.05, 0.3), new THREE.Vector3());
        let tgt;
        let w = 1;
        if (k <= 0.5) tgt = hold.clone().lerp(target, ss(0.04, 0.5, k));
        else {
          tgt = target.clone().lerp(hold, ss(0.55, 0.85, k));
          w = 1 - ss(0.62, 1, k);
        }
        reach('r', tgt, w, 0.4, [new THREE.Vector3(0.3, 0.1, 1), new THREE.Vector3(0.8, -0.2, 0.1)], 1);
        grip = { r: k < 0.5 ? 0.85 : lerp(0.85, 0.3, ss(0.5, 0.6, k)), l: 0.3 };
      },
    };
  }

  /** bring the shoulder forward and bend the back until hand `s` can reach `tgt` (character space) */
  function leanToReach(s, tgt, w, length) {
    const L = length * 0.985;
    let clav = 0;
    let bend = 0;
    let last = Infinity;
    for (let it = 0; it < 12; it++) {
      update();
      const sh = worldToChar(wpos(J[`upperarm_${s}`], v1), new THREE.Vector3());
      const over = sh.distanceTo(tgt) - L;
      if (over <= 0.002 || over > last - 0.0005 || bend >= 0.95) return;
      last = over;
      // the shoulder blade slides forward first (a few centimetres), then the back bends
      const c = Math.min(0.3 - clav, over / 0.16) * w;
      if (c > 0.001) {
        turn(J[`clavicle_${s}`], 0, 1, 0, s === 'r' ? c : -c);
        clav += c;
        continue;
      }
      const pel = worldToChar(wpos(J.spine_01, v1), new THREE.Vector3());
      const dir = new THREE.Vector3(tgt.x - pel.x, 0, tgt.z - pel.z);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      const axis = new THREE.Vector3(0, 1, 0).cross(dir.normalize());
      const ang = Math.min(0.5, 0.95 - bend, (over * 1.15) / Math.max(0.25, sh.distanceTo(pel))) * w;
      bend += ang;
      turn(J.spine_01, axis.x, axis.y, axis.z, ang * 0.55);
      turn(J.spine_02, axis.x, axis.y, axis.z, ang * 0.45);
    }
    update();
  }

  function shoulders(up) {
    // clavicles lift (worried, the in-breath) or drop (relief)
    turn(J.clavicle_r, 0, 0, 1, up * 1.6);
    turn(J.clavicle_l, 0, 0, 1, -up * 1.6);
  }

  // ---- expressions: posture and brows (there is no face rig) ----
  const FACE = {
    neutral: { pitch: 0, roll: 0, sh: 0, chest: 0, brow: 0, tilt: 0 },
    curious: { pitch: -0.03, roll: 0.2, sh: 0, chest: -0.02, brow: 0.006, tilt: -0.08, asym: 0.006 },
    worried: { pitch: 0.26, roll: 0, sh: 0.05, chest: 0.08, brow: 0.003, tilt: 0.45 },
    relieved: { pitch: -0.06, roll: 0.05, sh: -0.04, chest: 0.05, brow: 0.002, tilt: 0.18 },
    smile: { pitch: -0.12, roll: 0.03, sh: -0.015, chest: -0.07, brow: 0.005, tilt: -0.06 },
  };
  function applyExpression(f) {
    turn(J.Head, 1, 0, 0, f.pitch);
    turn(J.Head, 0, 0, 1, f.roll);
    turn(J.spine_03, 1, 0, 0, f.chest);
    shoulders(f.sh);
  }
  function applyBrows(f) {
    for (const { side, mesh, pivot } of brows) {
      // lift along the head's up and turn about its forward axis (inner ends up = worried)
      mesh.position.copy(pivot).addScaledVector(B.headUp, f.brow + (f.asym && side > 0 ? f.asym : 0));
      mesh.quaternion.setFromAxisAngle(B.headFwd, -side * f.tilt);
    }
  }

  // ---- the pose ----
  function compute(action, k, o) {
    const fn = ACT[action];
    if (!fn) throw new Error(`human: unknown action "${action}" (known: ${ACTIONS.join(', ')})`);
    k = clamp01(Number.isFinite(k) ? k : 0);
    o = o || {};
    reset();
    handTilt = null;
    grip = { r: 0.3, l: 0.3 };
    let spec = fn(k, o);
    // seated versions of standing actions: seated legs, the action's arms
    if (o.sitting && action !== 'sit' && !spec.seated) spec = { ...spec, layers: [{ clip: 'Sitting_Idle_Loop', t: loopT('Sitting_Idle_Loop', k, 2), w: 1 }], seated: true, arms: 0 };
    sample(spec.layers);
    update();
    if (spec.arms) armsIn(spec.arms);
    const seated = spec.seated === true ? 1 : spec.seated || 0;
    if (seated < 1) {
      ground(spec.knees ? [['calf_r', 0.06 * B.scale], ['calf_l', 0.06 * B.scale]] : []);
      narrowStance((spec.stance ?? 1) * (1 - seated));
    }
    if (seated > 0) seatLower(seated);
    update();
    spec.after?.();
    update();
    applyExpression(FACE[expression]);
    fingers('r', grip.r, 0.85);
    fingers('l', grip.l, 0.85);
    update();
    return handTilt;
  }

  const snap = () => ({ q: bones.map((b) => b.quaternion.clone()), p: bones.map((b) => b.position.clone()), rig: rig.position.clone() });

  function placeHand(tilt) {
    // carried things stay upright with the body (or tilt as the action says)
    update();
    J.hand_r.getWorldQuaternion(q1).invert();
    object.getWorldQuaternion(q2);
    hand.quaternion.copy(q1.multiply(q2));
    if (tilt) hand.quaternion.multiply(tilt);
  }

  function pose(action, k = 0, opts = {}) {
    last = { action, k, opts };
    object.updateMatrixWorld(true);
    // character space at rest → spine_03 rest local, for chest-carried targets
    reset();
    update();
    chestRestInv.copy(J.spine_03.matrixWorld).invert().multiply(object.matrixWorld);
    worldToChar(wpos(J.spine_03, v1), chestRest);
    const blend = opts.prev && opts.blend != null && opts.blend < 1 ? clamp01(opts.blend) : 1;
    let tilt;
    if (blend < 1) {
      const p = opts.prev;
      // the previous pose with the previous feeling, so posture and brows ease into the new one
      const now = expression;
      if (p.feel && EXPRESSIONS.includes(p.feel)) expression = p.feel;
      const tiltA = compute(p.action, p.k, { ...(p.opts || {}) });
      expression = now;
      const A = snap();
      const tiltB = compute(action, k, opts);
      const e = blend;
      bones.forEach((b, i) => {
        b.quaternion.slerpQuaternions(A.q[i], b.quaternion.clone(), e);
        b.position.lerpVectors(A.p[i], b.position.clone(), e);
      });
      rig.position.lerpVectors(A.rig, rig.position.clone(), e);
      tilt = tiltA || tiltB ? new THREE.Quaternion().slerpQuaternions(tiltA || new THREE.Quaternion(), tiltB || new THREE.Quaternion(), e) : null;
    } else tilt = compute(action, k, opts);
    const fa = opts.prev?.feel && blend < 1 && FACE[opts.prev.feel] ? FACE[opts.prev.feel] : null;
    const fb = FACE[expression];
    applyBrows(fa ? Object.fromEntries(Object.keys(fb).map((key) => [key, typeof fb[key] === 'number' ? lerp(fa[key] ?? 0, fb[key], blend) : fb[key]])) : fb);
    placeHand(tilt);
    update();
  }

  function setExpression(name) {
    if (!EXPRESSIONS.includes(name)) throw new Error(`human: unknown expression "${name}" (known: ${EXPRESSIONS.join(', ')})`);
    if (name === expression) return;
    expression = name;
    if (last) pose(last.action, last.k, last.opts);
  }

  return { pose, setExpression };
}
