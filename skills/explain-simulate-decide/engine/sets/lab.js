// Lab: where the kits are read. A white bench with a dark worktop, an analyser with a
// screen and a sample carousel, a rack of sample tubes, a tray of returned envelopes,
// shelves of reagents and a monitor. No person needed.
import { clay, rounded, cylinder, sphere, torus, mesh, group, canvasTexture, FONT, THREE } from '../cast/kit.js';
import { WALL_T, SET_PALETTE, floor, floorTexture, wall, plant, chair, mark, r3 } from './parts.js';

const W = 5.4;
const D = 4.0;
const BACK = -D / 2;
const TOP = 0.92;
const CAP = '#2f9a5c';
const WALL_IN = BACK + WALL_T / 2;
const BD = 0.75; // bench depth
const AX = -0.45; // analyser
const CAR = [0.2, 0.52, 0.02]; // its sample carousel
const RX = 0.55; // tube rack
const TX = 1.3; // envelope tray

/** Marks, spots and cameras, in set space (no three.js needed to read them). */
export const LAYOUT = (() => {
  const freeA = (3 / 14) * Math.PI * 2;
  const analyserSpot = [AX + CAR[0] + Math.sin(freeA) * 0.15, TOP + CAR[1] + 0.04, WALL_IN + 0.36 + CAR[2] + Math.cos(freeA) * 0.15];
  return {
    size: [W, D],
    marks: {
      bench: mark([0.15, 0, WALL_IN + BD + 0.4], Math.PI),
    },
    spots: {
      analyser: r3(analyserSpot),
      tray: r3([TX, TOP + 0.012, WALL_IN + 0.4]),
      rack: r3([RX, TOP + 0.012, WALL_IN + 0.45]),
      bench: r3([0.2, TOP, WALL_IN + 0.55]),
    },
    cameras: {
      close: { position: [0.6, 1.78, -0.05], target: [-0.1, 1.3, -1.55] },
      medium: { position: [0.85, 1.75, 2.6], target: [0.1, 1.05, -1.45] },
      wide: { position: [0.2, 2.3, 6.4], target: [0, 1.05, -0.6] },
    },
    doors: [], // the bench fills the back wall: in the world the lab is reached through a lobby at its side
  };
})();

function tube(capColor = CAP) {
  const g = group();
  g.add(mesh(cylinder(0.0085, 0.0075, 0.075, 12), clay('#f7f9fb'), { y: 0.0375 }));
  g.add(mesh(cylinder(0.01, 0.01, 0.028, 12), clay(capColor), { y: 0.085 }));
  return g;
}

