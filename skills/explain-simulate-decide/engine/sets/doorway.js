// Doorway: the inside of a front hall. A deep blue front door with a brass letterbox
// on the back wall, a dark doormat for the post to land on, a console table and coat hooks.
import { clay, rounded, cylinder, sphere, mesh, group, canvasTexture, THREE } from '../cast/kit.js';
import { WALL_H, WALL_T, SET_PALETTE, floor, floorTexture, wall, picture, abstractArt, plant, mark, faceToward, r3 } from './parts.js';

const W = 5.8;
const D = 4.2;
const BACK = -D / 2; // back wall centre line
const DOOR_X = 0;
const DOOR_W = 0.92;
const DOOR_H = 2.06;
const INNER = WALL_T / 2 - 0.01; // inside face of the door
const MAT = { x: 0, z: BACK + 0.45, w: 0.95, d: 0.6 };
const LB_Y = 1.02;
const LX = -W / 2 + WALL_T;

/** Marks, spots and cameras, in set space (no three.js needed to read them). */
export const LAYOUT = (() => {
  // entering down the hall toward the door; standing just behind the mat, looking down at the post
  const matSpot = [MAT.x + 0.06, 0.03, MAT.z + 0.02];
  const matMark = [0.62, 0, MAT.z + 0.72];
  const enter = [1.15, 0, -0.05];
  return {
    size: [W, D],
    marks: {
      mat: mark(matMark, r3(faceToward(matMark, [matSpot[0], 0, matSpot[2] - 0.15]))),
      enter: mark(enter, r3(faceToward(enter, [DOOR_X, 0, BACK]))),
    },
    spots: {
      mat: r3(matSpot),
      letterbox: r3([DOOR_X, LB_Y, BACK + INNER + 0.03]),
      console: r3([LX + 0.17, 0.84, -0.6]),
    },
    cameras: {
      close: { position: [-1.1, 1.15, 0.45], target: [0.0, 0.62, -1.6] },
      medium: { position: [-1.35, 1.6, 3.4], target: [0.15, 0.95, -1.15] },
      wide: { position: [-0.9, 2.3, 6.6], target: [0, 1.1, -0.6] },
    },
    // the front door, a way in from outside (set space, on the back wall)
    doors: [{ at: [DOOR_X, BACK], w: DOOR_W }],
  };
})();

