// Kitchen: a run of sage cabinets with a white worktop under a garden window, a hob and
// oven, a kettle, a fruit bowl, and a small table with a chair. Where the kit gets done.
import { clay, rounded, cylinder, sphere, torus, mesh, group, canvasTexture, THREE } from '../cast/kit.js';
import { WALL_T, SET_PALETTE, floor, floorTexture, wall, windowFrame, plant, chair, mark, faceToward, r3 } from './parts.js';

const W = 5.2;
const D = 4.2;
const BACK = -D / 2;
const TOP = 0.92; // worktop surface
const DEPTH = 0.62;

export default function build() {
  const object = group();
  object.name = 'set:kitchen';
  const C = { cab: '#86ad9b', cabDark: '#6f9584', worktop: '#fbfbfa', handle: '#2f3437', tile: '#ffffff', grout: '#dfe3e6', wall: '#f7f7f5' };
  const WALL_IN = BACK + WALL_T / 2; // room face of the back wall

  object.add(floor(W, D, { map: floorTexture('tiles', '#e9ecee', '#d3d8dc', { repeat: [3, 2.4] }) }));
  object.add(wall(-W / 2, BACK, W / 2, BACK, { color: C.wall }));
  object.add(wall(-W / 2 + WALL_T / 2, D / 2 - 0.9, -W / 2 + WALL_T / 2, BACK - WALL_T / 2, { color: C.wall }));

  // base run along the back wall
  const X0 = -W / 2 + WALL_T;
  const X1 = 0.95;
  const runW = X1 - X0;
  const runX = (X0 + X1) / 2;
  const FRONT = WALL_IN + DEPTH;
  const cab = clay(C.cab);
  const handle = clay(C.handle);
  object.add(mesh(rounded(runW, 0.1, DEPTH - 0.08, 0.01, 1), clay('#4b5357'), { x: runX, y: 0.05, z: WALL_IN + (DEPTH - 0.08) / 2 }));
  object.add(mesh(rounded(runW, TOP - 0.14, DEPTH - 0.04, 0.01, 1), clay(C.cabDark), { x: runX, y: 0.1 + (TOP - 0.14) / 2, z: WALL_IN + (DEPTH - 0.04) / 2 }));
  // doors and drawers, each a soft panel with a slim bar handle
  const doorW = runW / 6;
  const OVEN = 4; // which bay is the oven
  for (let i = 0; i < 6; i++) {
    const x = X0 + doorW * (i + 0.5);
    const z = FRONT - 0.02;
    if (i === OVEN) {
      object.add(mesh(rounded(doorW - 0.02, 0.14, 0.03, 0.01, 1), clay('#2f3437'), { x, y: TOP - 0.13, z }));
      object.add(mesh(rounded(doorW - 0.02, 0.58, 0.03, 0.012, 1), clay('#e9ecee'), { x, y: 0.45, z }));
      object.add(mesh(rounded(doorW - 0.14, 0.3, 0.01, 0.01, 1), new THREE.MeshStandardMaterial({ color: '#1d2226', roughness: 0.15, metalness: 0.3 }), { x, y: 0.42, z: z + 0.017 }));
      object.add(mesh(cylinder(0.012, 0.012, doorW - 0.16, 10), clay(SET_PALETTE.steel), { x, y: 0.67, z: z + 0.045, rz: Math.PI / 2 }));
      continue;
    }
    object.add(mesh(rounded(doorW - 0.02, 0.17, 0.03, 0.012, 1), cab, { x, y: TOP - 0.13, z }));
    object.add(mesh(rounded(doorW - 0.02, 0.58, 0.03, 0.012, 1), cab, { x, y: 0.45, z }));
    object.add(mesh(rounded(0.16, 0.018, 0.02, 0.008, 1), handle, { x, y: TOP - 0.11, z: z + 0.025 }));
    object.add(mesh(rounded(0.018, 0.16, 0.02, 0.008, 1), handle, { x: x + (i % 2 ? -1 : 1) * (doorW / 2 - 0.06), y: 0.6, z: z + 0.025 }));
  }
  // worktop
  object.add(mesh(rounded(runW + 0.02, 0.04, DEPTH + 0.02, 0.01, 1), clay(C.worktop), { x: runX, y: TOP - 0.02, z: WALL_IN + (DEPTH + 0.02) / 2 }));

  // tiled splashback up to the window sill
  const { tex: tiles } = canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = C.grout;
    c.fillRect(0, 0, w, h);
    c.fillStyle = C.tile;
    const tw = 32, th = 16;
    for (let r = 0; r < h / th; r++) for (let k = -1; k < w / tw + 1; k++) c.fillRect(k * tw + (r % 2 ? tw / 2 : 0) + 1, r * th + 1, tw - 2, th - 2);
  });
  tiles.wrapS = THREE.RepeatWrapping;
  tiles.repeat.set(runW / 2, 1);
  const splash = new THREE.Mesh(new THREE.PlaneGeometry(runW, 0.5), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.4 }));
  splash.position.set(runX, TOP + 0.25, WALL_IN + 0.004);
  splash.receiveShadow = true;
  object.add(splash);

  // window over the sink
  const SINK_X = -1.25;
  const win = windowFrame(1.1, 0.95, { bars: 1 });
  win.position.set(SINK_X, TOP + 0.5 + 0.12 + 0.475, WALL_IN);
  object.add(win);
  const herbs = plant(0.32, { pot: '#d9e6df' });
  herbs.position.set(SINK_X - 0.35, TOP + 0.5 + 0.12 - 0.04, WALL_IN + 0.1);
  object.add(herbs);
  // sink and tap
  object.add(mesh(rounded(0.62, 0.012, 0.42, 0.04, 2), new THREE.MeshStandardMaterial({ color: '#c3cad1', roughness: 0.3, metalness: 0.5 }), { x: SINK_X, y: TOP + 0.002, z: WALL_IN + 0.33 }));
  object.add(mesh(rounded(0.54, 0.006, 0.34, 0.03, 2), new THREE.MeshStandardMaterial({ color: '#8f99a3', roughness: 0.35, metalness: 0.5 }), { x: SINK_X, y: TOP + 0.007, z: WALL_IN + 0.33 }));
  const chrome = new THREE.MeshStandardMaterial({ color: '#d7dde2', roughness: 0.18, metalness: 0.85 });
  object.add(mesh(cylinder(0.022, 0.026, 0.3, 14), chrome, { x: SINK_X, y: TOP + 0.15, z: WALL_IN + 0.08 }));
  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 10, 20, Math.PI), chrome);
  spout.position.set(SINK_X, TOP + 0.3, WALL_IN + 0.19);
  spout.rotation.y = Math.PI / 2;
  spout.castShadow = true;
  object.add(spout);

  // hob above the oven bay, kettle beside it
  const ovenX = X0 + doorW * (OVEN + 0.5);
  object.add(mesh(rounded(doorW - 0.04, 0.012, 0.5, 0.02, 1), clay('#1f2427'), { x: ovenX, y: TOP + 0.006, z: WALL_IN + 0.3 }));
  for (const [dx, dz, r] of [[-0.13, -0.12, 0.08], [0.13, -0.12, 0.06], [-0.13, 0.12, 0.06], [0.13, 0.12, 0.08]]) object.add(mesh(torus(r, 0.008, 24), clay('#5d666c'), { x: ovenX + dx, y: TOP + 0.013, z: WALL_IN + 0.3 + dz, rx: Math.PI / 2 }));
  const kettle = group();
  kettle.position.set(X1 - 0.22, TOP, WALL_IN + 0.24);
  const km = clay('#ffffff');
  kettle.add(mesh(cylinder(0.08, 0.1, 0.22, 24), km, { y: 0.13 }));
  kettle.add(mesh(cylinder(0.105, 0.105, 0.02, 24), clay(SET_PALETTE.charcoal), { y: 0.01 }));
  kettle.add(mesh(cylinder(0.05, 0.05, 0.02, 16), clay(SET_PALETTE.charcoal), { y: 0.25 }));
  kettle.add(mesh(torus(0.07, 0.015, 20), clay(SET_PALETTE.charcoal), { x: -0.1, y: 0.15, ry: 0, rz: 0, s: 1 }));
  kettle.add(mesh(cylinder(0.012, 0.022, 0.09, 10), km, { x: 0.11, y: 0.18, rz: -0.9 }));
  object.add(kettle);
  // fruit bowl with lemons, and a chopping board leaning on the tiles
  const bowl = group();
  bowl.position.set(X0 + 0.32, TOP, WALL_IN + 0.32);
  bowl.add(mesh(cylinder(0.16, 0.09, 0.08, 24), clay('#2f5f8f'), { y: 0.04 }));
  for (const [x, z, col] of [[-0.05, 0, '#f2cf3b'], [0.06, 0.03, '#f2cf3b'], [0.0, -0.06, '#e98a2f'], [0.03, 0.08, '#8cbf5a']]) bowl.add(mesh(sphere(0.045, 14), clay(col), { x, y: 0.1, z }));
  object.add(bowl);
  object.add(mesh(rounded(0.36, 0.48, 0.025, 0.04, 2), clay(SET_PALETTE.oak), { x: X0 + 0.95, y: TOP + 0.24, z: WALL_IN + 0.05, rx: -0.12 }));

  // open shelf above the run with jars and mugs
  const SH_Y = 1.78;
  object.add(mesh(rounded(1.0, 0.035, 0.24, 0.01, 1), clay(SET_PALETTE.oak), { x: 0.35, y: SH_Y, z: WALL_IN + 0.12 }));
  const jars = [[-0.05, '#ffffff', 0.18], [0.12, '#ffffff', 0.14], [0.45, '#2f5f8f', 0.1], [0.6, '#e2a33b', 0.1], [0.76, '#ffffff', 0.1]];
  for (const [x, col, h] of jars) {
    object.add(mesh(cylinder(0.05, 0.05, h, 18), clay(col), { x: x, y: SH_Y + 0.0175 + h / 2, z: WALL_IN + 0.12 }));
    if (h > 0.12) object.add(mesh(cylinder(0.052, 0.052, 0.025, 18), clay(SET_PALETTE.oak), { x, y: SH_Y + h + 0.03, z: WALL_IN + 0.12 }));
  }

  // wall clock and a small café table with a chair
  const clock = group();
  clock.position.set(1.75, 1.95, WALL_IN);
  clock.add(mesh(cylinder(0.17, 0.17, 0.04, 32), clay(SET_PALETTE.charcoal), { z: 0.02, rx: Math.PI / 2 }));
  clock.add(mesh(cylinder(0.15, 0.15, 0.01, 32), clay('#ffffff'), { z: 0.04, rx: Math.PI / 2 }));
  clock.add(mesh(rounded(0.012, 0.1, 0.005, 0.003, 1), clay(SET_PALETTE.charcoal), { y: 0.04, z: 0.048 }));
  clock.add(mesh(rounded(0.07, 0.012, 0.005, 0.003, 1), clay(SET_PALETTE.charcoal), { x: 0.03, z: 0.048, rz: -0.5 }));
  object.add(clock);
  const TABLE = [1.85, -0.75];
  const table = group();
  table.position.set(TABLE[0], 0, TABLE[1]);
  table.add(mesh(cylinder(0.4, 0.4, 0.035, 40), clay('#ffffff'), { y: 0.74 }));
  table.add(mesh(cylinder(0.035, 0.035, 0.72, 12), clay(SET_PALETTE.charcoal), { y: 0.36 }));
  table.add(mesh(cylinder(0.22, 0.24, 0.02, 24), clay(SET_PALETTE.charcoal), { y: 0.01 }));
  table.add(mesh(cylinder(0.045, 0.04, 0.09, 16), clay('#e2a33b'), { x: 0.12, y: 0.8, z: -0.08 }));
  table.add(mesh(torus(0.03, 0.008, 12), clay('#e2a33b'), { x: 0.17, y: 0.8, z: -0.08, ry: Math.PI / 2 }));
  object.add(table);
  const CHAIR = [1.12, -0.42];
  const chairFacing = faceToward([CHAIR[0], 0, CHAIR[1]], [TABLE[0], 0, TABLE[1]]);
  const ch = chair({ seat: 0.45, color: SET_PALETTE.oak, frame: SET_PALETTE.charcoal, style: 'wood' });
  ch.position.set(CHAIR[0], 0, CHAIR[1]);
  ch.rotation.y = chairFacing;
  object.add(ch);
  const pl = plant(1.0, { pot: '#ffffff', tall: true });
  pl.position.set(2.25, 0, BACK + 0.4);
  object.add(pl);

  // standing at the worktop in front of the window, turned a little toward the camera
  const counterSpot = [SINK_X + 0.72, TOP, WALL_IN + 0.32];
  const counter = [counterSpot[0] - 0.38, 0, FRONT + 0.4];
  return {
    object,
    marks: {
      counter: mark(counter, r3(faceToward(counter, counterSpot))),
      chair: mark([CHAIR[0], 0, CHAIR[1]], r3(chairFacing), { pose: 'sit', seat: 0.45 }),
    },
    spots: {
      counter: r3(counterSpot),
      sink: r3([SINK_X, TOP, WALL_IN + 0.33]),
      sill: r3([SINK_X + 0.3, TOP + 0.6, WALL_IN + 0.1]),
      table: r3([TABLE[0] - 0.1, 0.76, TABLE[1] + 0.1]),
    },
    cameras: {
      close: { position: [0.85, 1.45, 0.4], target: [-0.65, 1.0, -1.6] },
      medium: { position: [0.95, 1.55, 3.3], target: [-0.55, 0.98, -1.2] },
      wide: { position: [0.6, 2.3, 6.6], target: [0, 1.05, -0.7] },
    },
  };
}