/** @param {{shell?: boolean}} [o] shell: false leaves out the side wall (the world builds its own) */
export default function build({ shell = true } = {}) {
  const object = group();
  object.name = 'set:lab';
  const C = { wall: '#f5f7f9', bench: '#ffffff', top: '#3a434e', grey: '#d5dbe1', teal: '#0e7c7b', blue: '#1f63b5' };
  const LEFT_IN = -W / 2 + WALL_T;

  object.add(floor(W, D, { map: floorTexture('tiles', '#e7ebef', '#d2d8de', { repeat: [3, 2.2] }) }));
  const back = wall(-W / 2, BACK, W / 2, BACK, { color: C.wall });
  object.add(back);
  if (shell) object.add(wall(-W / 2 + WALL_T / 2, D / 2 - 0.9, -W / 2 + WALL_T / 2, BACK - WALL_T / 2, { color: C.wall }));
  // a pale teal band at worktop height on the walls
  object.add(mesh(rounded(W - WALL_T, 0.5, 0.01, 0.004, 1), clay('#e2f0ee'), { x: WALL_T / 2, y: TOP + 0.25, z: WALL_IN + 0.006 }));

  // the bench: white cabinets on a recessed plinth, dark resin worktop
  const X0 = LEFT_IN;
  const X1 = 2.25;
  const BW = X1 - X0;
  const BX = (X0 + X1) / 2;
  const bz = WALL_IN + BD / 2;
  object.add(mesh(rounded(BW, 0.1, BD - 0.08, 0.01, 1), clay('#9aa5b0'), { x: BX, y: 0.05, z: bz - 0.04 }));
  object.add(mesh(rounded(BW, TOP - 0.14, BD - 0.03, 0.01, 1), clay('#e9edf1'), { x: BX, y: 0.1 + (TOP - 0.14) / 2, z: bz - 0.015 }));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = X0 + (i + 0.5) * (BW / n);
    object.add(mesh(rounded(BW / n - 0.02, TOP - 0.18, 0.025, 0.01, 1), clay(C.bench), { x, y: 0.1 + (TOP - 0.15) / 2, z: WALL_IN + BD - 0.02 }));
    object.add(mesh(rounded(0.14, 0.02, 0.025, 0.008, 1), clay('#8a96a3'), { x, y: TOP - 0.13, z: WALL_IN + BD }));
  }
  object.add(mesh(rounded(BW + 0.02, 0.04, BD + 0.02, 0.01, 1), clay(C.top), { x: BX, y: TOP - 0.02, z: bz }));

  // the analyser: a white body with a sloped front, a screen, a status strip and a sample carousel
  const an = group();
  an.position.set(AX, TOP, WALL_IN + 0.36);
  const white = clay('#fbfcfd');
  an.add(mesh(rounded(0.9, 0.52, 0.56, 0.05, 2), white, { y: 0.26 }));
  an.add(mesh(rounded(0.92, 0.06, 0.58, 0.03, 2), clay(C.grey), { y: 0.03 }));
  // a grey lid with a seam, a brand label and a sample door on the front
  an.add(mesh(rounded(0.86, 0.04, 0.52, 0.02, 1), clay('#e3e8ed'), { y: 0.51 }));
  an.add(mesh(rounded(0.3, 0.2, 0.01, 0.01, 1), clay('#eef1f4'), { x: 0.22, y: 0.26, z: 0.281 }));
  an.add(mesh(sphere(0.012, 10), clay(C.teal), { x: 0.36, y: 0.42, z: 0.285 }));
  const { tex: ui } = canvasTexture(256, 160, (c, w, h) => {
    c.fillStyle = '#0f2b3a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2bb3a3';
    c.font = `700 18px ${FONT}`;
    c.fillText('FIT  ANALYSER', 14, 26);
    c.fillStyle = '#1f4b5e';
    for (let i = 0; i < 4; i++) c.fillRect(14, 44 + i * 26, 228, 18);
    c.fillStyle = '#2bb3a3';
    for (let i = 0; i < 4; i++) c.fillRect(14, 44 + i * 26, 40 + ((i * 61) % 150), 18);
  });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshStandardMaterial({ map: ui, emissive: '#ffffff', emissiveMap: ui, emissiveIntensity: 0.8, roughness: 0.3 }));
  scr.position.set(-0.22, 0.34, 0.281);
  an.add(scr);
  an.add(mesh(rounded(0.3, 0.2, 0.012, 0.01, 1), clay('#2b2f36'), { x: -0.22, y: 0.34, z: 0.275 }));
  an.add(mesh(rounded(0.7, 0.02, 0.01, 0.008, 1), new THREE.MeshStandardMaterial({ color: '#7fe0d2', emissive: '#2bb3a3', emissiveIntensity: 0.9 }), { y: 0.1, z: 0.282 }));
  // sample carousel on top-right, with a ring of tubes
  an.add(mesh(cylinder(0.2, 0.2, 0.04, 40), clay(C.grey), { x: CAR[0], y: CAR[1] + 0.02, z: CAR[2] }));
  an.add(mesh(cylinder(0.06, 0.06, 0.07, 20), clay('#ffffff'), { x: CAR[0], y: CAR[1] + 0.06, z: CAR[2] }));
  for (let i = 0; i < 14; i++) {
    if (i === 3) continue; // one empty place, facing the room, for the kit that arrives
    const a = (i / 14) * Math.PI * 2;
    const t = tube();
    t.position.set(CAR[0] + Math.sin(a) * 0.15, CAR[1] + 0.04, CAR[2] + Math.cos(a) * 0.15);
    an.add(t);
  }
  object.add(an);

  // tube rack: 3 rows x 8, most filled
  const rack = group();
  rack.position.set(RX, TOP, WALL_IN + 0.45);
  rack.add(mesh(rounded(0.36, 0.015, 0.14, 0.005, 1), clay('#ffffff'), { y: 0.06 }));
  rack.add(mesh(rounded(0.36, 0.012, 0.14, 0.005, 1), clay('#ffffff'), { y: 0.006 }));
  for (const x of [-0.17, 0.17]) rack.add(mesh(rounded(0.015, 0.07, 0.14, 0.004, 1), clay('#ffffff'), { x, y: 0.035 }));
  for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) {
    if ((r * 8 + k) % 7 === 5) continue;
    const t = tube(r === 0 && k === 2 ? '#e2a33b' : CAP);
    t.position.set(-0.14 + k * 0.04, 0.012, -0.04 + r * 0.04);
    rack.add(t);
  }
  object.add(rack);

  // tray of returned envelopes, standing on edge
  const tray = group();
  tray.position.set(TX, TOP, WALL_IN + 0.4);
  const tm = clay(C.blue);
  tray.add(mesh(rounded(0.42, 0.012, 0.3, 0.006, 1), tm, { y: 0.006 }));
  for (const s of [-1, 1]) {
    tray.add(mesh(rounded(0.42, 0.09, 0.015, 0.006, 1), tm, { y: 0.045, z: s * 0.145 }));
    tray.add(mesh(rounded(0.015, 0.09, 0.3, 0.006, 1), tm, { x: s * 0.205, y: 0.045 }));
  }
  const { tex: envTex } = canvasTexture(128, 64, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = C.blue;
    c.fillRect(0, 0, 8, h);
    c.fillStyle = '#c9cfd6';
    c.fillRect(54, 34, 50, 4);
    c.fillRect(54, 42, 40, 4);
  });
  const envMat = [clay('#ffffff'), clay('#ffffff'), clay('#ffffff'), clay('#ffffff'), new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.9 }), clay('#f4f5f6')];
  for (let i = 0; i < 7; i++) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.165, 0.006), envMat);
    const lean = -0.42 + (i % 3) * 0.05;
    e.position.set(((i * 13) % 5) * 0.006 - 0.012, 0.012 + 0.0825 * Math.cos(lean), -0.1 + i * 0.034 + 0.0825 * Math.sin(lean));
    e.rotation.set(lean, ((i * 7) % 3 - 1) * 0.03, 0);
    e.castShadow = e.receiveShadow = true;
    tray.add(e);
  }
  object.add(tray);

  // a monitor with results at the left, and a box of gloves
  const mon = group();
  mon.position.set(-1.65, TOP, WALL_IN + 0.3);
  mon.rotation.y = 0.25;
  mon.add(mesh(rounded(0.2, 0.012, 0.16, 0.005, 1), clay('#2b2f36'), { y: 0.006 }));
  mon.add(mesh(rounded(0.05, 0.22, 0.03, 0.01, 1), clay('#2b2f36'), { y: 0.12, z: -0.03 }));
  mon.add(mesh(rounded(0.58, 0.36, 0.03, 0.012, 1), clay('#2b2f36'), { y: 0.42 }));
  const { tex: res } = canvasTexture(256, 160, (c, w, h) => {
    c.fillStyle = '#f4f8fc';
    c.fillRect(0, 0, w, h);
    c.fillStyle = C.blue;
    c.fillRect(0, 0, w, 22);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = '#d5dee8';
      c.fillRect(12, 32 + i * 20, 160, 12);
      c.fillStyle = i === 2 ? '#e2a33b' : '#2f9a5c';
      c.beginPath();
      c.arc(200, 38 + i * 20, 6, 0, Math.PI * 2);
      c.fill();
    }
  });
  const ms = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), new THREE.MeshStandardMaterial({ map: res, emissive: '#ffffff', emissiveMap: res, emissiveIntensity: 0.55, roughness: 0.3 }));
  ms.position.set(0, 0.42, 0.016);
  mon.add(ms);
  object.add(mon);
  object.add(mesh(rounded(0.4, 0.018, 0.14, 0.006, 1), clay('#eef1f4'), { x: -1.55, y: TOP + 0.009, z: WALL_IN + 0.58, ry: 0.25 }));
  object.add(mesh(rounded(0.24, 0.12, 0.13, 0.01, 1), clay('#ffffff'), { x: -2.2, y: TOP + 0.06, z: WALL_IN + 0.2 }));
  object.add(mesh(rounded(0.1, 0.04, 0.005, 0.01, 1), clay('#86b6dd'), { x: -2.2, y: TOP + 0.06, z: WALL_IN + 0.27 }));

  // wall shelves with reagent bottles and boxes
  const shelfMat = clay('#ffffff');
  const bottles = [['#ffffff', 0.18], ['#b5651d', 0.2], ['#ffffff', 0.14], ['#86b6dd', 0.16], ['#b5651d', 0.15], ['#ffffff', 0.2]];
  for (const [y, x0, x1] of [[1.55, -2.0, 0.1], [1.95, -2.0, 0.1], [1.75, 0.6, 2.0]]) {
    const w = x1 - x0;
    object.add(mesh(rounded(w, 0.03, 0.28, 0.008, 1), shelfMat, { x: (x0 + x1) / 2, y, z: WALL_IN + 0.14 }));
    for (const xb of [x0 + 0.1, x1 - 0.1]) object.add(mesh(rounded(0.02, 0.12, 0.2, 0.005, 1), clay(C.grey), { x: xb, y: y - 0.07, z: WALL_IN + 0.1 }));
    let x = x0 + 0.18;
    let i = Math.round(y * 10);
    while (x < x1 - 0.18) {
      if (i % 4 === 0) {
        object.add(mesh(rounded(0.24, 0.16, 0.2, 0.01, 1), clay(i % 8 ? '#dfe7ee' : '#ffffff'), { x: x + 0.1, y: y + 0.095, z: WALL_IN + 0.14 }));
        x += 0.3;
      } else {
        const [col, h] = bottles[i % bottles.length];
        object.add(mesh(cylinder(0.04, 0.045, h, 16), clay(col, { opacity: col === '#b5651d' ? 0.9 : 1 }), { x, y: y + 0.015 + h / 2, z: WALL_IN + 0.14 }));
        object.add(mesh(cylinder(0.022, 0.022, 0.035, 12), clay(i % 3 ? C.blue : '#2b2f36'), { x, y: y + 0.015 + h + 0.017, z: WALL_IN + 0.14 }));
        x += 0.12;
      }
      i++;
    }
  }
  // a hazard-free, calm lab: a stool, and a plant for life
  const stool = chair({ seat: 0.62, color: '#ffffff', frame: '#8a96a3', style: 'office', back: 0.001 });
  stool.position.set(-1.45, 0, -0.65);
  stool.children.slice(-2).forEach((c) => (c.visible = false));
  object.add(stool);
  const pl = plant(1.0, { pot: '#ffffff', tall: true });
  pl.position.set(LEFT_IN + 0.35, 0, 0.6);
  object.add(pl);

  return { object, ...LAYOUT, walls: { back }, doors: [] };
}
