// Postbox: a pavement corner with a classic red pillar box, a street lamp, a low rendered
// garden wall with a hedge, a street-name plaque, and double yellow lines along the kerb.
import { clay, rounded, cylinder, sphere, torus, mesh, group, canvasTexture, FONT, THREE } from '../cast/kit.js';
import { SET_PALETTE, floor, floorTexture, plant, mark, faceToward, r3 } from './parts.js';

const W = 5.6;
const D = 4.4;
const KERB_Z = 1.15; // front kerb line
const KERB_X = 2.0; // side kerb line
const ROAD_Y = -0.12;
const SLOT_Y = 1.15;

/** A classic cylindrical pillar box, slot facing +Z. */
function pillarBox() {
  const g = group();
  const red = clay('#c8202f');
  const black = clay('#1d1f22');
  const R = 0.27;
  const BODY = 1.28;
  g.add(mesh(cylinder(R + 0.05, R + 0.06, 0.12, 40), black, { y: 0.06 }));
  g.add(mesh(cylinder(R, R, BODY, 40), red, { y: 0.12 + BODY / 2 }));
  // collar ring, overhanging cap and a domed top with a small finial
  const capY = 0.12 + BODY;
  g.add(mesh(cylinder(R + 0.02, R + 0.02, 0.05, 40), red, { y: capY - 0.06 }));
  g.add(mesh(cylinder(R + 0.06, R + 0.03, 0.07, 40), red, { y: capY + 0.035 }));
  const dome = mesh(sphere(R + 0.05, 32), red, { y: capY + 0.07 });
  dome.scale.y = 0.42;
  g.add(dome);
  g.add(mesh(sphere(0.045, 14), red, { y: capY + 0.2 }));
  // slot: a dark mouth under a hooded lip
  g.add(mesh(rounded(0.38, 0.05, 0.08, 0.018, 2), black, { y: SLOT_Y, z: R - 0.02 }));
  g.add(mesh(rounded(0.44, 0.035, 0.1, 0.015, 2), red, { y: SLOT_Y + 0.045, z: R - 0.005, rx: -0.15 }));
  // collection-times plate and the door outline
  const { tex } = canvasTexture(128, 96, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8202f';
    c.fillRect(0, 0, w, 18);
    c.fillStyle = '#222';
    for (let i = 0; i < 4; i++) c.fillRect(12, 30 + i * 15, i % 2 ? 70 : 100, 6);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.13), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  plate.position.set(0, 0.97, R + 0.012);
  g.add(plate);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.62, 24, 1, true, -0.55, 1.1), clay('#b31b29'));
  door.position.y = 0.55;
  door.castShadow = true;
  g.add(door);
  g.add(mesh(rounded(0.05, 0.03, 0.03, 0.01, 1), clay('#d2a948'), { x: 0.1, y: 0.62, z: R + 0.012 }));
  return g;
}

/** A tall street lamp: tapered pole, a swan-neck arm and a lantern. Arm points +X. */
function lamp() {
  const g = group();
  const m = clay('#2e3a40');
  g.add(mesh(cylinder(0.12, 0.14, 0.4, 20), m, { y: 0.2 }));
  g.add(mesh(cylinder(0.05, 0.075, 2.7, 16), m, { y: 0.4 + 1.35 }));
  g.add(mesh(torus(0.05, 0.08, 12), m, { y: 0.42 }));
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 10, 24, Math.PI / 2), m);
  arm.position.set(0.32, 3.1, 0);
  arm.rotation.z = Math.PI / 2;
  arm.castShadow = true;
  g.add(arm);
  g.add(mesh(rounded(0.42, 0.08, 0.24, 0.03, 2), m, { x: 0.62, y: 3.4 }));
  g.add(mesh(rounded(0.34, 0.03, 0.18, 0.01, 1), new THREE.MeshStandardMaterial({ color: '#fff7e2', emissive: '#ffe9b0', emissiveIntensity: 0.8 }), { x: 0.62, y: 3.35 }));
  return g;
}

