// Wardrobe: real clothes for the rigged humans, grown from the body itself.
//
// The base bodies (Quaternius Universal Base Characters, CC0) come in underwear. Every garment
// here is a new skinned surface made from a region of the body in its bind pose:
//   1. pick the region with smooth fields (neckline, sleeve end, hem, waist, ankle) and cut the
//      triangles exactly along the field's zero line, so every hem is a clean straight edge;
//   2. lift it off the skin along heavily smoothed normals and relax it as a membrane that may
//      only move outward: it bridges hollows (abs, under the chest, the small of the back) the
//      way cloth does, and never sinks into the body;
//   3. let it hang: the torso falls almost straight from the chest and shoulder blades, sleeves
//      and trouser legs become round tubes with a little ease, trouser legs flare to the shoe;
//   4. finish the edges: a turned-in hem lip (the cloth has thickness), collars, cuffs, a belt,
//      lapels on a jacket;
//   5. keep the skin weights of the body point under each cloth point, so the clothes move
//      with the motion-captured body, and drop the body triangles that the clothes cover so
//      nothing pokes through in any pose.
// It also takes the superhero out of the bodies (slimmer arms, neck and chest; see slim()).
// Everything is pure geometry on typed arrays; no randomness, so the same recipe always gives
// the same clothes.
import * as THREE from '../vendor/three/three.module.js';

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- the base: slimmed bind-pose body, welded, with landmarks --------------------------------

