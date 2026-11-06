// Hospital: a calm consultation room in soft blue and white. A nurse's desk with a screen,
// two chairs turned toward each other, an exam couch with a paper roll and a privacy
// screen, a plant, a wall clock, and a door with a vision panel.
import { clay, rounded, cylinder, sphere, mesh, group, canvasTexture, FONT, THREE } from '../cast/kit.js';
import { WALL_T, SET_PALETTE, floor, floorTexture, wall, windowFrame, plant, chair, picture, mark, faceToward, r3 } from './parts.js';

const W = 5.6;
const D = 4.4;
const BACK = -D / 2;
const DESK_TOP = 0.74;
const WALL_IN = BACK + WALL_T / 2;
const LEFT_IN = -W / 2 + WALL_T;
const DOOR_AT = W / 2 - 1.0; // along the back wall from its left end (door at x = -1.0)
const DESK_X = 0.95;
const NURSE = [0.75, 0, -0.85];
const PATIENT = [-0.55, 0, -0.48];

/** Marks, spots and cameras, in set space (no three.js needed to read them). */
export const LAYOUT = (() => {
  const nurseFacing = faceToward(NURSE, PATIENT);
  const patientFacing = faceToward(PATIENT, NURSE);
  const doorMark = [-W / 2 + DOOR_AT, 0, BACK + 0.65];
  return {
    size: [W, D],
    marks: {
      patientChair: mark(PATIENT, r3(patientFacing), { pose: 'sit', seat: 0.45 }),
      nurse: mark(NURSE, r3(nurseFacing), { pose: 'sit', seat: 0.45 }),
      door: mark(r3(doorMark), r3(faceToward(doorMark, PATIENT))),
      couch: mark([LEFT_IN + 0.95, 0, -0.75], -Math.PI / 2),
    },
    spots: {
      desk: r3([DESK_X + 0.15, DESK_TOP, WALL_IN + 0.45]),
      sideTable: r3([0.1, 0.565, -1.4]),
      screen: r3([DESK_X - 0.15, DESK_TOP + 0.42, WALL_IN + 0.25]),
    },
    cameras: {
      close: { position: [1.0, 1.25, 0.95], target: [-0.6, 0.98, -0.55] },
      medium: { position: [-0.15, 1.45, 3.35], target: [0.1, 0.85, -0.8] },
      wide: { position: [0.5, 2.3, 6.9], target: [-0.1, 1.05, -0.6] },
    },
    doors: [{ at: [-W / 2 + DOOR_AT, BACK], w: 0.94 }],
  };
})();