export default function build() {
  const object = group();
  object.name = 'set:postbox';

  // pavement (top at y = 0) with slabs, and the road a kerb-height lower
  const slabs = floorTexture('slabs', '#dfe2e5', '#c6cbd0', { repeat: [3.4, 2.6] });
  const pavW = KERB_X + W / 2;
  const pavD = KERB_Z + D / 2;
  object.add(floor(pavW, pavD, { map: slabs, x: -W / 2 + pavW / 2, z: -D / 2 + pavD / 2, thick: 0.2 }));
  const asphalt = clay('#6b727a');
  const road = (w, d, x, z) => {
    const r = mesh(rounded(w, 0.1, d, 0.02, 1), asphalt, { x, y: ROAD_Y - 0.05, z });
    r.castShadow = false;
    object.add(r);
  };
  road(W, D / 2 - KERB_Z, 0, KERB_Z + (D / 2 - KERB_Z) / 2);
  road(W / 2 - KERB_X, KERB_Z + D / 2, KERB_X + (W / 2 - KERB_X) / 2, -D / 2 + (KERB_Z + D / 2) / 2);
  // kerb stones
  const kerb = clay('#c9ced3');
  object.add(mesh(rounded(KERB_X + W / 2, 0.14, 0.16, 0.025, 1), kerb, { x: (-W / 2 + KERB_X) / 2, y: -0.06, z: KERB_Z }));
  object.add(mesh(rounded(0.16, 0.14, KERB_Z + D / 2, 0.025, 1), kerb, { x: KERB_X, y: -0.06, z: (KERB_Z - D / 2) / 2 }));
  // double yellow lines along both kerbs
  const yellow = clay('#f2c230');
  for (const o of [0.16, 0.28]) {
    const a = mesh(rounded(KERB_X + W / 2 - o, 0.006, 0.06, 0.003, 1), yellow, { x: (-W / 2 + KERB_X - o) / 2, y: ROAD_Y + 0.003, z: KERB_Z + o });
    const b = mesh(rounded(0.06, 0.006, KERB_Z + D / 2 + o, 0.003, 1), yellow, { x: KERB_X + o, y: ROAD_Y + 0.003, z: (KERB_Z - D / 2 + o) / 2 });
    a.castShadow = b.castShadow = false;
    object.add(a, b);
  }

  // a low rendered garden wall with coping, a hedge behind it, and a gate gap
  const BACKZ = -D / 2 + 0.25;
  const render = clay('#f3f1ee');
  const coping = clay('#d6d9dc');
  const hedge = [clay(SET_PALETTE.leafDark), clay(SET_PALETTE.leaf)];
  for (const [x0, x1] of [[-W / 2, 0.55], [1.35, KERB_X - 0.1]]) {
    const w = x1 - x0;
    object.add(mesh(rounded(w, 0.85, 0.24, 0.02, 1), render, { x: (x0 + x1) / 2, y: 0.425, z: BACKZ }));
    object.add(mesh(rounded(w + 0.04, 0.06, 0.3, 0.02, 1), coping, { x: (x0 + x1) / 2, y: 0.88, z: BACKZ }));
    const n = Math.max(1, Math.round(w / 0.7));
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * (w / n);
      object.add(mesh(rounded(w / n + 0.06, 0.62, 0.5, 0.22, 3), hedge[i % 2], { x, y: 1.18 + Math.sin(i * 2.1) * 0.04, z: BACKZ - 0.22 }));
    }
  }
  // gate piers and a street-name plaque
  for (const x of [0.62, 1.28]) {
    object.add(mesh(rounded(0.14, 1.05, 0.26, 0.02, 1), render, { x, y: 0.525, z: BACKZ }));
    object.add(mesh(rounded(0.18, 0.06, 0.3, 0.02, 1), coping, { x, y: 1.08, z: BACKZ }));
  }
  const { tex: nameTex } = canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1d1f22';
    c.lineWidth = 8;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#1d1f22';
    c.font = `700 64px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('ELM ROAD', w / 2, h / 2 + 4);
  });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.18), new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.5 }));
  plaque.position.set(-1.6, 0.55, BACKZ + 0.125);
  object.add(plaque);
  // a street tree over the hedge
  const tree = plant(3.2, { pot: '#c9ced3', tall: true });
  tree.position.set(-2.1, -0.2, BACKZ - 0.55);
  tree.children[0].visible = tree.children[1].visible = false;
  object.add(tree);

  // the pillar box, slot toward the camera, and the lamp near the kerb
  const BOX = [-0.35, 0, -0.75];
  const box = pillarBox();
  box.position.set(...BOX);
  box.rotation.y = 0.18;
  object.add(box);
  const lp = lamp();
  lp.position.set(1.55, 0, KERB_Z - 0.35);
  lp.rotation.y = Math.PI * 0.85;
  object.add(lp);
  // a bollard and a litter bin for street scale
  object.add(mesh(cylinder(0.07, 0.08, 0.9, 16), clay('#2e3a40'), { x: KERB_X - 0.3, y: 0.45, z: -0.7 }));
  object.add(mesh(sphere(0.075, 12), clay('#2e3a40'), { x: KERB_X - 0.3, y: 0.9, z: -0.7 }));
  const bin = group();
  bin.position.set(-2.1, 0, 0.3);
  bin.add(mesh(cylinder(0.22, 0.2, 0.8, 24), clay('#2e3a40'), { y: 0.42 }));
  bin.add(mesh(cylinder(0.24, 0.24, 0.08, 24), clay('#2e3a40'), { y: 0.86 }));
  bin.add(mesh(cylinder(0.06, 0.06, 0.04, 12), clay('#2e3a40'), { y: 0.02 }));
  object.add(bin);

  // standing at the box's right, turned to the slot (the camera sees the slot and the person's side)
  const a = 0.18;
  const slot = [BOX[0] + Math.sin(a) * 0.3, SLOT_Y, BOX[2] + Math.cos(a) * 0.3];
  const stand = [BOX[0] + 0.62, 0, BOX[2] + 0.42];
  return {
    object,
    marks: {
      box: mark(r3(stand), r3(faceToward(stand, [slot[0], 0, slot[2]]))),
      approach: mark([1.15, 0, 0.45], -2.2),
    },
    spots: {
      slot: r3(slot),
      lamp: r3([1.55, 0, KERB_Z - 0.35]),
    },
    cameras: {
      close: { position: [-0.95, 1.45, 1.55], target: [-0.05, 1.1, -0.55] },
      medium: { position: [-1.1, 1.5, 3.7], target: [0.1, 1.0, -0.6] },
      wide: { position: [-0.6, 2.6, 7.9], target: [0, 1.6, -0.4] },
    },
  };
}
