// Builds the story world from its plan (world.js): the places the film visits, joined up
// as one street. The hero's house is its rooms side by side, with doorways between them,
// a front door, a garden path and a gate. Clinics and labs get wings either side; model
// and facade places stand across the road. Neighbours, lamps and trees fill the rest, so
// the street reads as a real one. Rooms stay cut away on the north, where the camera is.
//
// Returns the scene graph, plus the things the director moves each frame: door leaves,
// and occluders (walls, houses, trees) it fades when they come between camera and hero.
import { clay, rounded, cylinder, mesh, group, canvasTexture, FONT, THREE } from '../cast/kit.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import { SET_BUILDERS } from './index.js';
import { lamp } from './postbox.js';
import { wall, floor, floorTexture, plant, SET_PALETTE, WALL_T } from './parts.js';
import { STUDIO_LOOK } from '../look.js';

const BLOCK_TOP = -0.012; // the ground the street stands on, just under the floors
const ROAD_Y = -0.12;
const NAVY = '#2c3e5c';

const hash = (i, k = 1) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function box(w, h, d, mat, { x = 0, y = 0, z = 0, ry = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** A pitched roof over a w × d box, ridge along x, eaves at y = 0. */
function roof(w, d, rise, mat) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2 - 0.25, 0);
  s.lineTo(d / 2 + 0.25, 0);
  s.lineTo(0, rise);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w + 0.3, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-(w + 0.3) / 2, 0, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function labelTexture(text, { bg = '#ffffff', fg = NAVY, w = 1024, h = 192 } = {}) {
  return canvasTexture(w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = fg;
    let size = Math.round(h * 0.5);
    c.font = `700 ${size}px ${FONT}`;
    while (c.measureText(text).width > w * 0.9 && size > 12) c.font = `700 ${(size -= 4)}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2 + 2);
  }).tex;
}

/** A plane showing a texture, facing +z. */
function panel(w, h, tex, { emissive = 0.15 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: emissive }));
  m.receiveShadow = true;
  return m;
}

/** A window on a facade, facing +z: white frame, pale glass. */
function windowOn(w, h, frameMat, glassMat) {
  const g = group();
  g.add(box(w + 0.12, h + 0.12, 0.06, frameMat, { shadow: false }));
  g.add(box(w, h, 0.07, glassMat, { shadow: false }));
  g.add(box(0.05, h, 0.08, frameMat, { shadow: false }));
  return g;
}

/** A street tree: a trunk and a few soft leaf clusters. */
function tree(h, seed) {
  const g = group();
  const trunk = clay('#8a6f58');
  g.add(mesh(cylinder(0.09, 0.14, h * 0.55, 10), trunk, { y: h * 0.275 }));
  const leaves = [clay(SET_PALETTE.leaf), clay(SET_PALETTE.leafDark), clay(SET_PALETTE.leafLight)];
  const blobs = [[0, 0.68, 0, 0.3], [0.18, 0.78, 0.1, 0.24], [-0.17, 0.82, -0.08, 0.25], [0.02, 0.94, 0.04, 0.2]];
  blobs.forEach(([x, y, z, r], i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * h * (0.9 + 0.2 * hash(seed, i)), 1), leaves[(i + seed) % 3]);
    m.position.set(x * h, y * h, z * h);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  });
  return g;
}

/** A neighbour's house: rendered walls, a pitched roof, windows front and back, a door on the street side. */
function house(w, d, seed, { streetSide = 1 } = {}) {
  const g = group();
  const tints = ['#f6f3ee', '#f1f3f5', '#f4efe8', '#eef2ef', '#f7f2ea'];
  const roofs = ['#9aa3ad', '#b39c8c', '#8e98a3', '#a8a39b'];
  const tall = hash(seed, 2) > 0.45;
  const H = tall ? 5.4 : 2.9;
  const body = clay(tints[Math.floor(hash(seed, 1) * tints.length)]);
  g.add(box(w, H, d, body, { y: H / 2 }));
  const r = roof(w, d, 1.5 + hash(seed, 3) * 0.8, clay(roofs[Math.floor(hash(seed, 4) * roofs.length)]));
  r.position.y = H;
  g.add(r);
  g.add(box(0.5, 1.1, 0.6, body, { x: w * (hash(seed, 5) - 0.5) * 0.6, y: H + 1.2, z: -d * 0.15 }));
  const frame = clay('#ffffff');
  const glass = new THREE.MeshStandardMaterial({ color: '#b9c9d6', roughness: 0.25, metalness: 0.1 });
  const floors = tall ? [1.4, 4.0] : [1.45];
  for (const side of [1, -1]) {
    const n = Math.max(1, Math.floor(w / 2.4));
    for (const y of floors)
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * (w / n);
        if (side === streetSide && y < 2 && i === Math.floor(n / 2)) continue; // the door goes here
        const win = windowOn(0.95, 1.05, frame, glass);
        win.position.set(x, y, (side * d) / 2);
        if (side < 0) win.rotation.y = Math.PI;
        g.add(win);
      }
  }
  // front door with a step
  const n = Math.max(1, Math.floor(w / 2.4));
  const dx = -w / 2 + (Math.floor(n / 2) + 0.5) * (w / n);
  const doorCols = ['#2c3e5c', '#3f6b5c', '#8a3b3b', '#e2a33b', '#2f5f8f'];
  const door = box(0.95, 2.05, 0.08, clay(doorCols[Math.floor(hash(seed, 6) * doorCols.length)]), { x: dx, y: 1.03, z: (streetSide * d) / 2 });
  g.add(door);
  g.add(box(1.3, 0.12, 0.45, clay('#d6d9dc'), { x: dx, y: 0.06, z: streetSide * (d / 2 + 0.2) }));
  g.userData.door = dx;
  return g;
}

/** A low garden wall with a coping and a hedge behind it, from x0 to x1 along z, with gaps for gates. */
function gardenWall(x0, x1, z, gates, { hedge = true, behind = -1 } = {}) {
  const g = group();
  const render = clay('#f3f1ee');
  const coping = clay('#d6d9dc');
  const leaf = [clay(SET_PALETTE.leafDark), clay(SET_PALETTE.leaf)];
  const cuts = [...gates].sort((a, b) => a - b);
  let a = x0;
  const run = (p, q) => {
    const w = q - p;
    if (w < 0.1) return;
    g.add(box(w, 0.62, 0.22, render, { x: (p + q) / 2, y: 0.31, z }));
    g.add(box(w + 0.04, 0.06, 0.28, coping, { x: (p + q) / 2, y: 0.65, z }));
    if (hedge) {
      const n = Math.max(1, Math.round(w / 0.9));
      for (let i = 0; i < n; i++) g.add(mesh(rounded(w / n + 0.05, 0.55, 0.5, 0.2, 2), leaf[i % 2], { x: p + (i + 0.5) * (w / n), y: 0.62 + 0.27, z: z + behind * 0.4 }));
    }
  };
  for (const c of cuts) {
    run(a, c - 0.6);
    for (const px of [c - 0.6, c + 0.6]) g.add(box(0.2, 0.85, 0.26, render, { x: px, y: 0.425, z }));
    a = c + 0.6;
  }
  run(a, x1);
  return g;
}

/** A sign on two posts, readable from both sides. */
function postSign(text, { w = 2.2, color = '#1f63b5' } = {}) {
  const g = group();
  const post = clay('#c3ccd5');
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) g.add(mesh(cylinder(0.05, 0.05, 2.3, 10), post, { x, y: 1.15 }));
  g.add(box(w, 0.6, 0.08, clay(color), { y: 2.0 }));
  const tex = labelTexture(text, { bg: color, fg: '#ffffff' });
  for (const s of [1, -1]) {
    const p = panel(w - 0.12, 0.48, tex, { emissive: 0.05 });
    p.position.set(0, 2.0, s * 0.045);
    if (s < 0) p.rotation.y = Math.PI;
    g.add(p);
  }
  return g;
}

/** A plain civic building front that can carry a picture and a name. Front faces +z. */
async function facadeBuilding(def, w, d, accent) {
  const g = group();
  const stone = clay('#f1ede6');
  const H = 7.2;
  g.add(box(w, H, d, stone, { y: H / 2, z: -d / 2 }));
  g.add(box(w + 0.2, 0.25, d + 0.2, clay('#d8d3ca'), { y: H + 0.12, z: -d / 2 }));
  const frame = clay('#ffffff');
  const glass = new THREE.MeshStandardMaterial({ color: '#aebfcc', roughness: 0.2, metalness: 0.15 });
  // ground floor: the entrance in the middle, a canopy, windows either side
  g.add(box(1.6, 2.6, 0.2, new THREE.MeshStandardMaterial({ color: '#2b3440', roughness: 0.3, metalness: 0.2 }), { y: 1.3, z: 0.02 }));
  g.add(box(0.05, 2.5, 0.22, frame, { y: 1.27, z: 0.03 }));
  g.add(box(2.6, 0.14, 1.4, clay(accent), { y: 2.85, z: 0.7 }));
  for (const x of [-1, 1]) {
    for (let i = 0; i < Math.floor((w / 2 - 1.8) / 1.9); i++) {
      const win = windowOn(1.2, 1.5, frame, glass);
      win.position.set(x * (2.1 + i * 1.9), 1.5, 0.02);
      g.add(win);
    }
  }
  // the name, in a band above the entrance
  const name = def.label || def.id;
  const band = panel(Math.min(w - 1, 6), 0.6, labelTexture(name, { bg: '#ffffff', fg: NAVY }), { emissive: 0.1 });
  band.position.set(0, 3.45, 0.03);
  g.add(band);
  // upper floors: a picture of the real place, if there is one, with windows either side
  let picW = 0;
  if (def.image) {
    try {
      const tex = await new THREE.TextureLoader().loadAsync(def.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const aspect = tex.image.width / Math.max(1, tex.image.height);
      const ph = Math.min(3.0, (w * 0.62) / aspect);
      picW = ph * aspect;
      g.add(box(picW + 0.24, ph + 0.24, 0.08, clay('#ffffff'), { y: 4.0 + ph / 2 + 0.05, z: 0.02 }));
      const pic = panel(picW, ph, tex, { emissive: 0.12 });
      pic.position.set(0, 4.0 + ph / 2 + 0.05, 0.07);
      g.add(pic);
    } catch (e) {
      console.warn(`place "${def.id}": could not load its picture (${e.message || e})`);
    }
  }
  for (const x of [-1, 1]) {
    for (let i = 0; ; i++) {
      const cx = picW ? picW / 2 + 1.0 + i * 1.7 : 0.85 + i * 1.7;
      if (cx > w / 2 - 0.7) break;
      for (const y of [4.6, 6.1]) {
        const win = windowOn(1.0, 1.1, frame, glass);
        win.position.set(x * cx, y, 0.02);
        g.add(win);
      }
    }
  }
  return g;
}

/** A hunted glTF model, scaled into its lot with its front (+z in the file) facing the street. */
async function modelBuilding(def, w, d) {
  const gltf = await new GLTFLoader().loadAsync(def.url);
  const model = gltf.scene;
  const b = new THREE.Box3().setFromObject(model);
  const size = b.getSize(new THREE.Vector3());
  const s = Math.min((w - 0.6) / Math.max(size.x, 1e-3), d / Math.max(size.z, 1e-3), 14 / Math.max(size.y, 1e-3));
  model.scale.setScalar(s);
  const c = b.getCenter(new THREE.Vector3()).multiplyScalar(s);
  // the front edge of the model sits on the building line (z = 0), the rest behind it
  model.position.set(-c.x, -b.min.y * s, -(b.max.z * s));
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  const g = group();
  g.add(model);
  return g;
}

/**
 * Build the world.
 * @param {any} world from planWorld()
 * @param {{accent?: string}} [o]
 * @returns {Promise<{object: THREE.Group, occluders: Array<{object: THREE.Object3D, box: THREE.Box3, mats: THREE.Material[]}>, doors: Array<{at: number[], leaf: THREE.Object3D, swing: number}>}>}
 */
export async function buildWorld(world, { accent = '#3b5b92' } = {}) {
  const root = group();
  root.name = 'world';
  const S = world.street;
  const occ = []; // objects that may come between camera and hero
  const doors = [];
  const [X0, X1] = world.extent;
  const L = X1 - X0;
  const CX = (X0 + X1) / 2;

  // ---- the ground: a raised block either side of a sunken road, pavements, kerbs
  const ground = new THREE.MeshStandardMaterial({ color: STUDIO_LOOK.floor, roughness: 1 });
  const block = (z0, z1) => {
    const m = box(L + 40, 0.2, z1 - z0, ground, { x: CX, y: BLOCK_TOP - 0.1, z: (z0 + z1) / 2, shadow: false });
    root.add(m);
  };
  block(-60, S.kerbN);
  block(S.kerbS, 80);
  const slabs = (z0, z1) => {
    const tex = floorTexture('slabs', '#e4e6e9', '#cfd3d8', { repeat: [L / 1.4, (z1 - z0) / 1.4] });
    const m = box(L, 0.04, z1 - z0, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { x: CX, y: -0.02, z: (z0 + z1) / 2, shadow: false });
    root.add(m);
  };
  slabs(S.gardenN + 0.12, S.kerbN);
  slabs(S.kerbS, S.gardenS - 0.12);
  const kerb = clay('#cdd2d7');
  for (const z of [S.kerbN, S.kerbS]) root.add(box(L, 0.14, 0.16, kerb, { x: CX, y: -0.06, z, shadow: false }));
  const road = box(L + 40, 0.1, S.kerbS - S.kerbN, new THREE.MeshStandardMaterial({ color: '#8b9198', roughness: 0.95 }), { x: CX, y: ROAD_Y - 0.05, z: (S.kerbN + S.kerbS) / 2, shadow: false });
  root.add(road);
  const paint = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.8 });
  const crossings = world.sites.filter((s) => s.crossing !== undefined).map((s) => s.crossing);
  const mid = (S.kerbN + S.kerbS) / 2;
  for (let x = X0; x < X1; x += 4) if (!crossings.some((c) => Math.abs(c - x) < 2.5)) root.add(box(2, 0.01, 0.14, paint, { x, y: ROAD_Y + 0.005, z: mid, shadow: false }));
  for (const c of crossings) for (let z = S.kerbN + 0.5; z < S.kerbS - 0.3; z += 0.8) root.add(box(2.6, 0.01, 0.45, paint, { x: c, y: ROAD_Y + 0.005, z: z + 0.2, shadow: false }));

  // ---- the places
  const lawn = new THREE.MeshStandardMaterial({ color: '#e3ebdc', roughness: 1 });
  const paving = new THREE.MeshStandardMaterial({ map: floorTexture('slabs', '#dfe2e5', '#c6cbd0', { repeat: [3, 3] }), roughness: 0.9 });
  const setOf = {}; // place id → built set
  const addSet = (id) => {
    const p = world.places[id];
    const s = SET_BUILDERS[p.set]({ shell: false });
    s.object.position.set(p.origin[0], 0, p.origin[1]);
    s.object.rotation.y = p.rot;
    root.add(s.object);
    setOf[id] = s;
    if (s.walls?.back) occ.push({ object: s.walls.back, kind: 'wall', set: s });
    (s.doors || []).forEach((d, index) => {
      const at = world.doors.find((w) => w.place === id && w.index === index)?.at;
      if (d.leaf && at) doors.push({ place: id, leaf: d.leaf, swing: d.swing ?? -1, at });
    });
    return s;
  };
  const wallColor = '#f7f7f5';
  for (const w of world.walls) {
    if (w.by !== 'world' || w.kind === 'boundary') continue;
    if (w.kind === 'front' && w.h > 3) continue; // a south-row building front: the building itself is the wall
    const o = wall(w.a[0], w.a[1], w.b[0], w.b[1], { h: w.h, color: wallColor, openings: w.openings.map((op) => ({ ...op, y0: 0, y1: 2.15 })) });
    root.add(o);
    occ.push({ object: o, kind: 'wall' });
  }
  const signs = { hospital: 'Health Centre', lab: 'Screening Lab' };
  for (const site of world.sites) {
    if (site.kind === 'house') {
      for (const r of Object.values(site.rooms)) addSet(r.id);
      // front garden: a path to the gate, lawn either side, a low wall along the pavement
      const pw = 1.1;
      root.add(box(pw, 0.03, S.gardenN, paving, { x: site.door, y: -0.0, z: S.gardenN / 2, shadow: false }));
      for (const [a, b] of [[site.x0, site.door - pw / 2], [site.door + pw / 2, site.x1]]) root.add(box(b - a - 0.1, 0.02, S.gardenN - 0.3, lawn, { x: (a + b) / 2, y: -0.005, z: S.gardenN / 2, shadow: false }));
      const gw = gardenWall(site.x0, site.x1, S.gardenN, [site.door], { hedge: false });
      root.add(gw);
      occ.push({ object: gw, kind: 'low' });
      for (const x of [site.x0 + 1.2, site.x1 - 1.2]) {
        const sh = plant(1.1, { pot: '#e9ecef' });
        sh.position.set(x, 0, 1.0);
        root.add(sh);
      }
      // the front step
      root.add(box(1.4, 0.1, 0.4, clay('#d6d9dc'), { x: site.door, y: 0.05, z: 0.26 }));
    } else if (site.kind === 'building') {
      const id = site.places[0];
      addSet(id);
      const depth = site.depth;
      const wingMat = clay('#eef2f6');
      const band = clay(site.set === 'hospital' ? '#1f63b5' : '#0e7c7b');
      const glass = new THREE.MeshStandardMaterial({ color: '#b5c7d6', roughness: 0.25 });
      const frame = clay('#ffffff');
      for (const [a, b] of [[site.x0, site.lobby ? site.lobby[0] : site.room[0]], [site.room[1], site.x1]]) {
        const wg = group();
        wg.add(box(b - a, 3.4, depth, wingMat, { x: (a + b) / 2, y: 1.7, z: -depth / 2 }));
        wg.add(box(b - a + 0.1, 0.18, depth + 0.1, band, { x: (a + b) / 2, y: 3.45, z: -depth / 2 }));
        for (const z of [-depth - 0.01, 0.01]) {
          const win = windowOn(b - a - 1.0, 1.1, frame, glass);
          win.position.set((a + b) / 2, 1.6, z);
          if (z < 0) win.rotation.y = Math.PI;
          wg.add(win);
        }
        root.add(wg);
        occ.push({ object: wg, kind: 'solid' });
      }
      if (site.lobby) {
        const [a, b] = site.lobby;
        root.add(floor(b - a, depth, { x: (a + b) / 2, z: -depth / 2, map: floorTexture('tiles', '#e7ebef', '#d2d8de', { repeat: [1.5, 2.2] }) }));
        const pl = plant(1.0, { pot: '#ffffff', tall: true });
        pl.position.set(a + 0.45, 0, -depth + 0.6);
        root.add(pl);
      }
      root.add(box(site.x1 - site.x0, 0.03, S.gardenN, paving, { x: (site.x0 + site.x1) / 2, y: -0.0, z: S.gardenN / 2, shadow: false }));
      const gw = gardenWall(site.x0, site.x1, S.gardenN, [site.door], { hedge: false });
      root.add(gw);
      occ.push({ object: gw, kind: 'low' });
      const label = world.defs[id]?.label || signs[site.set] || id;
      const sg = postSign(label, { color: site.set === 'hospital' ? '#1f63b5' : '#0e7c7b' });
      sg.position.set(site.door + 2.4, 0, 1.1);
      root.add(sg);
      occ.push({ object: sg, kind: 'solid' });
    } else if (site.kind === 'street') {
      addSet(site.places[0]);
    } else {
      // a model or facade across the road
      const id = site.places[0];
      const def = world.defs[id];
      const p = world.places[id];
      const w = site.x1 - site.x0;
      let b = null;
      if (def.kind === 'model' && def.url) {
        try {
          b = await modelBuilding(def, w, p.depth);
        } catch (e) {
          console.warn(`place "${id}": could not load its model (${e.message || e}); showing a plain building instead`);
        }
      }
      if (!b) b = await facadeBuilding(def, w - 0.6, p.depth, accent);
      b.position.set(site.door, 0, S.facadeS + (def.kind === 'model' ? 0 : 0));
      b.rotation.y = Math.PI; // its front faces north, across the road
      root.add(b);
      occ.push({ object: b, kind: 'solid' });
      root.add(box(w, 0.03, S.facadeS - S.gardenS, paving, { x: site.door, y: -0.0, z: (S.gardenS + S.facadeS) / 2, shadow: false }));
      const gw = gardenWall(site.x0, site.x1, S.gardenS, [site.door], { hedge: false });
      root.add(gw);
      if (site.desk !== null && site.desk !== undefined) {
        // a reception desk by the door, where a visitor can hand something over or ask
        const desk = group();
        desk.add(box(1.5, 1.0, 0.55, clay('#ffffff'), { y: 0.5 }));
        desk.add(box(1.6, 0.05, 0.62, clay(NAVY), { y: 1.02 }));
        desk.add(box(1.5, 0.12, 0.02, clay(accent), { y: 0.85, z: -0.29 }));
        desk.position.set(site.desk, 0, S.facadeS - 1.12 + 0.0);
        root.add(desk);
      }
      if (def.kind === 'model') {
        const sg = postSign(def.label || id, { color: accent });
        sg.position.set(site.x0 + 1.4, 0, S.gardenS + 0.8);
        root.add(sg);
      }
    }
  }

  // ---- neighbours on both sides of the road, each with a front garden wall
  world.neighbours.north.forEach(([a, b], i) => {
    const d = 6.5 + hash(i, 9) * 1.5;
    const h = house(b - a, d, i, { streetSide: 1 });
    h.position.set((a + b) / 2, 0, -d / 2);
    root.add(h);
    occ.push({ object: h, kind: 'solid' });
    const gate = (a + b) / 2 + h.userData.door;
    root.add(gardenWall(a, b, S.gardenN, [gate]));
    root.add(box(b - a, 0.02, S.gardenN - 0.3, lawn, { x: (a + b) / 2, y: -0.005, z: S.gardenN / 2 - 0.1, shadow: false }));
  });
  world.neighbours.south.forEach(([a, b], i) => {
    const d = 7 + hash(i, 19) * 1.5;
    const h = house(b - a, d, i + 50, { streetSide: -1 });
    h.position.set((a + b) / 2, 0, S.facadeS + d / 2);
    root.add(h);
    const gate = (a + b) / 2 + h.userData.door;
    root.add(gardenWall(a, b, S.gardenS, [gate], { behind: 1 }));
    root.add(box(b - a, 0.02, S.facadeS - S.gardenS - 0.3, lawn, { x: (a + b) / 2, y: -0.005, z: (S.gardenS + S.facadeS) / 2 + 0.1, shadow: false }));
  });

  // ---- street lamps along the north kerb, trees along the south pavement and behind the houses
  const busy = [...world.sites.flatMap((s) => [s.door, s.crossing, s.box?.[0]]), ...Object.values(world.places).flatMap((p) => Object.values(p.marks).map((m) => m.position[0]))].filter((v) => Number.isFinite(v));
  const clear = (x, r) => !busy.some((b) => Math.abs(b - x) < r);
  for (let x = X0 + 4, i = 0; x < X1; x += 15, i++) {
    const lx = clear(x, 2.2) ? x : x + 3.5;
    const lp = lamp();
    lp.position.set(lx, 0, S.kerbN - 0.4);
    lp.rotation.y = -Math.PI / 2;
    root.add(lp);
    occ.push({ object: lp, kind: 'thin' });
  }
  for (let x = X0 + 9, i = 0; x < X1; x += 13, i++) {
    if (!crossings.every((c) => Math.abs(c - x) > 3)) continue;
    const t = tree(5 + hash(i, 3) * 1.5, i);
    t.position.set(x, 0, S.kerbS + 1.2);
    root.add(t);
  }
  for (let x = X0 + 3, i = 0; x < X1; x += 9.5, i++) {
    const t = tree(5.5 + hash(i, 5) * 2.5, i + 7);
    t.position.set(x + hash(i, 6) * 3, 0, -13 - hash(i, 8) * 6);
    root.add(t);
    occ.push({ object: t, kind: 'solid' });
  }

  // occluders: their world boxes, and their own materials so each can fade alone
  root.updateMatrixWorld(true);
  const occluders = occ.map(({ object, kind, set }) => {
    const box = new THREE.Box3().setFromObject(object);
    // what hangs on a wall (pictures, hooks, a radiator, the door) fades with it
    const parts = [object];
    if (set) {
      const near = box.clone().expandByVector(new THREE.Vector3(0.05, 0, 0.55));
      for (const c of set.object.children) {
        if (c === object) continue;
        const b = new THREE.Box3().setFromObject(c);
        if (!b.isEmpty() && b.max.y > 0.3 && b.intersectsBox(near) && b.max.z - b.min.z < 0.7 && b.max.x - b.min.x < 2.5) parts.push(c);
      }
    }
    const mats = new Map();
    for (const part of parts) part.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const mine = list.map((m) => {
        if (!mats.has(m)) mats.set(m, m.clone());
        return mats.get(m);
      });
      o.material = Array.isArray(o.material) ? mine : mine[0];
    });
    return { object, kind, box, mats: [...mats.values()] };
  });
  let tris = 0;
  root.traverse((o) => {
    if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  return { object: root, occluders, doors, sets: setOf, triangles: Math.round(tris) };
}