/** @param {{shell?: boolean}} [o] shell: false leaves out the side wall (the world builds its own) */
export default function build({ shell = true } = {}) {
  const object = group();
  object.name = 'set:hospital';
  const C = { wall: '#f1f5f9', rail: '#c5d8ec', blue: '#1f63b5', soft: '#7fa6cf', couch: '#4f7db0', grey: '#c3ccd5', screen: '#d7ebe8' };

  object.add(floor(W, D, { map: floorTexture('plain', '#dfe6ee', '#9fb0c2', { repeat: [2, 2] }) }));
  const back = wall(-W / 2, BACK, W / 2, BACK, { color: C.wall, openings: [{ at: DOOR_AT, w: 0.98, y0: 0, y1: 2.1 }] });
  object.add(back);
  if (shell) object.add(wall(-W / 2 + WALL_T / 2, D / 2 - 0.7, -W / 2 + WALL_T / 2, BACK - WALL_T / 2, { color: C.wall }));
  // a soft-blue protection rail along both walls at chair-back height
  const rail = clay(C.rail);
  object.add(mesh(rounded(DOOR_AT - 0.55, 0.1, 0.03, 0.012, 1), rail, { x: -W / 2 + (DOOR_AT - 0.55) / 2, y: 0.95, z: WALL_IN + 0.015 }));
  object.add(mesh(rounded(W - DOOR_AT - 0.55, 0.1, 0.03, 0.012, 1), rail, { x: -W / 2 + (DOOR_AT + 0.55 + W) / 2, y: 0.95, z: WALL_IN + 0.015 }));
  object.add(mesh(rounded(0.03, 0.1, D - 0.7, 0.012, 1), rail, { x: LEFT_IN + 0.015, y: 0.95, z: (BACK + D / 2 - 0.7) / 2 }));

  // door: white leaf with a vision panel and kick plate, blue frame
  const door = group();
  door.position.set(-W / 2 + DOOR_AT, 0, BACK);
  const frame = clay(C.blue);
  // the leaf hangs at its left edge and swings into the room
  const leaf = group();
  leaf.position.x = -0.47;
  const hung = group();
  hung.position.x = 0.47;
  leaf.add(hung);
  door.add(leaf);
  hung.add(mesh(rounded(0.94, 2.08, 0.05, 0.015, 1), clay('#ffffff'), { y: 1.04, z: 0 }));
  hung.add(mesh(new THREE.PlaneGeometry(0.16, 0.6), new THREE.MeshStandardMaterial({ color: '#dbe9f5', emissive: '#eef6ff', emissiveIntensity: 0.4, roughness: 0.2 }), { x: -0.2, y: 1.45, z: 0.027 }));
  hung.add(mesh(rounded(0.86, 0.22, 0.012, 0.005, 1), new THREE.MeshStandardMaterial({ color: '#c8cfd6', metalness: 0.6, roughness: 0.35 }), { y: 0.13, z: 0.03 }));
  hung.add(mesh(rounded(0.16, 0.025, 0.05, 0.01, 1), new THREE.MeshStandardMaterial({ color: '#c8cfd6', metalness: 0.7, roughness: 0.25 }), { x: 0.3, y: 1.05, z: 0.06 }));
  door.add(mesh(rounded(0.07, 2.16, 0.04, 0.01, 1), frame, { x: -0.5, y: 1.08, z: WALL_T / 2 + 0.02 }));
  door.add(mesh(rounded(0.07, 2.16, 0.04, 0.01, 1), frame, { x: 0.5, y: 1.08, z: WALL_T / 2 + 0.02 }));
  door.add(mesh(rounded(1.07, 0.07, 0.04, 0.01, 1), frame, { y: 2.13, z: WALL_T / 2 + 0.02 }));
  object.add(door);
  // hand-gel dispenser beside the door
  object.add(mesh(rounded(0.12, 0.22, 0.09, 0.03, 2), clay('#ffffff'), { x: -W / 2 + DOOR_AT + 0.72, y: 1.25, z: WALL_IN + 0.05 }));
  object.add(mesh(rounded(0.08, 0.05, 0.02, 0.01, 1), clay(C.blue), { x: -W / 2 + DOOR_AT + 0.72, y: 1.3, z: WALL_IN + 0.1 }));

  // the nurse's desk against the back wall: white top, pale grey pedestal, screen and keyboard
  const DESK_W = 1.5;
  const DESK_D = 0.7;
  const deskZ = WALL_IN + DESK_D / 2;
  object.add(mesh(rounded(DESK_W, 0.035, DESK_D, 0.012, 1), clay('#ffffff'), { x: DESK_X, y: DESK_TOP - 0.0175, z: deskZ }));
  object.add(mesh(rounded(0.42, DESK_TOP - 0.035, DESK_D - 0.06, 0.012, 1), clay('#e6ebf0'), { x: DESK_X + DESK_W / 2 - 0.24, y: (DESK_TOP - 0.035) / 2, z: deskZ }));
  for (let i = 0; i < 3; i++) object.add(mesh(rounded(0.32, 0.012, 0.012, 0.005, 1), clay(C.grey), { x: DESK_X + DESK_W / 2 - 0.24, y: 0.2 + i * 0.22, z: deskZ + DESK_D / 2 - 0.02 }));
  object.add(mesh(rounded(0.04, DESK_TOP - 0.035, DESK_D - 0.06, 0.01, 1), clay('#e6ebf0'), { x: DESK_X - DESK_W / 2 + 0.04, y: (DESK_TOP - 0.035) / 2, z: deskZ }));
  // monitor with a calm results screen, angled toward the room
  const mon = group();
  mon.position.set(DESK_X - 0.15, DESK_TOP, WALL_IN + 0.22);
  mon.rotation.y = -0.3;
  mon.add(mesh(rounded(0.2, 0.012, 0.16, 0.005, 1), clay('#2b2f36'), { y: 0.006 }));
  mon.add(mesh(rounded(0.05, 0.22, 0.03, 0.01, 1), clay('#2b2f36'), { y: 0.12, z: -0.03 }));
  mon.add(mesh(rounded(0.6, 0.37, 0.03, 0.012, 1), clay('#2b2f36'), { y: 0.42 }));
  const { tex: ui } = canvasTexture(384, 224, (c, w, h) => {
    c.fillStyle = '#f4f8fc';
    c.fillRect(0, 0, w, h);
    c.fillStyle = C.blue;
    c.fillRect(0, 0, w, 30);
    c.fillStyle = '#ffffff';
    c.font = `700 16px ${FONT}`;
    c.fillText('Screening results', 12, 21);
    c.fillStyle = '#dbe6f2';
    c.fillRect(14, 46, 160, 160);
    c.fillStyle = '#7fa6cf';
    for (let i = 0; i < 5; i++) c.fillRect(30 + i * 28, 190 - (40 + ((i * 37) % 90)), 18, 40 + ((i * 37) % 90));
    c.fillStyle = '#c9d6e3';
    for (let i = 0; i < 6; i++) c.fillRect(192, 52 + i * 24, i % 3 === 2 ? 100 : 170, 10);
    c.fillStyle = '#0e7c7b';
    c.fillRect(192, 196, 90, 14);
  });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.33), new THREE.MeshStandardMaterial({ map: ui, emissive: '#ffffff', emissiveMap: ui, emissiveIntensity: 0.55, roughness: 0.3 }));
  scr.position.set(0, 0.42, 0.016);
  mon.add(scr);
  object.add(mon);
  object.add(mesh(rounded(0.42, 0.018, 0.14, 0.006, 1), clay('#eef1f4'), { x: DESK_X - 0.1, y: DESK_TOP + 0.009, z: WALL_IN + 0.5, ry: -0.3 }));
  object.add(mesh(rounded(0.06, 0.02, 0.1, 0.01, 1), clay('#eef1f4'), { x: DESK_X + 0.18, y: DESK_TOP + 0.01, z: WALL_IN + 0.52 }));
  // pen pot and a few leaflets
  object.add(mesh(cylinder(0.04, 0.04, 0.1, 16), clay(C.blue), { x: DESK_X + 0.55, y: DESK_TOP + 0.05, z: WALL_IN + 0.12 }));
  for (const [dx, col] of [[-0.012, '#2b2f36'], [0.012, '#d65a4f']]) object.add(mesh(cylinder(0.005, 0.005, 0.14, 6), clay(col), { x: DESK_X + 0.55 + dx, y: DESK_TOP + 0.12, z: WALL_IN + 0.12, rz: dx * 8 }));
  object.add(mesh(rounded(0.21, 0.02, 0.29, 0.004, 1), clay('#ffffff'), { x: DESK_X + 0.42, y: DESK_TOP + 0.01, z: WALL_IN + 0.33, ry: -0.2 }));
  object.add(mesh(rounded(0.2, 0.004, 0.06, 0.002, 1), clay(C.blue), { x: DESK_X + 0.42, y: DESK_TOP + 0.022, z: WALL_IN + 0.24, ry: -0.2 }));

  // the two chairs, turned toward each other in front of the desk
  const nurseFacing = faceToward(NURSE, PATIENT);
  const patientFacing = faceToward(PATIENT, NURSE);
  const nc = chair({ seat: 0.45, color: C.blue, frame: '#3e4248', style: 'office', back: 0.4 });
  nc.position.set(...NURSE);
  nc.rotation.y = nurseFacing;
  object.add(nc);
  const pc = chair({ seat: 0.45, color: C.soft, frame: '#aeb8c2', style: 'visitor', back: 0.45 });
  pc.position.set(...PATIENT);
  pc.rotation.y = patientFacing;
  object.add(pc);

  // exam couch along the left wall, with a paper roll and a step
  const couch = group();
  couch.position.set(LEFT_IN + 0.4, 0, -0.75);
  couch.rotation.y = Math.PI / 2; // length along z, head at the back
  const LEN = 1.85;
  couch.add(mesh(rounded(LEN - 0.3, 0.5, 0.5, 0.03, 1), clay('#ffffff'), { y: 0.33 }));
  couch.add(mesh(rounded(LEN - 0.2, 0.08, 0.6, 0.02, 1), clay('#e6ebf0'), { y: 0.06 }));
  couch.add(mesh(rounded(LEN - 0.55, 0.1, 0.66, 0.05, 2), clay(C.couch), { x: 0.25, y: 0.64 }));
  const head = mesh(rounded(0.6, 0.1, 0.66, 0.05, 2), clay(C.couch), { x: -LEN / 2 + 0.34, y: 0.74, rz: -0.35 });
  couch.add(head);
  couch.add(mesh(rounded(LEN - 0.65, 0.008, 0.5, 0.004, 1), clay('#ffffff'), { x: 0.25, y: 0.694 }));
  couch.add(mesh(cylinder(0.05, 0.05, 0.56, 20), clay('#ffffff'), { x: LEN / 2 - 0.03, y: 0.62, rx: Math.PI / 2 }));
  couch.add(mesh(rounded(0.3, 0.16, 0.4, 0.02, 1), clay('#e6ebf0'), { x: 0.3, y: 0.08, z: 0.5 }));
  object.add(couch);
  // folding privacy screen at the foot of the couch, pale teal fabric in white frames
  const screen = group();
  screen.position.set(LEFT_IN + 0.28, 0, 0.42);
  screen.rotation.y = -Math.PI / 2 + 0.25;
  for (let i = 0; i < 3; i++) {
    const p = group();
    p.position.x = i * 0.5;
    p.rotation.y = i % 2 ? 0.35 : -0.1;
    p.add(mesh(rounded(0.48, 1.55, 0.03, 0.015, 1), clay(C.screen), { y: 0.95 }));
    p.add(mesh(rounded(0.5, 0.04, 0.04, 0.015, 1), clay('#ffffff'), { y: 1.74 }));
    p.add(mesh(cylinder(0.015, 0.015, 1.78, 8), clay('#ffffff'), { x: -0.24, y: 0.89 }));
    screen.add(p);
  }
  object.add(screen);
  // window above the couch on the left wall
  const win = windowFrame(1.0, 0.85, { bars: 1, sill: true });
  win.position.set(LEFT_IN, 1.65, -0.95);
  win.rotation.y = Math.PI / 2;
  object.add(win);

  // a calm poster over the desk, a wall clock, a plant
  const poster = picture(0.6, 0.8, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = C.blue;
    c.fillRect(0, 0, w, h * 0.2);
    c.fillStyle = '#ffffff';
    c.font = `700 ${Math.round(w * 0.08)}px ${FONT}`;
    c.fillText('Bowel cancer', w * 0.08, h * 0.09);
    c.fillText('screening', w * 0.08, h * 0.16);
    c.strokeStyle = '#7fa6cf';
    c.lineWidth = w * 0.05;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(w * 0.3, h * 0.85);
    c.lineTo(w * 0.3, h * 0.35);
    c.lineTo(w * 0.7, h * 0.35);
    c.lineTo(w * 0.7, h * 0.6);
    c.lineTo(w * 0.45, h * 0.62);
    c.stroke();
    c.fillStyle = '#0e7c7b';
    c.beginPath();
    c.arc(w * 0.7, h * 0.5, w * 0.06, 0, Math.PI * 2);
    c.fill();
  }, { frame: '#ffffff' });
  poster.position.set(DESK_X + 0.15, 1.62, WALL_IN);
  object.add(poster);
  const clock = group();
  clock.position.set(DESK_X - 0.75, 1.95, WALL_IN);
  clock.add(mesh(cylinder(0.15, 0.15, 0.04, 32), clay(C.blue), { z: 0.02, rx: Math.PI / 2 }));
  clock.add(mesh(cylinder(0.13, 0.13, 0.01, 32), clay('#ffffff'), { z: 0.04, rx: Math.PI / 2 }));
  clock.add(mesh(rounded(0.01, 0.09, 0.005, 0.003, 1), clay('#2b2f36'), { y: 0.035, z: 0.048 }));
  clock.add(mesh(rounded(0.06, 0.01, 0.005, 0.003, 1), clay('#2b2f36'), { x: 0.025, z: 0.048, rz: 0.4 }));
  object.add(clock);
  const pl = plant(1.05, { pot: '#ffffff', tall: true });
  pl.position.set(W / 2 - 0.35, 0, WALL_IN + 0.3);
  object.add(pl);
  // a small round side table between the chairs with a box of tissues and a water glass
  const side = group();
  side.position.set(0.1, 0, -1.4);
  side.add(mesh(cylinder(0.22, 0.22, 0.03, 32), clay('#ffffff'), { y: 0.55 }));
  side.add(mesh(cylinder(0.025, 0.025, 0.54, 10), clay(C.grey), { y: 0.27 }));
  side.add(mesh(cylinder(0.15, 0.15, 0.015, 24), clay(C.grey), { y: 0.008 }));
  side.add(mesh(rounded(0.2, 0.1, 0.11, 0.015, 1), clay('#dbe9f5'), { x: -0.05, y: 0.615 }));
  side.add(mesh(cylinder(0.035, 0.03, 0.1, 16), new THREE.MeshStandardMaterial({ color: '#e8f2fb', roughness: 0.1, transparent: true, opacity: 0.6 }), { x: 0.1, y: 0.62, z: 0.05 }));
  object.add(side);

  return { object, ...LAYOUT, walls: { back }, doors: [{ ...LAYOUT.doors[0], leaf, swing: -1 }] };
}
