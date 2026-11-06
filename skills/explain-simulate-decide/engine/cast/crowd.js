// Crowd: 100 small people in a 10 × 10 block. Shows a share of people (a value in %):
// that many stand lit in colour, the rest stay pale. Given several shares (groups), one
// crowd shows every outcome at once, each in its own colour: one part instead of four. Made for chances and risks
// ("out of 100 people like you, 4 will…"), which people read far better than percents.
import { clay, mesh, group, rounded, torus, cone, PALETTE, THREE, clamp01 } from './kit.js';
import { CROWD_COLORS } from './names.js';

const N = 10;
const GAP = 0.3;

function figure() {
  // one small pawn: body and head, merged so 100 of them stay cheap
  const body = new THREE.CapsuleGeometry(0.075, 0.16, 4, 12).translate(0, 0.16, 0);
  const head = new THREE.SphereGeometry(0.068, 16, 12).translate(0, 0.37, 0);
  const pos = [...body.attributes.position.array, ...head.attributes.position.array];
  const nrm = [...body.attributes.normal.array, ...head.attributes.normal.array];
  const off = body.attributes.position.count;
  const idx = [...body.index.array, ...head.index.array.map((i) => i + off)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export default function build({ tint = PALETTE.terracotta } = {}) {
  const object = group();
  const side = (N - 1) * GAP;
  object.add(mesh(rounded(side + 0.5, 0.06, side + 0.5, 0.05), clay(PALETTE.cream), { y: 0.03 }));
  const geo = figure();
  const pale = clay('#d8d0c2');
  const tints = tint === PALETTE.terracotta ? CROWD_COLORS : [tint, ...CROWD_COLORS.slice(1)];
  // one instanced block per colour (index 0 = nobody), each with room for all 100
  const layers = [pale, ...tints.map((c) => clay(c, { emissive: 0.18 }))].map((mat) => {
    const im = new THREE.InstancedMesh(geo, mat, N * N);
    im.castShadow = true;
    im.receiveShadow = true;
    object.add(im);
    return im;
  });
  const m4 = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  // lit people fill from the front row, left to right, so "4 in 100" reads as a small cluster
  const place = (i) => {
    const row = Math.floor(i / N);
    const col = i % N;
    return new THREE.Vector3(-side / 2 + col * GAP, 0.06, side / 2 - row * GAP);
  };
  // "you": a ring at the feet and a marker above one person, so the viewer sees themself among the 100
  const youMat = clay(PALETTE.ink, { emissive: 0.05 });
  const you = group();
  you.add(mesh(torus(0.11, 0.018, 32), youMat, { y: 0.075, rx: Math.PI / 2 }));
  you.add(mesh(cone(0.06, 0.12, 16), youMat, { y: 0.62, rx: Math.PI }));
  you.visible = false;
  object.add(you);
  /**
   * @param {number[]} shares each 0..1 of the crowd, filled in order
   * @param {number|null} [youIn] the group the viewer stands in; they are marked as its first person
   */
  const setGroups = (shares, youIn = null) => {
    const ends = [];
    let total = 0;
    for (const sh of shares.slice(0, tints.length)) ends.push((total = Math.min(N * N, total + Math.round(clamp01(sh) * N * N))));
    for (let i = 0; i < N * N; i++) {
      const g = ends.findIndex((e) => i < e) + 1; // 0 = pale
      const p = place(i);
      m4.makeTranslation(p.x, p.y + (g ? 0.02 : 0), p.z);
      layers.forEach((im, k) => im.setMatrixAt(i, k === g ? m4 : hidden));
    }
    layers.forEach((im) => (im.instanceMatrix.needsUpdate = true));
    const first = youIn === null ? -1 : youIn === 0 ? 0 : ends[youIn - 1] ?? -1;
    you.visible = youIn !== null && first >= 0 && first < (ends[youIn] ?? 0);
    if (you.visible) {
      const p = place(first);
      you.position.set(p.x, 0, p.z);
    }
  };
  return {
    object,
    height: 0.9,
    footprint: side / 2 + 0.45,
    anchor: new THREE.Vector3(0, 0.55, 0),
    /** Takes the real share 0..1 (40% → 0.4), not a position in a range. */
    percent: true,
    setValue(v) {
      setGroups([v]);
    },
    setGroups,
  };
}
