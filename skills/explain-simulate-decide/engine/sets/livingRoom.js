// Living room: a green sofa under a window, a navy sideboard with a lamp, books and a
// photo (where the next letter gets put), a rug and coffee table, a floor lamp and a plant.
import { clay, rounded, cylinder, sphere, mesh, group, canvasTexture, THREE } from '../cast/kit.js';
import { WALL_T, SET_PALETTE, floor, floorTexture, wall, windowFrame, plant, books, picture, abstractArt, rug, mark, faceToward, r3 } from './parts.js';

const W = 5.6;
const D = 4.2;
const BACK = -D / 2;
const SB_TOP = 0.93; // sideboard top surface

export default function build() {
  const object = group();
  object.name = 'set:livingRoom';
  const C = { wall: '#f7f7f5', sofa: '#3f6b5c', sofaDark: '#355b4e', cushion: '#e2a33b', navy: '#2c3e5c', brass: '#d2a948', rug: '#dfe4ea', rugLine: '#8fa3b8', curtain: '#e7ecf0' };
  const WALL_IN = BACK + WALL_T / 2;
  const LEFT_IN = -W / 2 + WALL_T;

  object.add(floor(W, D, { map: floorTexture('boards', '#ece3d6', '#d9ccb9', { repeat: [2, 2] }) }));
  object.add(wall(-W / 2, BACK, W / 2, BACK, { color: C.wall }));
  object.add(wall(-W / 2 + WALL_T / 2, D / 2 - 0.8, -W / 2 + WALL_T / 2, BACK - WALL_T / 2, { color: C.wall }));

  // window over the sofa, with soft curtains
  const SOFA_X = -1.25;
  const win = windowFrame(1.4, 1.2, { bars: 2, sill: true });
  win.position.set(SOFA_X, 1.65, WALL_IN);
  object.add(win);
  const curtain = clay(C.curtain);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) object.add(mesh(rounded(0.13, 2.05, 0.08, 0.04, 2), curtain, { x: SOFA_X + s * (0.86 + i * 0.1), y: 1.12, z: WALL_IN + 0.1 + (i % 2) * 0.03 }));
  }
  object.add(mesh(cylinder(0.015, 0.015, 2.3, 8), clay(SET_PALETTE.charcoal), { x: SOFA_X, y: 2.2, z: WALL_IN + 0.1, rz: Math.PI / 2 }));

  // sofa: plinth, seat cushions, back cushions, rolled arms, short legs; seat top at 0.45
  const sofa = group();
  const SW = 2.0;
  const SD = 0.88;
  sofa.position.set(SOFA_X, 0, WALL_IN + SD / 2 + 0.06);
  const sm = clay(C.sofa);
  const smd = clay(C.sofaDark);
  sofa.add(mesh(rounded(SW, 0.24, SD, 0.06, 2), smd, { y: 0.1 + 0.12 }));
  for (const s of [-1, 1]) {
    sofa.add(mesh(rounded((SW - 0.36) / 2 - 0.01, 0.13, SD - 0.24, 0.06, 2), sm, { x: s * ((SW - 0.36) / 4), y: 0.385, z: 0.1 }));
    sofa.add(mesh(rounded((SW - 0.36) / 2 - 0.02, 0.48, 0.2, 0.08, 3), sm, { x: s * ((SW - 0.36) / 4), y: 0.62, z: -SD / 2 + 0.16, rx: -0.12 }));
    sofa.add(mesh(rounded(0.18, 0.5, SD, 0.08, 3), sm, { x: s * (SW / 2 - 0.09), y: 0.35 }));
  }
  sofa.add(mesh(rounded(SW, 0.5, 0.16, 0.06, 2), smd, { y: 0.55, z: -SD / 2 + 0.08 }));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sofa.add(mesh(cylinder(0.025, 0.018, 0.1, 10), clay(SET_PALETTE.oakDark), { x: x * (SW / 2 - 0.08), y: 0.05, z: z * (SD / 2 - 0.08) }));
  sofa.add(mesh(rounded(0.42, 0.4, 0.14, 0.1, 3), clay(C.cushion), { x: -0.62, y: 0.62, z: -0.12, rz: 0.12, rx: -0.2 }));
  sofa.add(mesh(rounded(0.38, 0.36, 0.13, 0.1, 3), clay('#ffffff'), { x: 0.68, y: 0.6, z: -0.12, rz: -0.1, rx: -0.2 }));
  object.add(sofa);

  // floor lamp at the sofa's left
  const lamp = group();
  lamp.position.set(LEFT_IN + 0.32, 0, WALL_IN + 0.38);
  lamp.add(mesh(cylinder(0.16, 0.18, 0.03, 24), clay(SET_PALETTE.charcoal), { y: 0.015 }));
  lamp.add(mesh(cylinder(0.014, 0.014, 1.45, 8), clay(SET_PALETTE.charcoal), { y: 0.74 }));
  lamp.add(mesh(cylinder(0.16, 0.24, 0.3, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe7b8', emissiveIntensity: 0.55, roughness: 0.7 }), { y: 1.55 }));
  object.add(lamp);

  // rug and a low oval coffee table with a mug and a book
  const rg = rug(2.5, 1.7, C.rug, C.rugLine);
  rg.position.set(SOFA_X + 0.1, 0, -0.45);
  object.add(rg);
  const ct = group();
  ct.position.set(SOFA_X + 0.05, 0, -0.5);
  const top = mesh(cylinder(0.5, 0.5, 0.04, 40), clay(SET_PALETTE.oak), { y: 0.4 });
  top.scale.z = 0.6;
  ct.add(top);
  for (const [x, z] of [[-0.32, -0.14], [0.32, -0.14], [-0.32, 0.14], [0.32, 0.14]]) ct.add(mesh(cylinder(0.02, 0.016, 0.38, 8), clay(SET_PALETTE.oakDark), { x, y: 0.19, z }));
  ct.add(mesh(cylinder(0.045, 0.04, 0.09, 16), clay('#ffffff'), { x: 0.18, y: 0.465, z: 0.04 }));
  ct.add(mesh(rounded(0.2, 0.03, 0.26, 0.006, 1), clay('#2f5f8f'), { x: -0.15, y: 0.435, ry: 0.3 }));
  object.add(ct);

  // the sideboard: navy body, oak top, brass knobs, on slim legs
  const SB_X = 1.3;
  const SB_W = 1.5;
  const SB_D = 0.45;
  const sbZ = WALL_IN + SB_D / 2 + 0.02;
  const navy = clay(C.navy);
  object.add(mesh(rounded(SB_W, SB_TOP - 0.18, SB_D, 0.02, 1), navy, { x: SB_X, y: 0.15 + (SB_TOP - 0.18) / 2, z: sbZ }));
  object.add(mesh(rounded(SB_W + 0.04, 0.03, SB_D + 0.03, 0.01, 1), clay(SET_PALETTE.oak), { x: SB_X, y: SB_TOP - 0.015, z: sbZ }));
  for (const x of [-1, 1]) for (const z of [-1, 1]) object.add(mesh(cylinder(0.02, 0.014, 0.16, 8), clay(SET_PALETTE.oakDark), { x: SB_X + x * (SB_W / 2 - 0.08), y: 0.08, z: sbZ + z * (SB_D / 2 - 0.06), rz: x * 0.12 }));
  const brass = new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.35, metalness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const x = SB_X - SB_W / 2 + (i + 0.5) * (SB_W / 3);
    object.add(mesh(rounded(SB_W / 3 - 0.03, SB_TOP - 0.24, 0.015, 0.008, 1), clay('#33476a'), { x, y: 0.15 + (SB_TOP - 0.18) / 2, z: sbZ + SB_D / 2 + 0.006 }));
    object.add(mesh(sphere(0.018, 10), brass, { x: x + (i === 1 ? 0 : (i ? -1 : 1) * 0.16), y: 0.62, z: sbZ + SB_D / 2 + 0.025 }));
  }
  // on the sideboard: a lamp at the left, books and a photo at the right; the middle is kept clear
  const tl = group();
  tl.position.set(SB_X - SB_W / 2 + 0.2, SB_TOP, sbZ - 0.05);
  tl.add(mesh(sphere(0.1, 20), clay('#ffffff'), { y: 0.1 }));
  tl.add(mesh(cylinder(0.012, 0.012, 0.16, 8), clay(C.brass), { y: 0.25 }));
  tl.add(mesh(cylinder(0.11, 0.16, 0.17, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe7b8', emissiveIntensity: 0.5, roughness: 0.7 }), { y: 0.39 }));
  object.add(tl);
  const bk = books(6, ['#2f5f8f', '#ffffff', '#e2a33b', '#3f6b5c', '#d9dee4', '#2c3e5c'], { h: 0.24, d: 0.17 });
  bk.position.set(SB_X + 0.28, SB_TOP, sbZ - 0.06);
  object.add(bk);
  const photo = picture(0.18, 0.22, abstractArt(['#86b6dd', '#3f6b5c', '#e2a33b']), { frame: C.brass });
  photo.position.set(SB_X + 0.58, SB_TOP + 0.11, sbZ - 0.02);
  photo.rotation.set(-0.12, -0.3, 0);
  object.add(photo);
  const vase = group();
  vase.position.set(SB_X - 0.22, SB_TOP, sbZ - 0.08);
  vase.add(mesh(cylinder(0.05, 0.07, 0.2, 20), clay('#ffffff'), { y: 0.1 }));
  for (const [x, z, h, col] of [[0, 0, 0.32, '#e2a33b'], [0.04, 0.02, 0.26, '#ffffff'], [-0.04, -0.01, 0.28, '#e2a33b']]) {
    vase.add(mesh(cylinder(0.004, 0.004, h, 6), clay(SET_PALETTE.leafDark), { x, y: 0.12 + h / 2, z, rz: x * 2 }));
    vase.add(mesh(sphere(0.03, 10), clay(col), { x: x * 1.5, y: 0.12 + h, z }));
  }
  object.add(vase);
  // a large print above the sideboard
  const art = picture(0.95, 0.7, abstractArt(['#3f6b5c', '#86b6dd', '#e2a33b']), { frame: '#ffffff' });
  art.position.set(SB_X, 1.75, WALL_IN);
  object.add(art);

  // a tall plant in the right corner
  const pl = plant(1.25, { pot: '#ffffff', tall: true });
  pl.position.set(W / 2 - 0.4, 0, WALL_IN + 0.35);
  object.add(pl);

  // standing to the left of the sideboard's clear middle, turned toward it
  const shelf = [SB_X - 0.02, SB_TOP, sbZ + 0.04];
  const stand = [SB_X - 0.62, 0, sbZ + 0.62];
  return {
    object,
    marks: {
      shelf: mark(r3(stand), r3(faceToward(stand, shelf))),
      sofa: mark(r3([SOFA_X + 0.42, 0, WALL_IN + SD / 2 + 0.06 + 0.08]), 0, { pose: 'sit', seat: 0.45 }),
    },
    spots: {
      shelf: r3(shelf),
      coffeeTable: r3([SOFA_X - 0.1, 0.42, -0.5]),
    },
    cameras: {
      close: { position: [2.35, 1.5, 0.85], target: [0.85, 1.02, -1.65] },
      medium: { position: [2.6, 1.55, 3.3], target: [0.55, 0.95, -1.3] },
      wide: { position: [0.3, 2.3, 6.7], target: [0, 1.05, -0.7] },
    },
  };
}