/** @param {{shell?: boolean}} [o] shell: false leaves out the side wall (the world builds its own) */
export default function build({ shell = true } = {}) {
  const object = group();
  object.name = 'set:doorway';
  const C = { door: '#23426e', brass: '#d2a948', mat: '#3d4046', matEdge: '#2c2f34', coat: '#e2a33b', wall: '#f6f6f3' };

  object.add(floor(W, D, { map: floorTexture('boards', '#e4e0da', '#cfc8bf', { repeat: [2, 2] }) }));

  // back wall with the door opening, and a short left wall
  const back = wall(-W / 2, BACK, W / 2, BACK, { color: C.wall, openings: [{ at: W / 2 + DOOR_X, w: DOOR_W + 0.02, y0: 0, y1: DOOR_H + 0.38 }] });
  object.add(back);
  if (shell) object.add(wall(-W / 2 + WALL_T / 2, D / 2 - 0.6, -W / 2 + WALL_T / 2, BACK - WALL_T / 2, { color: C.wall }));

  // the front door, set into the wall, its inside face toward the camera
  const door = group();
  door.position.set(DOOR_X, 0, BACK);
  const dm = clay(C.door);
  const inner = INNER;
  // the leaf hangs on hinges at its left edge and swings into the hall
  const leaf = group();
  leaf.position.x = -DOOR_W / 2;
  const hung = group();
  hung.position.x = DOOR_W / 2;
  leaf.add(hung);
  door.add(leaf);
  hung.add(mesh(rounded(DOOR_W, DOOR_H, 0.06, 0.02, 2), dm, { y: DOOR_H / 2, z: inner - 0.03 }));
  // raised panels: two tall at the bottom, two short at the top (Victorian four-panel)
  const pm = clay('#2a4c7c');
  for (const x of [-0.2, 0.2]) {
    hung.add(mesh(rounded(0.3, 0.62, 0.03, 0.015, 2), pm, { x, y: 0.42, z: inner + 0.01 }));
    hung.add(mesh(rounded(0.3, 0.55, 0.03, 0.015, 2), pm, { x, y: 1.55, z: inner + 0.01 }));
  }
  // fanlight above the door
  const fan = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 0.55, roughness: 0.3 });
  door.add(mesh(new THREE.PlaneGeometry(DOOR_W - 0.04, 0.3), fan, { y: DOOR_H + 0.19, z: 0 }));
  const frame = clay('#ffffff');
  door.add(mesh(rounded(DOOR_W + 0.04, 0.05, 0.08, 0.015, 1), frame, { y: DOOR_H + 0.025, z: inner - 0.02 }));
  // architrave around the opening
  door.add(mesh(rounded(0.09, DOOR_H + 0.42, 0.03, 0.01, 1), frame, { x: -DOOR_W / 2 - 0.045, y: (DOOR_H + 0.42) / 2, z: WALL_T / 2 + 0.015 }));
  door.add(mesh(rounded(0.09, DOOR_H + 0.42, 0.03, 0.01, 1), frame, { x: DOOR_W / 2 + 0.045, y: (DOOR_H + 0.42) / 2, z: WALL_T / 2 + 0.015 }));
  door.add(mesh(rounded(DOOR_W + 0.18, 0.09, 0.03, 0.01, 1), frame, { y: DOOR_H + 0.42, z: WALL_T / 2 + 0.015 }));
  // letterbox: brass plate with a dark slot and a hinged flap, at about 1 m
  const brass = new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.35, metalness: 0.6 });
  hung.add(mesh(rounded(0.34, 0.1, 0.02, 0.01, 2), brass, { y: LB_Y, z: inner + 0.01 }));
  hung.add(mesh(rounded(0.27, 0.035, 0.012, 0.006, 1), clay('#141414'), { y: LB_Y, z: inner + 0.018 }));
  hung.add(mesh(rounded(0.27, 0.03, 0.01, 0.005, 1), brass, { y: LB_Y + 0.026, z: inner + 0.023, rx: 0.25 }));
  // knob, latch and a spy-hole
  hung.add(mesh(sphere(0.035, 14), brass, { x: 0.34, y: 1.12, z: inner + 0.04 }));
  hung.add(mesh(rounded(0.08, 0.12, 0.03, 0.01, 1), brass, { x: 0.34, y: 1.32, z: inner + 0.015 }));
  hung.add(mesh(cylinder(0.012, 0.012, 0.02, 10), brass, { y: 1.52, z: inner + 0.02, rx: Math.PI / 2 }));
  // outside: a brass knob and the house number
  hung.add(mesh(sphere(0.035, 14), brass, { x: 0, y: 1.12, z: inner - 0.1 }));
  hung.add(mesh(rounded(0.1, 0.12, 0.01, 0.01, 1), brass, { x: 0, y: 1.55, z: inner - 0.065 }));
  object.add(door);

  // doormat: dark coir with a darker border
  object.add(mesh(rounded(MAT.w, 0.022, MAT.d, 0.008, 1), clay(C.matEdge), { x: MAT.x, y: 0.011, z: MAT.z }));
  object.add(mesh(rounded(MAT.w - 0.08, 0.006, MAT.d - 0.08, 0.003, 1), clay(C.mat), { x: MAT.x, y: 0.023, z: MAT.z }));

  // left wall: a slim console table with a lamp, a bowl for keys and a mirror
  const oak = clay(SET_PALETTE.oak);
  const table = group();
  table.position.set(LX + 0.17, 0, -0.75);
  table.add(mesh(rounded(0.32, 0.04, 1.0, 0.012, 1), oak, { y: 0.8 }));
  for (const [x, z] of [[-0.12, -0.45], [0.12, -0.45], [-0.12, 0.45], [0.12, 0.45]]) table.add(mesh(cylinder(0.018, 0.014, 0.78, 8), clay(SET_PALETTE.oakDark), { x, y: 0.39, z }));
  table.add(mesh(rounded(0.28, 0.025, 0.92, 0.01, 1), oak, { y: 0.2 }));
  table.add(mesh(cylinder(0.11, 0.06, 0.05, 20), clay('#f0f2f4'), { y: 0.845, z: 0.25 }));
  table.add(mesh(cylinder(0.05, 0.07, 0.28, 16), clay('#ffffff'), { y: 0.96, z: -0.28 }));
  table.add(mesh(cylinder(0.08, 0.13, 0.17, 20, true), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe7b8', emissiveIntensity: 0.6, roughness: 0.6 }), { y: 1.18, z: -0.28 }));
  table.add(mesh(rounded(0.04, 0.6, 0.5, 0.02, 1), clay('#c9a76a'), { x: -0.12, y: 1.45, z: 0 }));
  table.add(mesh(new THREE.PlaneGeometry(0.42, 0.52), new THREE.MeshStandardMaterial({ color: '#dfe8ef', roughness: 0.08, metalness: 0.6 }), { x: -0.095, y: 1.45, ry: Math.PI / 2 }));
  object.add(table);

  // coat hooks on the back wall left of the door, with a mustard coat and a scarf
  const hooks = group();
  hooks.position.set(-1.35, 0, BACK + WALL_T / 2);
  hooks.add(mesh(rounded(0.7, 0.08, 0.025, 0.01, 1), oak, { y: 1.72, z: 0.012 }));
  for (const x of [-0.25, 0, 0.25]) hooks.add(mesh(cylinder(0.012, 0.012, 0.07, 8), clay(SET_PALETTE.charcoal), { x, y: 1.71, z: 0.05, rx: Math.PI / 2 - 0.4 }));
  const coat = clay(C.coat);
  // coat on a hook: body, two hanging sleeves, collar and a row of buttons
  hooks.add(mesh(rounded(0.38, 0.9, 0.12, 0.06, 3), coat, { x: -0.12, y: 1.22, z: 0.1 }));
  for (const s of [-1, 1]) hooks.add(mesh(rounded(0.1, 0.72, 0.1, 0.045, 2), clay('#d39530'), { x: -0.12 + s * 0.2, y: 1.26, z: 0.13, rz: s * 0.06 }));
  hooks.add(mesh(rounded(0.24, 0.1, 0.13, 0.04, 2), clay('#d39530'), { x: -0.12, y: 1.66, z: 0.1 }));
  for (let i = 0; i < 4; i++) hooks.add(mesh(sphere(0.014, 8), clay(SET_PALETTE.charcoal), { x: -0.12, y: 1.5 - i * 0.16, z: 0.165 }));
  hooks.add(mesh(rounded(0.09, 0.95, 0.03, 0.02, 2), clay(SET_PALETTE.teal), { x: 0.25, y: 1.25, z: 0.06 }));
  object.add(hooks);
  // a pair of shoes under the hooks
  // a pair of trainers under the hooks: white sole, navy upper, higher at the heel
  for (const [x, z, a] of [[-1.5, BACK + 0.34, 0.2], [-1.3, BACK + 0.32, -0.1]]) {
    const shoe = group();
    shoe.position.set(x, 0, z);
    shoe.rotation.y = a;
    shoe.add(mesh(rounded(0.1, 0.03, 0.28, 0.014, 2), clay('#ffffff'), { y: 0.015 }));
    shoe.add(mesh(rounded(0.09, 0.07, 0.17, 0.035, 2), clay('#2c3e5c'), { y: 0.06, z: -0.05 }));
    shoe.add(mesh(rounded(0.085, 0.045, 0.12, 0.022, 2), clay('#2c3e5c'), { y: 0.045, z: 0.07 }));
    object.add(shoe);
  }

  // radiator right of the door and a framed print above it
  const rad = group();
  rad.position.set(1.45, 0, BACK + WALL_T / 2 + 0.06);
  const rm = clay('#ffffff');
  for (let i = 0; i < 9; i++) rad.add(mesh(rounded(0.07, 0.55, 0.06, 0.02, 1), rm, { x: -0.36 + i * 0.09, y: 0.5 }));
  rad.add(mesh(cylinder(0.012, 0.012, 0.16, 8), clay(SET_PALETTE.steel), { x: 0.42, y: 0.16 }));
  object.add(rad);
  const art = picture(0.62, 0.78, abstractArt(['#e2a33b', '#23426e', '#0e7c7b']), { frame: '#ffffff' });
  art.position.set(1.45, 1.6, BACK + WALL_T / 2);
  object.add(art);
  const pl = plant(0.95, { pot: '#e9ecef', tall: true });
  pl.position.set(2.15, 0, BACK + 0.35);
  object.add(pl);

  return { object, ...LAYOUT, walls: { back }, doors: [{ ...LAYOUT.doors[0], leaf, swing: -1 }] };
}