/** Per-bone slimming in the bind pose: [radial factor] about the bone segment, or [sx, sz] about the spine. */
const SLIM = {
  male: { upperarm: 0.74, lowerarm: 0.84, neck_01: 0.84, thigh: 0.93, calf: 0.93, clavicle: [0.86, 0.93], spine_03: [0.86, 0.87], spine_02: [0.89, 0.94], spine_01: [0.93, 0.97] },
  female: { upperarm: 0.88, lowerarm: 0.9, neck_01: 0.92, thigh: 0.96, calf: 0.96, clavicle: [0.95, 1], spine_03: [0.95, 0.98], spine_02: [0.96, 0.98], spine_01: [0.97, 1] },
};
const CHILD = { upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r', lowerarm_l: 'hand_l', lowerarm_r: 'hand_r', thigh_l: 'calf_l', thigh_r: 'calf_r', calf_l: 'foot_l', calf_r: 'foot_r', neck_01: 'Head' };

/**
 * Prepare one base body: slim it (in place, in the bind pose), weld it and measure it.
 * @param {THREE.SkinnedMesh} body
 * @param {'male'|'female'} sex
 */
export function prepareBase(body, sex) {
  const g = body.geometry;
  const bones = body.skeleton.bones;
  const names = bones.map((b) => b.name);
  narrowShoulders(body, sex === 'male' ? 0.026 : 0.01);
  const bind = bones.map((b, i) => new THREE.Matrix4().copy(body.skeleton.boneInverses[i]).invert());
  const at = (name) => new THREE.Vector3().setFromMatrixPosition(bind[names.indexOf(name)]);
  const LM = {};
  for (const n of ['clavicle_r', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_r', 'lowerarm_r', 'hand_r', 'upperarm_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'thigh_l', 'foot_l']) LM[n] = at(n);
  const pos = g.attributes.position;
  const si = g.attributes.skinIndex;
  const sw = g.attributes.skinWeight;
  // crotch: the lowest body point on the centre line between the legs
  let crotch = Infinity;
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i)) < 0.012 && pos.getY(i) > 0.5 && pos.getY(i) < LM.pelvis.y) crotch = Math.min(crotch, pos.getY(i));
  LM.crotchY = crotch;

  // ---- slim
  const slim = SLIM[sex];
  const seg = names.map((n) => {
    const key = Object.keys(slim).find((k) => n === k || n.startsWith(k + '_'));
    if (!key) return null;
    const f = slim[key];
    if (Array.isArray(f)) return { aniso: f, y: bind[names.indexOf(n)].elements[13] };
    const child = CHILD[n];
    if (!child) return null;
    return { a: at(n), b: at(child), f };
  });
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const spineZ = (y) => (y < LM.spine_03.y ? THREE.MathUtils.lerp(LM.pelvis.z, LM.spine_03.z, ss(LM.pelvis.y, LM.spine_03.y, y)) : LM.spine_03.z);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    acc.set(0, 0, 0);
    let wsum = 0;
    for (let c = 0; c < 4; c++) {
      const w = sw.getComponent(i, c);
      if (!w) continue;
      const s = seg[si.getComponent(i, c)];
      wsum += w;
      if (!s) {
        acc.addScaledVector(p, w);
      } else if (s.aniso) {
        const cz = spineZ(p.y);
        acc.addScaledVector(q.set(p.x * s.aniso[0], p.y, cz + (p.z - cz) * s.aniso[1]), w);
      } else {
        ab.subVectors(s.b, s.a);
        const t = Math.min(1, Math.max(0, q.subVectors(p, s.a).dot(ab) / ab.lengthSq()));
        q.copy(s.a).addScaledVector(ab, t);
        acc.addScaledVector(q.lerp(p, s.f), w); // q + (p - q) * f
      }
    }
    if (wsum > 0) pos.setXYZ(i, acc.x / wsum, acc.y / wsum, acc.z / wsum);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.computeBoundingBox();

  // ---- weld (the mesh is split along UV seams; clothes need one connected surface). Points
  // closer than 0.2 mm are one point: a grid of 0.4 mm cells, checking the neighbouring cells.
  const TOL = 2e-4;
  const cell = (v) => Math.floor(v / (2 * TOL));
  const grid = new Map();
  const remap = new Uint32Array(pos.count);
  const W = { pos: [], nrm: [], si: [], sw: [] };
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = cell(x), cy = cell(y), cz = cell(z);
    let id;
    for (let dx = -1; dx <= 1 && id === undefined; dx++)
      for (let dy = -1; dy <= 1 && id === undefined; dy++)
        for (let dz = -1; dz <= 1 && id === undefined; dz++) {
          for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
            if (Math.abs(W.pos[j * 3] - x) < TOL && Math.abs(W.pos[j * 3 + 1] - y) < TOL && Math.abs(W.pos[j * 3 + 2] - z) < TOL) {
              id = j;
              break;
            }
          }
        }
    if (id === undefined) {
      id = W.pos.length / 3;
      const k = `${cx},${cy},${cz}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(id);
      W.pos.push(x, y, z);
      W.nrm.push(0, 0, 0);
      for (let c = 0; c < 4; c++) {
        W.si.push(si.getComponent(i, c));
        W.sw.push(sw.getComponent(i, c));
      }
    }
    W.nrm[id * 3] += nrm.getX(i);
    W.nrm[id * 3 + 1] += nrm.getY(i);
    W.nrm[id * 3 + 2] += nrm.getZ(i);
    remap[i] = id;
  }
  const idx = g.index.array;
  const tri = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) tri[i] = remap[idx[i]];
  const welded = { pos: new Float32Array(W.pos), nrm: new Float32Array(W.nrm), si: new Uint16Array(W.si), sw: new Float32Array(W.sw), tri, count: W.pos.length / 3 };
  for (let i = 0; i < welded.count; i++) {
    const l = Math.hypot(welded.nrm[i * 3], welded.nrm[i * 3 + 1], welded.nrm[i * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) welded.nrm[i * 3 + c] /= l;
  }
  // per welded vertex: how much of it the arm / leg / foot / head bones own
  const own = (re) => {
    const out = new Float32Array(welded.count);
    for (let i = 0; i < welded.count; i++) for (let c = 0; c < 4; c++) if (re.test(names[welded.si[i * 4 + c]])) out[i] += welded.sw[i * 4 + c];
    return out;
  };
  welded.arm = own(/^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/);
  welded.head = own(/^(Head|neck_01)$/);
  welded.foot = own(/^(foot|ball)/);
  welded.openEdges = boundary({ tri: welded.tri }).length;
  return { sex, names, bind, LM, welded, remap, bodyIndex: g.index, cache: new Map() };
}

/**
 * Move both arms toward the body by `d` metres: the upperarm bones (and so the whole arm) and the
 * vertices they carry, then rebind. The superhero bases have shoulders far wider than most people.
 */
function narrowShoulders(body, d) {
  const sk = body.skeleton;
  const root = body.parent;
  root.updateMatrixWorld(true);
  const names = sk.bones.map((b) => b.name);
  const arm = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/;
  const pos = body.geometry.attributes.position;
  const si = body.geometry.attributes.skinIndex;
  const sw = body.geometry.attributes.skinWeight;
  for (let i = 0; i < pos.count; i++) {
    let w = 0;
    for (let c = 0; c < 4; c++) if (arm.test(names[si.getComponent(i, c)])) w += sw.getComponent(i, c);
    if (w > 0) pos.setX(i, pos.getX(i) - Math.sign(pos.getX(i)) * d * w);
  }
  pos.needsUpdate = true;
  const q = new THREE.Quaternion();
  for (const s of ['l', 'r']) {
    const b = sk.bones[names.indexOf(`upperarm_${s}`)];
    b.parent.getWorldQuaternion(q);
    b.position.add(new THREE.Vector3(s === 'l' ? -d : d, 0, 0).applyQuaternion(q.invert()));
  }
  root.updateMatrixWorld(true);
  sk.calculateInverses();
}

// ---- recipes ----------------------------------------------------------------------------------

/** Named outfits. Colours may say 'tint' (the film's accent colour). See human.js for the fields. */
export const PRESETS = {
  casual: {
    top: { kind: 'jumper', colour: 'tint', sleeve: 1, neck: 'crew' },
    bottom: { kind: 'trousers', colour: '#2f3644', fit: 'straight' },
    shoes: { colour: '#5a4636', sole: '#efe9df' },
  },
  smart: {
    top: { kind: 'shirt', colour: '#f2f4f7', sleeve: 1, neck: 'collar', tucked: true, buttoned: true },
    tie: 'male', // a tie on the male body only; give a colour to choose it, or null for none
    jacket: { colour: '#2c3345' },
    bottom: { kind: 'trousers', colour: '#2c3345', fit: 'straight' },
    belt: '#2a211c',
    shoes: { colour: '#2a211c', sole: '#1c1714' },
  },
  scrubs: {
    top: { kind: 'scrubs', colour: '#1f7a80', sleeve: 0.2, neck: 'v', trim: '#e9f2f2' },
    bottom: { kind: 'trousers', colour: '#1f7a80', fit: 'loose' },
    shoes: { colour: '#f4f4f2', sole: '#d9dcdc' },
    badge: { lanyard: '#1d3f8a' },
  },
};

/** Fill in a recipe (a preset name, a recipe, or a preset name plus overrides). */
export function resolveRecipe(outfit, tint, sex = 'male') {
  let r = typeof outfit === 'string' ? PRESETS[outfit] : outfit && typeof outfit === 'object' ? (outfit.preset ? { ...PRESETS[outfit.preset], ...outfit } : outfit) : PRESETS.casual;
  if (!r) throw new Error(`human: unknown outfit "${outfit}" (known: ${Object.keys(PRESETS).join(', ')}, or a recipe)`);
  const col = (c, d) => (c === 'tint' ? tint : c || d);
  const top = { kind: 'shirt', sleeve: 1, ...(r.top || {}) };
  top.neck ??= top.kind === 'shirt' ? 'collar' : top.kind === 'scrubs' ? 'v' : 'crew';
  top.tucked ??= top.kind === 'shirt';
  top.colour = col(top.colour, '#e8e8e8');
  if (top.trim) top.trim = col(top.trim);
  const bottom = { kind: 'trousers', fit: 'straight', ...(r.bottom || {}) };
  bottom.colour = col(bottom.colour, '#2f3644');
  const shoes = { ...(r.shoes || {}) };
  shoes.colour = col(shoes.colour, '#2a2420');
  shoes.sole = col(shoes.sole, '#e9e4da');
  const jacket = r.jacket ? { ...r.jacket, colour: col(r.jacket.colour, '#2c3345') } : null;
  const badge = r.badge ? { card: '#ffffff', ...r.badge, lanyard: r.badge.lanyard ? col(r.badge.lanyard) : null } : null;
  // a tie needs a buttoned collar; 'male' means "for the male body only" (the smart preset)
  let tieCol = r.tie === 'male' ? (sex === 'male' ? '#5c2230' : null) : r.tie ? col(r.tie) : null;
  if (tieCol) {
    top.neck = 'collar';
    top.buttoned = true;
  }
  return { top, bottom, shoes, jacket, belt: r.belt ? col(r.belt) : null, badge, tie: tieCol };
}

// ---- mesh helpers -----------------------------------------------------------------------------

/** A working surface: positions, body points + normals under them, skin, fields. */
function subset(W, fields) {
  return {
    pos: Float32Array.from(W.pos),
    b: Float32Array.from(W.pos),
    n: Float32Array.from(W.nrm),
    si: Uint16Array.from(W.si),
    sw: Float32Array.from(W.sw),
    f: fields.map((fn) => {
      const out = new Float32Array(W.count);
      for (let i = 0; i < W.count; i++) out[i] = fn(W.pos[i * 3], W.pos[i * 3 + 1], W.pos[i * 3 + 2], i);
      return out;
    }),
    tri: Array.from(W.tri),
    count: W.count,
  };
}

/** Keep the part of the surface where every field is < 0, cutting triangles exactly on the zero lines. */
function clip(S, off = 0) {
  for (let fi = 0; fi < S.f.length; fi++) {
    const F = S.f[fi];
    const cut = new Map();
    const add = (a, b) => {
      const k = a < b ? a * 1e7 + b : b * 1e7 + a;
      if (cut.has(k)) return cut.get(k);
      const t = (F[a] - off) / (F[a] - F[b]);
      const id = S.count++;
      const lerp3 = (arr) => {
        for (let c = 0; c < 3; c++) arr.push(arr[a * 3 + c] + (arr[b * 3 + c] - arr[a * 3 + c]) * t);
      };
      // typed arrays are grown lazily below; here we push into plain arrays
      lerp3(S._pos);
      lerp3(S._b);
      lerp3(S._n);
      // the skin weights are blended too: copying one end's would make neighbours on a hem
      // follow different bones, and the hem would zigzag as the body moves
      const [ji, jw] = mixSkin([[S._si, S._sw, a, 1 - t], [S._si, S._sw, b, t]]);
      S._si.push(...ji);
      S._sw.push(...jw);
      for (const G of S._f) G.push(G[a] + (G[b] - G[a]) * t);
      cut.set(k, id);
      return id;
    };
    S._pos = Array.from(S.pos);
    S._b = Array.from(S.b);
    S._n = Array.from(S.n);
    S._si = Array.from(S.si);
    S._sw = Array.from(S.sw);
    S._f = S.f.map((G) => Array.from(G));
    const out = [];
    const T = S.tri;
    for (let t = 0; t < T.length; t += 3) {
      const v = [T[t], T[t + 1], T[t + 2]];
      const ins = v.map((i) => F[i] < off);
      const n = ins.filter(Boolean).length;
      if (n === 3) out.push(...v);
      else if (n === 0) continue;
      else {
        // rotate so the odd one out is first
        let r = 0;
        const odd = n === 1;
        while (ins[r] !== odd) r++;
        const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3];
        const ab = add(a, b);
        const ac = add(a, c);
        if (odd) out.push(a, ab, ac);
        else out.push(ab, b, c, ab, c, ac);
      }
    }
    S.tri = out;
    S.pos = Float32Array.from(S._pos);
    S.b = Float32Array.from(S._b);
    S.n = Float32Array.from(S._n);
    S.si = Uint16Array.from(S._si);
    S.sw = Float32Array.from(S._sw);
    S.f = S._f.map((G) => Float32Array.from(G));
  }
  delete S._pos;
  // compact: drop vertices no triangle uses
  const used = new Int32Array(S.count).fill(-1);
  let m = 0;
  for (const i of S.tri) if (used[i] < 0) used[i] = m++;
  const pick = (arr, k) => {
    const o = new arr.constructor(m * k);
    for (let i = 0; i < S.count; i++) if (used[i] >= 0) for (let c = 0; c < k; c++) o[used[i] * k + c] = arr[i * k + c];
    return o;
  };
  S.pos = pick(S.pos, 3);
  S.b = pick(S.b, 3);
  S.n = pick(S.n, 3);
  S.si = pick(S.si, 4);
  S.sw = pick(S.sw, 4);
  S.f = S.f.map((G) => pick(G, 1));
  S.tri = Uint32Array.from(S.tri, (i) => used[i]);
  S.count = m;
  return S;
}

/**
 * Blend skin influences: parts = [[skinIndex array, skinWeight array, vertex, amount], ...].
 * Returns the four strongest joints and their weights, summing to 1.
 */
function mixSkin(parts) {
  const acc = new Map();
  for (const [si, sw, v, k] of parts) {
    if (k <= 0) continue;
    for (let c = 0; c < 4; c++) {
      const w = sw[v * 4 + c] * k;
      if (w > 0) acc.set(si[v * 4 + c], (acc.get(si[v * 4 + c]) || 0) + w);
    }
  }
  const top = [...acc.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, 4);
  const sum = top.reduce((n, [, w]) => n + w, 0) || 1;
  const ji = [0, 0, 0, 0], jw = [0, 0, 0, 0];
  top.forEach(([j, w], c) => {
    ji[c] = j;
    jw[c] = w / sum;
  });
  if (!top.length) jw[0] = 1;
  return [ji, jw];
}

/**
 * Tidy the cut edges: smooth each edge line (Taubin, so loops do not shrink) and even out the
 * skin weights along it, so a hem stays one clean line in every pose.
 */
function tidyEdges(S, passes = 6) {
  if (!S.edge) return;
  const P = S.pos;
  const step = (lam) => {
    const d = new Float32Array(S.count * 3);
    for (let i = 0; i < S.count; i++) {
      if (!S.edge[i] || S.along[i].length !== 2) continue;
      const [a, b] = S.along[i];
      for (let c = 0; c < 3; c++) d[i * 3 + c] = ((P[a * 3 + c] + P[b * 3 + c]) / 2 - P[i * 3 + c]) * lam;
    }
    for (let i = 0; i < d.length; i++) P[i] += d[i];
  };
  for (let it = 0; it < passes; it++) {
    step(0.5);
    step(-0.53);
  }
  for (let it = 0; it < 3; it++) {
    const si = Array.from(S.si), sw = Array.from(S.sw);
    for (let i = 0; i < S.count; i++) {
      if (!S.edge[i] || S.along[i].length !== 2) continue;
      const [ji, jw] = mixSkin([[si, sw, i, 0.5], [si, sw, S.along[i][0], 0.25], [si, sw, S.along[i][1], 0.25]]);
      for (let c = 0; c < 4; c++) {
        S.si[i * 4 + c] = ji[c];
        S.sw[i * 4 + c] = jw[c];
      }
    }
  }
}

function neighbours(S) {
  const sets = Array.from({ length: S.count }, () => new Set());
  const T = S.tri;
  for (let t = 0; t < T.length; t += 3) {
    const [a, b, c] = [T[t], T[t + 1], T[t + 2]];
    sets[a].add(b).add(c);
    sets[b].add(a).add(c);
    sets[c].add(a).add(b);
  }
  return sets.map((s) => Uint32Array.from(s));
}

/** Which vertices are on the cut edge, and their neighbours along it. */
function edgeInfo(S) {
  const flag = new Uint8Array(S.count);
  const along = Array.from({ length: S.count }, () => []);
  for (const [a, b] of boundary(S)) {
    flag[a] = flag[b] = 1;
    along[a].push(b);
    along[b].push(a);
  }
  S.edge = flag;
  S.along = along;
}

/** Boundary edges in triangle winding order (a → b), as a list of [a, b]. */
function boundary(S) {
  const count = new Map();
  const T = S.tri;
  for (let t = 0; t < T.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = T[t + e], b = T[t + ((e + 1) % 3)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      const c = count.get(k);
      count.set(k, c ? [c[0] + 1, c[1]] : [1, [a, b]]);
    }
  }
  const out = [];
  for (const [n, e] of count.values()) if (n === 1) out.push(e);
  return out;
}

/** Smooth the per-vertex normals across the surface (big bumps survive, muscle detail does not). */
function smoothNormals(S, nb, iters) {
  let n = S.n;
  for (let it = 0; it < iters; it++) {
    const o = new Float32Array(n.length);
    for (let i = 0; i < S.count; i++) {
      let x = n[i * 3], y = n[i * 3 + 1], z = n[i * 3 + 2];
      for (const j of nb[i]) {
        x += n[j * 3];
        y += n[j * 3 + 1];
        z += n[j * 3 + 2];
      }
      const l = Math.hypot(x, y, z) || 1;
      o[i * 3] = x / l;
      o[i * 3 + 1] = y / l;
      o[i * 3 + 2] = z / l;
    }
    n = o;
  }
  S.n = n;
}

/**
 * Lift the surface off the skin by `d` (per vertex) and relax it as a membrane that may only move
 * outward along the smoothed normal (never closer than d, never further than d + slack).
 */
function inflate(S, nb, d, slack, iters) {
  const h = Float32Array.from(d);
  const P = S.pos;
  const place = (i) => {
    for (let c = 0; c < 3; c++) P[i * 3 + c] = S.b[i * 3 + c] + S.n[i * 3 + c] * h[i];
  };
  for (let i = 0; i < S.count; i++) place(i);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < S.count; i++) {
      const N = nb[i];
      if (!N.length) continue;
      let x = 0, y = 0, z = 0;
      for (const j of N) {
        x += P[j * 3];
        y += P[j * 3 + 1];
        z += P[j * 3 + 2];
      }
      x = x / N.length - S.b[i * 3];
      y = y / N.length - S.b[i * 3 + 1];
      z = z / N.length - S.b[i * 3 + 2];
      const along = x * S.n[i * 3] + y * S.n[i * 3 + 1] + z * S.n[i * 3 + 2];
      h[i] = Math.min(d[i] + slack[i], Math.max(d[i], along));
      place(i);
    }
  }
  // the cut edge: its lift evened out along the edge, so the hem is a clean line
  if (S.edge) {
    for (let it = 0; it < 8; it++) {
      for (let i = 0; i < S.count; i++) {
        if (!S.edge[i]) continue;
        let m = h[i];
        for (const j of S.along[i]) m += h[j];
        h[i] = Math.max(d[i], m / (S.along[i].length + 1));
        place(i);
      }
    }
  }
  S.h = h;
}

/** Plain Laplacian smoothing of positions, keeping every point at least `floor` off the skin. */
function relax(S, nb, iters, floor, w = 0.5, only = null) {
  const P = S.pos;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < S.count; i++) {
      if (only && !only[i]) continue;
      if (S.edge?.[i]) continue; // the edge stays on its clean cut line
      const N = nb[i];
      if (!N.length) continue;
      let x = 0, y = 0, z = 0;
      for (const j of N) {
        x += P[j * 3];
        y += P[j * 3 + 1];
        z += P[j * 3 + 2];
      }
      for (const [c, v] of [[0, x], [1, y], [2, z]]) P[i * 3 + c] += (v / N.length - P[i * 3 + c]) * w;
      // not into the body
      let off = 0;
      for (let c = 0; c < 3; c++) off += (P[i * 3 + c] - S.b[i * 3 + c]) * S.n[i * 3 + c];
      if (off < floor[i]) for (let c = 0; c < 3; c++) P[i * 3 + c] += S.n[i * 3 + c] * (floor[i] - off);
    }
  }
}

/**
 * Make limb sections round with some ease: every point at least `R(t)` from the limb axis.
 * axis(i) returns null (not on this limb) or {cx, cy, cz, ax, ay, az, t, w} — the closest axis
 * point, the axis direction, the place along it and how much the rule applies.
 */
function roundLimb(S, axis, R) {
  const P = S.pos;
  for (let i = 0; i < S.count; i++) {
    const a = axis(S.b[i * 3], S.b[i * 3 + 1], S.b[i * 3 + 2], i);
    if (!a || a.w <= 0) continue;
    let dx = P[i * 3] - a.cx, dy = P[i * 3 + 1] - a.cy, dz = P[i * 3 + 2] - a.cz;
    const along = dx * a.ax + dy * a.ay + dz * a.az;
    dx -= along * a.ax;
    dy -= along * a.ay;
    dz -= along * a.az;
    const r = Math.hypot(dx, dy, dz) || 1e-6;
    const want = R(a.t, i);
    if (r >= want) continue;
    const k = 1 + ((want - r) / r) * a.w;
    P[i * 3] = a.cx + along * a.ax + dx * k;
    P[i * 3 + 1] = a.cy + along * a.ay + dy * k;
    P[i * 3 + 2] = a.cz + along * a.az + dz * k;
  }
}

/** Torso drape: going down from the chest and shoulder blades, cloth falls nearly straight. */
function drape(S, nb, isTorso, axisZ, slope, iters) {
  const P = S.pos;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < S.count; i++) {
      if (!isTorso[i]) continue;
      const yi = P[i * 3 + 1];
      let dx = P[i * 3], dz = P[i * 3 + 2] - axisZ(yi);
      const r = Math.hypot(dx, dz) || 1e-6;
      let need = r;
      for (const j of nb[i]) {
        const yj = P[j * 3 + 1];
        if (yj <= yi || !isTorso[j]) continue;
        const rj = Math.hypot(P[j * 3], P[j * 3 + 2] - axisZ(yj));
        // only compare points facing the same way
        const cos = (dx * P[j * 3] + dz * (P[j * 3 + 2] - axisZ(yj))) / (r * rj || 1);
        if (cos < 0.97) continue;
        need = Math.max(need, rj - slope * (yj - yi));
      }
      if (need > r) {
        const k = need / r;
        P[i * 3] = dx * k;
        P[i * 3 + 2] = axisZ(yi) + dz * k;
      }
    }
  }
}

/** Area-weighted smooth normals of the finished surface. */
function normalsOf(pos, tri, count) {
  const n = new Float32Array(count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tri.length; t += 3) {
    const [i, j, k] = [tri[t], tri[t + 1], tri[t + 2]];
    a.fromArray(pos, i * 3);
    b.fromArray(pos, j * 3).sub(a);
    c.fromArray(pos, k * 3).sub(a);
    b.cross(c);
    for (const v of [i, j, k]) {
      n[v * 3] += b.x;
      n[v * 3 + 1] += b.y;
      n[v * 3 + 2] += b.z;
    }
  }
  for (let i = 0; i < count; i++) {
    const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1;
    n[i * 3] /= l;
    n[i * 3 + 1] /= l;
    n[i * 3 + 2] /= l;
  }
  return n;
}

/** A finished piece as a BufferGeometry (positions in the bind pose, skin attributes, normals). */
function geometryOf(S, { lips = [], extra = null, group = null } = {}) {
  // the hem lips and any extra strips are separate vertices so the fold stays crisp
  const pos = Array.from(S.pos);
  const si = Array.from(S.si);
  const sw = Array.from(S.sw);
  const tri = Array.from(S.tri);
  let count = S.count;
  const push = (p, from) => {
    pos.push(p[0], p[1], p[2]);
    for (let c = 0; c < 4; c++) {
      si.push(si[from * 4 + c]);
      sw.push(sw[from * 4 + c]);
    }
    return count++;
  };
  for (const strip of [...lips, ...(extra ? [extra] : [])]) {
    const base = count;
    const ids = strip.verts.map((v) => {
      if (v.ref !== undefined) return v.ref;
      const id = push(v.p, v.from);
      if (v.pelvis) pelvisWeight(si, sw, id, v.pelvis);
      return id;
    });
    void base;
    for (const [a, b, c] of strip.tris) tri.push(ids[a], ids[b], ids[c]);
  }
  const P = Float32Array.from(pos);
  let T = Uint32Array.from(tri);
  const N = normalsOf(P, T, count);
  const g = new THREE.BufferGeometry();
  if (group) {
    // triangles sorted by material group (e.g. a shoe's upper and its sole)
    const by = [[], []];
    for (let t = 0; t < S.tri.length; t += 3) by[group(S, S.tri[t], S.tri[t + 1], S.tri[t + 2])].push(S.tri[t], S.tri[t + 1], S.tri[t + 2]);
    by[0].push(...tri.slice(S.tri.length));
    T = Uint32Array.from([...by[0], ...by[1]]);
    g.addGroup(0, by[0].length, 0);
    g.addGroup(by[0].length, by[1].length, 1);
  }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(si), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(sw), 4));
  g.setIndex(new THREE.BufferAttribute(T, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * Chain the boundary edges into loops (each a list of vertex ids in winding order).
 * @param {number[][]} edges
 */
function loops(edges) {
  const next = new Map();
  for (const [a, b] of edges) next.set(a, b);
  const seen = new Set();
  const out = [];
  for (const [a] of edges) {
    if (seen.has(a)) continue;
    const loop = [];
    let v = a;
    while (v !== undefined && !seen.has(v)) {
      seen.add(v);
      loop.push(v);
      v = next.get(v);
    }
    if (loop.length > 2) {
      loop.closed = next.get(loop[loop.length - 1]) === loop[0];
      out.push(loop);
    }
  }
  return out;
}

/**
 * A strip hanging off a boundary loop: rings[k](i) gives the k-th ring's point for loop vertex i.
 * Triangles wind so the strip faces outward (same side as the garment).
 */
function strip(S, loop, rings, { closed = loop.closed !== false, flip = false, share = false } = {}) {
  const verts = [];
  const tris = [];
  const n = loop.length;
  // share: the first ring is the garment's own edge vertices (one smooth surface, no crease)
  for (let k = 0; k < rings.length; k++) for (let i = 0; i < n; i++) verts.push(share && k === 0 ? { ref: loop[i] } : { p: rings[k](loop[i], i), from: loop[i] });
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const i2 = (i + 1) % n;
      const a = k * n + i, b = k * n + i2, c = (k + 1) * n + i2, d = (k + 1) * n + i;
      if (flip) tris.push([a, c, b], [a, d, c]);
      else tris.push([a, b, c], [a, c, d]);
    }
  }
  return { verts, tris };
}

const P3 = (S, i) => [S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]];
const B3 = (S, i) => [S.b[i * 3], S.b[i * 3 + 1], S.b[i * 3 + 2]];

/** The turned-in hem: the cloth edge folds in by `t` toward the skin, so the cloth has a thickness. */
function hemLips(S, edges, t = 0.006) {
  return loops(edges).map((loop) =>
    strip(S, loop, [
      (i) => P3(S, i),
      (i) => {
        const p = P3(S, i);
        const k = Math.min(t, Math.max(0, (p[0] - S.b[i * 3]) * S.n[i * 3] + (p[1] - S.b[i * 3 + 1]) * S.n[i * 3 + 1] + (p[2] - S.b[i * 3 + 2]) * S.n[i * 3 + 2]) * 0.9);
        return [p[0] - S.n[i * 3] * k, p[1] - S.n[i * 3 + 1] * k, p[2] - S.n[i * 3 + 2] * k];
      },
    ], { flip: true, share: true }),
  );
}

/**
 * A turned band along an edge loop, the way a sewn hem or a rib finishes cloth: from a lip turned
 * in at the edge, it stands `proud` off the cloth and lies back over it for `width`.
 * The edge line itself is the (already smoothed) cut, so the band is one clean line.
 */
function edgeBand(S, nb, loop, width = 0.012, proud = 0.0025) {
  const n = loop.length;
  // per edge point: the direction back into the cloth, along its surface
  let dir = loop.map((i) => {
    let x = 0, y = 0, z = 0;
    for (const j of nb[i]) {
      if (S.edge[j]) continue;
      x += S.pos[j * 3] - S.pos[i * 3];
      y += S.pos[j * 3 + 1] - S.pos[i * 3 + 1];
      z += S.pos[j * 3 + 2] - S.pos[i * 3 + 2];
    }
    const nx = S.n[i * 3], ny = S.n[i * 3 + 1], nz = S.n[i * 3 + 2];
    const d = x * nx + y * ny + z * nz;
    x -= d * nx;
    y -= d * ny;
    z -= d * nz;
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  });
  for (let it = 0; it < 4; it++) dir = dir.map((d, k) => {
    const a = dir[(k - 1 + n) % n], b = dir[(k + 1) % n];
    const v = [0, 1, 2].map((c) => a[c] + 2 * d[c] + b[c]);
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  });
  const at = (k, along, off) => {
    const i = loop[k];
    return [0, 1, 2].map((c) => S.pos[i * 3 + c] + dir[k][c] * along + S.n[i * 3 + c] * off);
  };
  const rings = [(i, k) => at(k, 0, -0.004), (i, k) => at(k, 0, proud), (i, k) => at(k, width, proud), (i, k) => at(k, width + 0.003, 0)];
  return strip(S, loop, rings.map((r) => (i, k) => r(i, k)), { flip: true });
}

/** Round a neck-edge loop off: height and radius averaged over an arc of `win` radians. */
function lowPassLoop(P, cz, win = 0.5) {
  const n = P.length;
  const ang = P.map((p) => Math.atan2(p[0], p[2] - cz));
  const rad = P.map((p) => Math.hypot(p[0], p[2] - cz));
  return P.map((p, k) => {
    let y = 0, r = 0, w = 0;
    for (let j = 0; j < n; j++) {
      const d = Math.abs(Math.atan2(Math.sin(ang[j] - ang[k]), Math.cos(ang[j] - ang[k])));
      if (d > win) continue;
      const wj = 1 - d / win;
      y += P[j][1] * wj;
      r += rad[j] * wj;
      w += wj;
    }
    return [Math.sin(ang[k]) * (r / w), y / w, cz + Math.cos(ang[k]) * (r / w)];
  });
}

/** Extend a hem loop straight on (down a trouser leg, past a jacket's hips) by `len`. */
function extendLoops(S, edges, dir, len, flare = 0) {
  // returns new boundary positions by pushing the loop vertices; adds a strip
  const out = [];
  for (const loop of loops(edges)) {
    // the loop's centre, to flare outward from
    let cx = 0, cy = 0, cz = 0;
    for (const i of loop) {
      cx += S.pos[i * 3];
      cy += S.pos[i * 3 + 1];
      cz += S.pos[i * 3 + 2];
    }
    cx /= loop.length;
    cy /= loop.length;
    cz /= loop.length;
    const end = (i) => {
      const p = P3(S, i);
      const r = [p[0] - cx, p[1] - cy, p[2] - cz];
      const along = r[0] * dir[0] + r[1] * dir[1] + r[2] * dir[2];
      const rad = [r[0] - along * dir[0], r[1] - along * dir[1], r[2] - along * dir[2]];
      return [p[0] + dir[0] * len + rad[0] * flare, p[1] + dir[1] * len + rad[1] * flare, p[2] + dir[2] * len + rad[2] * flare];
    };
    const mid = (i) => {
      const a = P3(S, i), e = end(i);
      return [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2];
    };
    // the loop runs the garment's way round, so the strip winds the other way to face out with it
    // a sewn hem band in the last 1.5 cm: it steps out by 2.5 mm, so the hem reads as a line
    const out3 = (p, k) => {
      const r = [p[0] - cx, 0, p[2] - cz];
      const l = Math.hypot(r[0], r[2]) || 1;
      return [p[0] + (r[0] / l) * k, p[1], p[2] + (r[2] / l) * k];
    };
    const bandTop = (i) => {
      const e = end(i);
      return [e[0] - dir[0] * 0.015, e[1] - dir[1] * 0.015, e[2] - dir[2] * 0.015];
    };
    const s = strip(S, loop, [(i) => P3(S, i), mid, bandTop, (i) => out3(bandTop(i), 0.0025), (i) => out3(end(i), 0.0025)], { flip: true, share: true });
    // the lip turns in at the far end
    const lip = strip(S, loop, [(i) => out3(end(i), 0.0025), (i) => {
      const e = end(i), b = B3(S, i);
      return [e[0] + (b[0] - e[0]) * 0.7, e[1], e[2] + (b[2] - e[2]) * 0.7];
    }], { flip: true });
    out.push(s, lip);
  }
  return out;
}

// ---- the garments -----------------------------------------------------------------------------

/**
 * Dress a prepared base in a recipe: returns the garment geometries (shared, cached per recipe)
 * and the body index with covered triangles removed.
 */
export function dress(base, recipe) {
  const key = JSON.stringify(recipe, (k, v) => (k === 'colour' || k === 'sole' || k === 'trim' || k === 'collar' || k === 'card' || k === 'lanyard' || k === 'image' ? undefined : v));
  if (base.cache.has(key)) return base.cache.get(key);
  const { LM, welded: W, sex } = base;
  PELVIS = base.names.indexOf('pelvis');
  const female = sex === 'female';
  const parts = [];
  const cover = new Float32Array(W.count); // how deep inside some garment each body vertex is
  const covered = (fields, margin = 0) => {
    for (let i = 0; i < W.count; i++) {
      let f = -Infinity;
      for (const fn of fields) f = Math.max(f, fn(W.pos[i * 3], W.pos[i * 3 + 1], W.pos[i * 3 + 2], i));
      cover[i] = Math.max(cover[i], -f - margin);
    }
  };

  const shoulderX = Math.abs(LM.upperarm_r.x);
  const wristX = Math.abs(LM.hand_r.x);
  const armY = LM.upperarm_r.y;
  const armZ = LM.upperarm_r.z;
  const neck = LM.neck_01;
  const waistY = LM.pelvis.y + (LM.spine_01.y - LM.pelvis.y) * 0.55;
  const crotch = LM.crotchY;
  const ankleY = LM.foot_r.y;
  const spineZ = (y) => THREE.MathUtils.lerp(LM.pelvis.z, LM.spine_03.z, ss(LM.pelvis.y, LM.spine_03.y, y)) + 0.01;
  const armT = (x, y, z, i) => (W.arm[i] > 0.35 || Math.abs(x) > shoulderX + 0.02 ? Math.abs(x) - shoulderX : -1);
  const upperLen = Math.abs(LM.lowerarm_r.x) - shoulderX;
  const armLen = wristX - shoulderX;

  // ---- the top (shirt, jumper, tee, scrubs tunic) -------------------------------------------
  const top = recipe.top;
  const jacket = recipe.jacket;
  const sleeveEnd = top.sleeve >= 0.95 ? armLen - 0.012 : THREE.MathUtils.lerp(0.09, armLen - 0.012, top.sleeve);
  // neckline: a ring round the base of the neck (only near the neck, so the shoulders stay
  // covered), and for a V or an open collar a wedge down the front
  const neckCZ = neck.z + 0.03;
  // the hollow at the base of the throat, just above the inner ends of the collarbones
  const notchY = LM.clavicle_r.y - 0.005;
  const ringR = female ? 0.072 : 0.082;
  const ring = (lower = 0) => (x, y, z, i) => {
    if (i >= 0 && W.head[i] > 0.6) return 1;
    const dz = z - neckCZ;
    const r = Math.hypot(x, dz);
    const front = Math.max(0, dz / (r || 1));
    const cut = neck.y - 0.03 - lower - 0.03 * front ** 2;
    return Math.min(y - cut, ringR + lower * 0.5 - r);
  };
  // a V down the front: `width` either side at the notch, closing at `bottom`
  const wedge = (bottom, width) => {
    const fn = (x, y, z) => {
      const dz = z - neckCZ;
      const w = width * Math.max(0, (y - bottom) / (notchY - bottom));
      return Math.min(w - Math.abs(x), dz - 0.02, y - bottom);
    };
    fn.onCloth = true;
    return fn;
  };
  // the neckline: one smooth ring round the base of the neck, at the notch in front and rising
  // to the back; measured on the cloth so it hugs the neck whatever the shaping did
  const crew = (x, y, z, i) => {
    if (i >= 0 && W.head[i] > 0.6) return 1;
    const dz = z - neckCZ;
    const r = Math.hypot(x, dz);
    // one smooth ring: at the throat in front, rising evenly round the sides to the back of the
    // neck. Its line on the smooth cloth is a round U from the front; the 14 cm guard only keeps
    // the shoulders out of it
    const back = ((1 - dz / (r || 1)) / 2) ** 0.6;
    const yc = notchY + 0.012 + 0.06 * back;
    return r < 0.14 ? y - yc : -1;
  };
  crew.onCloth = true;
  const neckFields = [crew];
  // scrubs: a modest V, 8 cm below the notch; an open-necked shirt: one button undone
  if (top.neck === 'v') neckFields.push(wedge(notchY - (female ? 0.075 : 0.085), 0.045));
  if (top.neck === 'collar' && !top.buttoned) neckFields.push(wedge(notchY - 0.04, 0.03));
  // untucked tops end at the hip bone and hang straight from there (see hemExt)
  const topHem = top.tucked ? waistY - 0.07 : LM.pelvis.y + 0.03;
  const topFields = [...neckFields, (x, y) => topHem - y, (x, y, z, i) => armT(x, y, z, i) - sleeveEnd, (x, y, z, i) => (W.foot[i] > 0.1 ? 1 : -1)];
  const topLoose = top.kind === 'scrubs' ? 1.4 : top.kind === 'jumper' ? 1.15 : 1;
  parts.push(...garment('top', topFields, {
    d: (x, y, z, i) => (top.tucked ? 0.009 : 0.016) * topLoose + (armT(x, y, z, i) > 0 ? 0.004 : 0),
    slack: 0.05,
    torsoDrape: top.kind === 'scrubs' ? 0.32 : 0.4,
    drapeAbove: top.tucked ? waistY + 0.07 : -Infinity,
    post: top.tucked
      ? (S) => {
          // tucked in: from just above the waistband down, the shirt goes back to the body
          for (let i = 0; i < S.count; i++) {
            const y = S.b[i * 3 + 1];
            const k = ss(waistY + 0.06, waistY - 0.0, y);
            if (k <= 0) continue;
            for (let c = 0; c < 3; c++) S.pos[i * 3 + c] += (S.b[i * 3 + c] + S.n[i * 3 + c] * 0.007 - S.pos[i * 3 + c]) * k;
          }
        }
      : null,
    sleeve: { end: sleeveEnd, r0: (female ? 0.05 : 0.058) * topLoose, r1: (top.sleeve < 0.95 ? (female ? 0.052 : 0.06) : 0.042) * topLoose },
    chestNotNeck: true,
    tucked: top.tucked,
    collarNeck: top.neck === 'collar',
    trim: !!top.trim,
    hemDir: top.tucked ? null : [0, -1, 0],
    hemY: topHem,
    hemExt: top.tucked ? 0 : top.kind === 'scrubs' ? 0.11 : 0.075,
    hemFlare: 0.07,
    hemPelvis: 0.55,
  }));
  covered(topFields, 0.02);
  if (top.neck === 'collar') parts.push(collar('collar', LM, parts.find((p) => p.name === 'top')));
  if (recipe.tie && top.neck === 'collar') parts.push(tie('tie', LM, parts.find((p) => p.name === 'top'), waistY));

  // ---- trousers --------------------------------------------------------------------------------
  const bottom = recipe.bottom;
  const hemY = ankleY + 0.035;
  const loose = bottom.fit === 'loose' ? 1.15 : 1;
  const legFields = [(x, y, z, i) => y - (waistY + 0.01), (x, y) => hemY - y, (x, y, z, i) => (W.arm[i] > 0.2 ? 1 : -1)];
  const legAxis = (x, y, z) => {
    if (y > crotch + 0.03) return null;
    const side = x < 0 ? '_r' : '_l';
    const th = side === '_r' ? LM.thigh_r : LM.thigh_l;
    const ft = side === '_r' ? LM.foot_r : LM.foot_l;
    const t = (th.y - y) / (th.y - ft.y);
    return { cx: th.x + (ft.x - th.x) * t, cy: y, cz: th.z + (ft.z - th.z) * t, ax: 0, ay: 1, az: 0, t, w: ss(crotch + 0.03, crotch - 0.06, y) };
  };
  const legR = (t) => {
    // thigh with ease; below the knee the leg falls straight to a slight flare at the shoe
    const knee = 0.5;
    const rK = (female ? 0.064 : 0.07) * loose;
    if (t < knee) return THREE.MathUtils.lerp((female ? 0.09 : 0.092) * loose, rK, t / knee);
    return rK - 0.004 * ss(knee, 0.8, t) + 0.006 * ss(0.85, 1, t);
  };
  parts.push(...garment('bottom', legFields, {
    d: (x, y) => (y > waistY - 0.08 ? (top.tucked ? 0.016 : 0.011) : 0.012) * loose,
    slack: 0.04,
    leg: { axis: legAxis, R: legR },
    hemDir: [0, -1, 0],
    hemY,
    hemExt: hemY - ankleY + 0.01,
    waistband: !top.tucked ? null : 0.035,
  }));
  covered(legFields, 0.02);
  if (recipe.belt && top.tucked) parts.push(belt('belt', parts.find((p) => p.name === 'bottom'), waistY));

  // ---- shoes -----------------------------------------------------------------------------------
  const shoeTop = ankleY + 0.035;
  const shoeFields = [(x, y) => y - shoeTop, (x, y, z, i) => (W.arm[i] > 0.2 ? 1 : -1)];
  parts.push(...shoes(base));
  covered(shoeFields, 0.012);

  // ---- jacket ----------------------------------------------------------------------------------
  if (jacket) {
    const button = waistY + 0.05;
    // an open V from the collar to the button, a small inverted V below it (front only)
    const open = (x, y, z) => {
      // open above the button; below it the two fronts meet and hang closed
      if (y < button) return -0.01;
      const w = 0.004 + (y - button) * 0.3;
      return Math.min(w - Math.abs(x), (z - spineZ(y) - 0.03) * 2);
    };
    open.onCloth = true;
    // like an untucked top: cut at the hip line, then a straight skirt that hangs from the pelvis
    const jHem = LM.pelvis.y + 0.03;
    const jFields = [
      (x, y, z, i) => ring(-0.012)(x, y, z, i),
      (x, y) => jHem - y,
      (x, y, z, i) => armT(x, y, z, i) - (armLen - 0.03),
      open,
      (x, y, z, i) => (W.foot[i] > 0.1 ? 1 : -1),
    ];
    parts.push(...garment('jacket', jFields, {
      d: (x, y, z, i) => 0.026 + (armT(x, y, z, i) > 0 ? 0.008 : 0),
      slack: 0.05,
      torsoDrape: 0.24,
      sleeve: { end: armLen - 0.03, r0: female ? 0.066 : 0.074, r1: female ? 0.054 : 0.058 },
      hemDir: [0, -1, 0],
      hemY: jHem,
      hemExt: 0.13,
      hemFlare: 0.08,
      hemPelvis: 0.7,
      lapels: { button, edge: (y) => 0.01 + (y - button) * 0.3, top: notchY - 0.02 },
      chestNotNeck: true,
      band: false,
      relax: 24,
    }));
  }

  // the body keeps every triangle with any vertex not well inside the clothes
  const idx = base.bodyIndex.array;
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = base.remap[idx[t]], b = base.remap[idx[t + 1]], c = base.remap[idx[t + 2]];
    if (cover[a] > 0 && cover[b] > 0 && cover[c] > 0) continue;
    keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const out = { parts, bodyIndex: new THREE.BufferAttribute(Uint32Array.from(keep), 1), recipeKey: key };
  base.cache.set(key, out);
  return out;

  // ---- builders --------------------------------------------------------------------------------
  function garment(name, fields, o) {
    // cut loosely (3 cm outside every line), shape the cloth, then cut exactly on the shaped
    // surface: the edges come out as clean lines whatever the shaping did near them
    let S = clip(subset(W, fields), 0.03);
    let nb = neighbours(S);
    edgeInfo(S);
    smoothNormals(S, nb, 14);
    const d = new Float32Array(S.count);
    const slack = new Float32Array(S.count).fill(o.slack);
    for (let i = 0; i < S.count; i++) d[i] = o.d(S.b[i * 3], S.b[i * 3 + 1], S.b[i * 3 + 2], i);
    inflate(S, nb, d, slack, 140);
    const torso = new Uint8Array(S.count);
    for (let i = 0; i < S.count; i++) torso[i] = Math.abs(S.b[i * 3]) < shoulderX - 0.01 && S.b[i * 3 + 1] > Math.max(crotch, o.drapeAbove ?? -Infinity) ? 1 : 0;
    if (o.torsoDrape) drape(S, nb, torso, spineZ, o.torsoDrape, 40);
    if (o.sleeve) {
      const sl = o.sleeve;
      roundLimb(S, (x, y, z) => {
        const t = Math.abs(x) - shoulderX;
        if (t < 0.02) return null;
        return { cx: Math.sign(x) * Math.abs(x), cy: armY, cz: armZ, ax: 1, ay: 0, az: 0, t: t / sl.end, w: ss(0.02, 0.09, t) };
      }, (t) => THREE.MathUtils.lerp(sl.r0, sl.r1, Math.min(1, t)));
    }
    if (o.leg) roundLimb(S, o.leg.axis, o.leg.R);
    const floor = new Float32Array(S.count);
    for (let i = 0; i < S.count; i++) floor[i] = d[i] * 0.8;
    relax(S, nb, o.relax ?? 6, floor, 0.4);
    if (o.leg) roundLimb(S, o.leg.axis, o.leg.R);
    if (o.pelvisHem) toPelvis(S, base, crotch);
    if (o.chestNotNeck) {
      // a neckline rides on the chest: weights on the neck or head go to spine_03, so the edge
      // stays a clean line when the head nods or turns
      const nk = base.names.indexOf('neck_01'), hd = base.names.indexOf('Head'), ch = base.names.indexOf('spine_03');
      for (let i = 0; i < S.count; i++) {
        let moved = 0;
        for (let c = 0; c < 4; c++) {
          const j = S.si[i * 4 + c];
          if (j === nk || j === hd) {
            moved += S.sw[i * 4 + c];
            S.sw[i * 4 + c] = 0;
          }
        }
        if (moved) {
          const [ji, jw] = mixSkin([[S.si, S.sw, i, 1], [[ch, 0, 0, 0], [1, 0, 0, 0], 0, moved]]);
          for (let c = 0; c < 4; c++) {
            S.si[i * 4 + c] = ji[c];
            S.sw[i * 4 + c] = jw[c];
          }
        }
      }
    }
    o.post?.(S);
    // openings drawn on the cloth itself (a V, a jacket front) are measured on the shaped surface
    fields.forEach((fn, fi) => {
      if (!fn.onCloth) return;
      for (let i = 0; i < S.count; i++) S.f[fi][i] = fn(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2], -1);
    });
    S = clip(S, 0);
    nb = neighbours(S);
    edgeInfo(S);
    tidyEdges(S);
    const edges = boundary(S);
    const pieces = [];
    // hem treatment: extend downward-facing hems, turn in the rest
    const down = [], rest = [];
    for (const e of edges) {
      const yA = S.b[e[0] * 3 + 1], yB = S.b[e[1] * 3 + 1];
      const isHem = o.hemDir && Math.max(yA, yB) < o.hemY + 0.004 && Math.abs(S.b[e[0] * 3]) < shoulderX + 0.05;
      (isHem ? down : rest).push(e);
    }
    const extra = [];
    if (o.hemExt && down.length) {
      const ext = extendLoops(S, down, o.hemDir, o.hemExt, o.hemFlare ?? (o.leg ? 0.04 : 0.02));
      if (o.hemPelvis) for (const st of ext) for (const v of st.verts) if (v.ref === undefined) v.pelvis = o.hemPelvis;
      extra.push(...ext);
    }
    else rest.push(...down);
    // every other edge gets a turned band; the neck and cuffs of a trimmed top in the trim colour
    const lips = [];
    const trims = [];
    const nl = neckLoop(S);
    for (const loop of loops(rest)) {
      const isNeck = nl && loop.includes(nl[0]);
      const isCuff = Math.abs(S.b[loop[0] * 3]) > shoulderX + 0.04;
      if (o.collarNeck && isNeck) continue; // the collar finishes it
      if (o.band === false || (o.tucked && !isNeck && !isCuff)) {
        const chain = loop.map((v, k) => [v, loop[(k + 1) % loop.length]]);
        lips.push(...hemLips(S, loop.closed ? chain : chain.slice(0, -1)));
        continue;
      }
      const band = edgeBand(S, nb, loop, isNeck ? 0.014 : 0.012, isNeck ? 0.003 : 0.0025);
      (o.trim && (isNeck || isCuff) ? trims : lips).push(band);
      if (o.collarNeck || !isNeck) continue;
    }
    if (o.collarNeck && nl) lips.push(...hemLips(S, loops(rest).filter((l) => l.includes(nl[0]))));
    if (o.lapels) pieces.push(lapels(S, o.lapels));
    const g = geometryOf(S, { lips: [...lips, ...extra], group: o.group });
    pieces.unshift({ name, geometry: g, S });
    if (trims.length) pieces.push({ name: 'trim', geometry: stripsGeometry(S, trims) });
    return pieces;
  }

  /** the garment's edge loop round the neck, if it has one */
  function neckLoop(S) {
    const e = boundary(S).filter(([a]) => S.b[a * 3 + 1] > neck.y - 0.3 && Math.abs(S.b[a * 3]) < 0.13);
    return loops(e).sort((a, b) => b.length - a.length)[0] || null;
  }

  /**
   * Two clean lapels: each a smooth panel lying on the jacket front, from the button up the
   * opening's straight edge, widest under the collar with a small notch at the top.
   */
  function lapels(S, { button, edge, top }) {
    const front = [];
    for (let i = 0; i < S.count; i++) if (S.pos[i * 3 + 2] - spineZ(S.pos[i * 3 + 1]) > 0.0) front.push(i);
    // the lapel bridges the cloth under it: its depth is the highest cloth point within 3 cm
    const depth = (x, y) => {
      let z = -Infinity;
      for (const i of front) {
        const d2 = (S.pos[i * 3] - x) ** 2 + (S.pos[i * 3 + 1] - y) ** 2;
        if (d2 < 0.03 ** 2) z = Math.max(z, S.pos[i * 3 + 2]);
      }
      return z > -Infinity ? z : spineZ(y) + 0.12;
    };
    const nearest = (x, y, z) => {
      let best = 0, bd = Infinity;
      for (const i of front) {
        const d = (S.pos[i * 3] - x) ** 2 + (S.pos[i * 3 + 1] - y) ** 2 + (S.pos[i * 3 + 2] - z) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };
    const U = 14, V = 5;
    const pos = [], si = [], sw = [], tri = [];
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      for (let u = 0; u <= U; u++) {
        const t = u / U;
        const y = button + (top - button) * t;
        const x0 = edge(y) - 0.004; // tucked just inside the opening's edge
        // widest a little below the top, then a notch where it meets the collar
        const w = 0.072 * Math.sin((Math.PI / 2) * Math.min(1, t / 0.8)) * (t > 0.86 ? 1 - 2.2 * (t - 0.86) : 1);
        for (let v = 0; v <= V; v++) {
          const x = x0 + w * (v / V);
          const lift = 0.006 + 0.002 * Math.sin(Math.PI * (v / V)); // a soft roll across the lapel
          const z = depth(x, y) + lift;
          pos.push(side * x, y, z);
          const i = nearest(side * x, y, z);
          for (let c = 0; c < 4; c++) {
            si.push(S.si[i * 4 + c]);
            sw.push(S.sw[i * 4 + c]);
          }
        }
      }
      for (let u = 0; u < U; u++)
        for (let v = 0; v < V; v++) {
          const a = base + u * (V + 1) + v, b = a + 1, c = a + V + 2, d = a + V + 1;
          if (side > 0) tri.push(a, b, c, a, c, d);
          else tri.push(a, c, b, a, d, c);
        }
    }
    // the one button where the fronts meet
    const by = button - 0.012;
    const bz = depth(0, by) + 0.004;
    const bi = pos.length / 3;
    const R = 0.009, N = 12;
    pos.push(0, by, bz + 0.002);
    for (let k = 0; k < N; k++) pos.push(Math.cos((k / N) * Math.PI * 2) * R, by + Math.sin((k / N) * Math.PI * 2) * R, bz);
    const ib = nearest(0, by, bz);
    for (let k = 0; k <= N; k++)
      for (let c = 0; c < 4; c++) {
        si.push(S.si[ib * 4 + c]);
        sw.push(S.sw[ib * 4 + c]);
      }
    for (let k = 0; k < N; k++) tri.push(bi, bi + 1 + k, bi + 1 + ((k + 1) % N));
    return { name: 'lapels', geometry: rawGeometry(pos, si, sw, tri) };
  }
}

/** The strips (bands, trims) of a garment as their own geometry, skinned like the garment. */
function stripsGeometry(S, strips) {
  const pos = [], si = [], sw = [], tri = [];
  for (const st of strips) {
    const base = pos.length / 3;
    for (const v of st.verts) {
      const from = v.ref !== undefined ? v.ref : v.from;
      pos.push(...(v.ref !== undefined ? P3(S, v.ref) : v.p));
      for (let c = 0; c < 4; c++) {
        si.push(S.si[from * 4 + c]);
        sw.push(S.sw[from * 4 + c]);
      }
    }
    for (const t of st.tris) tri.push(base + t[0], base + t[1], base + t[2]);
  }
  return rawGeometry(pos, si, sw, tri);
}

let PELVIS = 0;
/** Give vertex `i` (in plain si/sw arrays) to the pelvis by `k`. */
function pelvisWeight(si, sw, i, k) {
  let has = -1;
  for (let c = 0; c < 4; c++) {
    sw[i * 4 + c] *= 1 - k;
    if (si[i * 4 + c] === PELVIS) has = c;
  }
  if (has < 0) {
    let m = 0;
    for (let c = 1; c < 4; c++) if (sw[i * 4 + c] < sw[i * 4 + m]) m = c;
    sw[i * 4 + m] = 0;
    si[i * 4 + m] = PELVIS;
    has = m;
  }
  sw[i * 4 + has] += k;
  let sum = 0;
  for (let c = 0; c < 4; c++) sum += sw[i * 4 + c];
  for (let c = 0; c < 4; c++) sw[i * 4 + c] /= sum;
}

/** Below the waist a jacket hangs from the pelvis, not from the thighs. */
function toPelvis(S, base, crotch) {
  const pelvis = base.names.indexOf('pelvis');
  const top = base.LM.pelvis.y + 0.03;
  for (let i = 0; i < S.count; i++) {
    const y = S.b[i * 3 + 1];
    const k = 0.75 * ss(top, crotch, y);
    if (k <= 0) continue;
    // scale the existing weights down and give the rest to the pelvis
    let has = -1;
    for (let c = 0; c < 4; c++) {
      S.sw[i * 4 + c] *= 1 - k;
      if (S.si[i * 4 + c] === pelvis) has = c;
    }
    if (has < 0) {
      // replace the smallest influence
      let m = 0;
      for (let c = 1; c < 4; c++) if (S.sw[i * 4 + c] < S.sw[i * 4 + m]) m = c;
      S.sw[i * 4 + m] = 0;
      S.si[i * 4 + m] = pelvis;
      has = m;
    }
    S.sw[i * 4 + has] += k;
    let sum = 0;
    for (let c = 0; c < 4; c++) sum += S.sw[i * 4 + c];
    for (let c = 0; c < 4; c++) S.sw[i * 4 + c] /= sum;
  }
}

/** A shirt collar: a stand round the neck and a fall folded over it, with points at the front. */
function collar(name, LM, topPart) {
  const S = topPart.S;
  const neck = LM.neck_01;
  const edges = boundary(S).filter(([a]) => S.b[a * 3 + 1] > neck.y - 0.25 && Math.abs(S.b[a * 3]) < 0.12);
  const loop = loops(edges).sort((a, b) => b.length - a.length)[0];
  if (!loop) return { name, geometry: new THREE.BufferGeometry() };
  // open the loop at the bottom of the front opening; keep the part above the opening's lower third
  let lo = 0;
  for (let i = 1; i < loop.length; i++) if (S.pos[loop[i] * 3 + 1] < S.pos[loop[lo] * 3 + 1]) lo = i;
  const ordered = loop.slice(lo).concat(loop.slice(0, lo));
  const keep = ordered.filter((i) => S.pos[i * 3 + 1] > neck.y - 0.085);
  const n = keep.length;
  if (n < 6) return { name, geometry: new THREE.BufferGeometry() };
  // the line the collar sits on, rounded off round the neck
  const cz = neck.z + 0.02;
  const smooth = lowPassLoop(ordered.map((i) => P3(S, i)), cz, 0.35);
  let P = ordered.map((i, k) => (keep.includes(i) ? smooth[k] : null)).filter(Boolean);
  const ring = (k, r, up, along = 0) => {
    const p = P[k];
    const dx = p[0], dz = p[2] - cz;
    const l = Math.hypot(dx, dz) || 1;
    return [p[0] + (dx / l) * r, p[1] + up - along, p[2] + (dz / l) * r];
  };
  const end = (k) => {
    const t = k / (n - 1);
    return Math.max(0, 1 - Math.min(t, 1 - t) * 4) ** 2; // 1 at the two front ends
  };
  const rings = [
    (k) => ring(k, -0.004, -0.004),
    (k) => ring(k, -0.006, 0.026 - 0.006 * end(k)), // the stand
    (k) => ring(k, -0.002, 0.029 - 0.006 * end(k)), // the fold
    (k) => ring(k, 0.016 + 0.008 * end(k), 0.006, 0.03 * end(k)), // the fall, down to points at the front
  ];
  const pos = [], si = [], sw = [], tri = [];
  for (let r = 0; r < rings.length; r++)
    for (let k = 0; k < n; k++) {
      pos.push(...rings[r](k));
      for (let c = 0; c < 4; c++) {
        si.push(S.si[keep[k] * 4 + c]);
        sw.push(S.sw[keep[k] * 4 + c]);
      }
    }
  for (let r = 0; r + 1 < rings.length; r++)
    for (let k = 0; k + 1 < n; k++) {
      const a = r * n + k, b = r * n + k + 1, c = (r + 1) * n + k + 1, d = (r + 1) * n + k;
      tri.push(a, c, b, a, d, c);
    }
  return { name, geometry: rawGeometry(pos, si, sw, tri) };
}

/** A tie: a knot at the collar and a blade lying down the shirt front to the belt, pointed at the tip. */
function tie(name, LM, topPart, waistY) {
  const S = topPart.S;
  const front = [];
  for (let i = 0; i < S.count; i++) if (S.pos[i * 3 + 2] > LM.spine_03.z + 0.04) front.push(i);
  const near = (x, y) => {
    let zs = 0, ws = 0, best = front[0], bd = Infinity;
    for (const i of front) {
      const d2 = (S.pos[i * 3] - x) ** 2 + (S.pos[i * 3 + 1] - y) ** 2;
      if (d2 < bd) {
        bd = d2;
        best = i;
      }
      if (d2 > 0.035 ** 2) continue;
      const w = 1 - Math.sqrt(d2) / 0.035;
      zs += S.pos[i * 3 + 2] * w;
      ws += w;
    }
    return { z: ws ? zs / ws : S.pos[best * 3 + 2], i: best };
  };
  // the knot sits in the collar's opening, at the top of the shirt front
  let yTop = -Infinity;
  for (const i of front) if (Math.abs(S.pos[i * 3]) < 0.01) yTop = Math.max(yTop, S.pos[i * 3 + 1]);
  const y0 = yTop - 0.004;
  const pos = [], si = [], sw = [], tri = [];
  const vert = (x, y, z, i) => {
    pos.push(x, y, z);
    for (let c = 0; c < 4; c++) {
      si.push(S.si[i * 4 + c]);
      sw.push(S.sw[i * 4 + c]);
    }
    return pos.length / 3 - 1;
  };
  // knot: a small tapered block
  const kH = 0.034, kz = near(0, y0 - kH / 2).z + 0.009;
  const kb = [];
  for (const [y, w, d] of [[y0, 0.024, 0.014], [y0 - kH, 0.014, 0.01]])
    for (const [sx, sz] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) kb.push(vert(sx * w, y, kz - 0.006 + sz * d, near(0, y).i));
  const quad = (a, b, c, d) => tri.push(a, b, c, a, c, d);
  quad(kb[3], kb[2], kb[6], kb[7]); // front
  quad(kb[0], kb[3], kb[7], kb[4]);
  quad(kb[2], kb[1], kb[5], kb[6]);
  quad(kb[3], kb[0], kb[1], kb[2]); // top
  // blade: three columns (edges and a slight centre ridge), widening down to a point
  const yEnd = waistY + 0.03;
  const N = 16;
  const rows = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const y = y0 - kH + 0.004 - (y0 - kH - yEnd) * t;
    const w = 0.02 + 0.022 * t;
    const row = [];
    for (const [x, lift] of [[-w, 0.004], [0, 0.0065], [w, 0.004]]) {
      const n = near(x, y);
      row.push(vert(x, y, n.z + lift, n.i));
    }
    rows.push(row);
  }
  for (let k = 0; k < N; k++) for (let c = 0; c < 2; c++) quad(rows[k][c], rows[k][c + 1], rows[k + 1][c + 1], rows[k + 1][c]);
  const last = rows[N];
  const tipN = near(0, yEnd - 0.035);
  const tip = vert(0, yEnd - 0.035, tipN.z + 0.005, tipN.i);
  tri.push(last[0], last[1], tip, last[1], last[2], tip);
  return { name, geometry: rawGeometry(pos, si, sw, tri) };
}

function rawGeometry(pos, si, sw, tri) {
  const P = Float32Array.from(pos);
  const T = Uint32Array.from(tri);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normalsOf(P, T, P.length / 3), 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(si), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(sw), 4));
  g.setIndex(new THREE.BufferAttribute(T, 1));
  g.computeBoundingSphere();
  return g;
}

/** A belt band over the trousers' waist. */
function belt(name, bottomPart, waistY) {
  const S = bottomPart.S;
  const edges = boundary(S).filter(([a, b]) => Math.abs(S.b[a * 3 + 1] - (waistY + 0.01)) < 0.03 && Math.abs(S.b[b * 3 + 1] - (waistY + 0.01)) < 0.03);
  const loop = loops(edges).sort((a, b) => b.length - a.length)[0];
  if (!loop) return { name, geometry: new THREE.BufferGeometry() };
  let cx = 0, cz = 0;
  for (const i of loop) {
    cx += S.pos[i * 3];
    cz += S.pos[i * 3 + 2];
  }
  cx /= loop.length;
  cz /= loop.length;
  const ring = (dy, dr) => (i) => {
    const p = P3(S, i);
    const dx = p[0] - cx, dz = p[2] - cz;
    const l = Math.hypot(dx, dz) || 1;
    return [p[0] + (dx / l) * dr, p[1] + dy, p[2] + (dz / l) * dr];
  };
  const s = strip(S, loop, [ring(-0.006, 0.0), ring(-0.008, 0.005), ring(-0.04, 0.005), ring(-0.042, 0.0)], { flip: true });
  const pos = [], si = [], sw = [], tri = [];
  s.verts.forEach((v) => {
    pos.push(...v.p);
    for (let c = 0; c < 4; c++) {
      si.push(S.si[v.from * 4 + c]);
      sw.push(S.sw[v.from * 4 + c]);
    }
  });
  for (const t of s.tris) tri.push(...t);
  return { name, geometry: rawGeometry(pos, si, sw, tri) };
}


/**
 * Shoes: a shoe last per foot, sized from the foot's own vertices, with a sole slab under it.
 * The heel rides on the foot bone and the toe box on the ball bone, so the shoe bends at the ball.
 */
function shoes(base) {
  const { welded: W, names, LM } = base;
  const out = { upper: { pos: [], si: [], sw: [], tri: [] }, sole: { pos: [], si: [], sw: [], tri: [] } };
  const NZ = 26; // sections heel → toe
  const NA = 28; // points round each section
  for (const s of ['r', 'l']) {
    const foot = names.indexOf(`foot_${s}`);
    const ball = names.indexOf(`ball_${s}`);
    const sx = s === 'r' ? -1 : 1;
    // the foot's own vertices below the ankle
    const pts = [];
    for (let i = 0; i < W.count; i++) {
      if (W.foot[i] < 0.5 || Math.sign(W.pos[i * 3]) !== sx) continue;
      if (W.pos[i * 3 + 1] > LM.foot_r.y + 0.03) continue;
      pts.push([W.pos[i * 3], W.pos[i * 3 + 1], W.pos[i * 3 + 2]]);
    }
    let z0 = Infinity, z1 = -Infinity, cx = 0;
    for (const p of pts) {
      z0 = Math.min(z0, p[2]);
      z1 = Math.max(z1, p[2]);
      cx += p[0];
    }
    cx /= pts.length;
    z0 -= 0.012;
    z1 += 0.02;
    const ballZ = LM.ball_r.z;
    // per section: half width, top and centre from the foot slice, smoothed heel → toe
    const sec = [];
    for (let k = 0; k < NZ; k++) {
      const z = z0 + ((z1 - z0) * k) / (NZ - 1);
      let w = 0, top = 0, xm = 0, n = 0;
      for (const p of pts) {
        if (Math.abs(p[2] - z) > 0.02) continue;
        w = Math.max(w, Math.abs(p[0] - cx));
        top = Math.max(top, p[1]);
        xm += p[0];
        n++;
      }
      sec.push({ z, w, top, x: n ? xm / n : cx });
    }
    for (let it = 0; it < 4; it++) for (let k = 1; k < NZ - 1; k++) for (const key of ['w', 'top', 'x']) sec[k][key] = (sec[k - 1][key] + 2 * sec[k][key] + sec[k + 1][key]) / 4;
    for (let k = 0; k < NZ; k++) {
      const t = k / (NZ - 1);
      const c = sec[k];
      // rounded heel and toe, a low toe box, the collar just over the ankle
      const round = Math.min(1, Math.sqrt(Math.min(t, 1 - t) * 9));
      c.w = (Math.max(c.w, 0.03) + 0.008) * (0.3 + 0.7 * round);
      c.top = Math.min(Math.max(c.top + 0.008, 0.045) * (1 - 0.35 * ss(0.75, 1, t)), LM.foot_r.y + 0.03);
      c.bot = 0.004;
    }
    const toe = (z) => ss(ballZ - 0.035, ballZ + 0.01, z);
    for (const [part, grow, slab] of [['upper', 0, false], ['sole', 0.005, true]]) {
      const P = out[part];
      const base0 = P.pos.length / 3;
      const skin = (z) => {
        const t = toe(z);
        P.si.push(foot, ball, 0, 0);
        P.sw.push(1 - t, t, 0, 0);
      };
      for (let k = 0; k < NZ; k++) {
        const c = sec[k];
        const y0 = slab ? -0.013 : c.bot;
        const y1 = slab ? 0.012 : c.top;
        for (let a = 0; a < NA; a++) {
          const ang = (a / NA) * Math.PI * 2;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          // a superellipse: flat underneath, rounded over the top
          const ex = Math.sign(ca) * Math.abs(ca) ** 0.55;
          const ey = Math.sign(sa) * Math.abs(sa) ** (sa < 0 ? 0.25 : 0.8);
          P.pos.push(c.x + ex * (c.w + grow), (y0 + y1) / 2 + (ey * (y1 - y0)) / 2, c.z + (k === 0 ? -grow : k === NZ - 1 ? grow : 0));
          skin(c.z);
        }
      }
      for (let k = 0; k + 1 < NZ; k++)
        for (let a = 0; a < NA; a++) {
          const a2 = (a + 1) % NA;
          const i = base0 + k * NA + a, j = base0 + k * NA + a2, m = base0 + (k + 1) * NA + a2, n = base0 + (k + 1) * NA + a;
          P.tri.push(i, m, j, i, n, m);
        }
      // caps at the heel and the toe
      for (const k of [0, NZ - 1]) {
        const c = sec[k];
        const ci = P.pos.length / 3;
        P.pos.push(c.x, slab ? 0 : (c.bot + c.top) / 2, c.z + (k === 0 ? -grow : grow));
        skin(c.z);
        for (let a = 0; a < NA; a++) {
          const a2 = (a + 1) % NA;
          if (k === 0) P.tri.push(ci, base0 + a, base0 + a2);
          else P.tri.push(ci, base0 + k * NA + a2, base0 + k * NA + a);
        }
      }
    }
  }
  return [
    { name: 'shoes', geometry: rawGeometry(out.upper.pos, out.upper.si, out.upper.sw, out.upper.tri) },
    { name: 'sole', geometry: rawGeometry(out.sole.pos, out.sole.si, out.sole.sw, out.sole.tri) },
  ];
}
