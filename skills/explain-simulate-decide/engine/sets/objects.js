// Hand-held objects for the screening film: the invitation letter, the return envelope
// and the FIT home test kit. Each is built with its origin at its centre.
// Paper is modelled upright in the XY plane with its printed face toward +Z (as if held up
// to the camera); to lay one flat, rotate it by userData.flat (x = -PI/2, printed face up).
// Sizes are real sizes scaled up so they read on screen (see userData.scale).
import { clay, rounded, cylinder, sphere, mesh, group, canvasTexture, FONT, THREE } from '../cast/kit.js';

const NHS_BLUE = '#1f63b5';
const PAPER = '#ffffff';
const CAP = '#2f9a5c';

/** Letters and envelopes are drawn 1.5x real size; the kit tube 2x (it is tiny). */
export const OBJECT_SCALE = { letter: 1.5, envelope: 1.5, kit: 2 };

function paperBox(w, h, t, front, back) {
  const side = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.9 });
  const mf = new THREE.MeshStandardMaterial({ map: front, roughness: 0.88 });
  const mb = back ? new THREE.MeshStandardMaterial({ map: back, roughness: 0.88 }) : side;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), [side, side, side, side, mf, mb]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function nhsLozenge(c, x, y, h) {
  // a blue lozenge with "NHS", like the top-right of an NHS letter
  const w = h * 2.3;
  c.fillStyle = NHS_BLUE;
  c.fillRect(x - w, y, w, h);
  c.fillStyle = '#ffffff';
  c.font = `italic 800 ${Math.round(h * 0.8)}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('NHS', x - w / 2, y + h * 0.54);
}

function lines(c, x, y, n, w, gap, color = '#c9cfd6', hh = 9) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    c.beginPath();
    c.roundRect(x, y + i * gap, i % 4 === 3 ? w * 0.6 : w, hh, hh / 2);
    c.fill();
  }
}

/** A5 invitation letter (148 x 210 mm), white with a blue band and heading. */
function letter() {
  const k = OBJECT_SCALE.letter;
  const w = 0.148 * k;
  const h = 0.21 * k;
  const { tex } = canvasTexture(444, 630, (c, W, H) => {
    c.fillStyle = PAPER;
    c.fillRect(0, 0, W, H);
    nhsLozenge(c, W - 30, 26, 46);
    c.fillStyle = NHS_BLUE;
    c.fillRect(0, 100, W, 92);
    c.fillStyle = '#ffffff';
    c.font = `700 30px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('Bowel cancer', 30, 130);
    c.fillText('screening', 30, 166);
    c.fillStyle = '#212b32';
    c.font = `700 22px ${FONT}`;
    c.fillText('Your home test kit', 30, 228);
    lines(c, 30, 258, 8, W - 60, 26);
    c.fillStyle = '#e8f0f9';
    c.fillRect(30, 480, W - 60, 92);
    c.fillStyle = NHS_BLUE;
    c.fillRect(30, 480, 8, 92);
    lines(c, 54, 500, 3, W - 110, 24, '#9fb7d6');
  });
  const m = paperBox(w, h, 0.003, tex);
  return finish(m, 'letter', [w, h, 0.003]);
}

/** DL return envelope (110 x 220 mm), white with a blue logo stripe and an address panel. */
function envelope() {
  const k = OBJECT_SCALE.envelope;
  const w = 0.22 * k;
  const h = 0.11 * k;
  const t = 0.008;
  const { tex: front } = canvasTexture(704, 352, (c, W, H) => {
    c.fillStyle = PAPER;
    c.fillRect(0, 0, W, H);
    c.fillStyle = NHS_BLUE;
    c.fillRect(0, 0, 34, H);
    nhsLozenge(c, W - 26, 22, 42);
    // freepost mark
    c.strokeStyle = '#212b32';
    c.lineWidth = 3;
    c.strokeRect(W - 200, 82, 174, 56);
    c.fillStyle = '#212b32';
    c.font = `700 22px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('FREEPOST', W - 113, 110);
    // address block
    c.textAlign = 'left';
    c.font = `700 24px ${FONT}`;
    c.fillText('Bowel Screening Hub', 230, 196);
    lines(c, 230, 222, 3, 300, 26, '#a9b3bd', 10);
    c.fillStyle = '#212b32';
    c.font = `600 18px ${FONT}`;
    c.fillText('Use only for your test kit', 60, 40);
  });
  const { tex: back } = canvasTexture(704, 352, (c, W, H) => {
    c.fillStyle = '#fbfbfb';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#d5d9de';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, 6);
    c.lineTo(W / 2, H * 0.55);
    c.lineTo(W, 6);
    c.stroke();
    c.fillStyle = NHS_BLUE;
    c.fillRect(0, 0, 34, H);
  });
  const m = paperBox(w, h, t, front, back);
  return finish(m, 'envelope', [w, h, t]);
}

/** FIT sample tube: white body, ridged coloured cap with the sampling stick, a printed label. */
function kit() {
  const k = OBJECT_SCALE.kit;
  const L = 0.09 * k; // overall length
  const R = 0.0085 * k; // body radius
  const g = group();
  const body = new THREE.MeshStandardMaterial({ color: '#f7f9fb', roughness: 0.45 });
  const bodyH = L * 0.66;
  const y0 = -L / 2;
  // tapered tip at the bottom, then the tube
  g.add(mesh(cylinder(R * 0.92, R * 0.55, L * 0.08, 24), body, { y: y0 + L * 0.04 }));
  g.add(mesh(cylinder(R, R * 0.92, bodyH - L * 0.08, 32), body, { y: y0 + L * 0.08 + (bodyH - L * 0.08) / 2 }));
  // label wrapped around the body
  const { tex } = canvasTexture(512, 256, (c, W, H) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    c.fillStyle = NHS_BLUE;
    c.fillRect(0, 0, W, 54);
    c.fillStyle = '#ffffff';
    c.font = `800 38px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('FIT', 22, 29);
    c.fillText('FIT', 278, 29);
    c.fillStyle = '#212b32';
    c.font = `600 20px ${FONT}`;
    for (const x0 of [22, 278]) {
      c.fillText('Name', x0, 88);
      c.fillText('Date', x0, 150);
      c.fillStyle = '#c9cfd6';
      c.fillRect(x0 + 62, 98, 150, 3);
      c.fillRect(x0 + 62, 160, 150, 3);
      c.fillStyle = '#212b32';
    }
    // barcode
    for (let i = 0; i < 60; i++) if ((i * 7) % 3) c.fillRect(22 + i * 3.6, 196, (i % 4) + 1, 40);
  });
  const labelH = bodyH * 0.62;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.012, R * 1.012, labelH, 40, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  label.position.y = y0 + L * 0.1 + labelH / 2 + bodyH * 0.06;
  label.rotation.y = -Math.PI / 2; // "FIT" faces +Z
  label.castShadow = true;
  g.add(label);
  // cap: a collar, a ridged grip and a domed top
  const capMat = clay(CAP);
  const capY0 = y0 + bodyH;
  const capH = L - bodyH;
  g.add(mesh(cylinder(R * 1.08, R * 1.08, capH * 0.18, 32), capMat, { y: capY0 + capH * 0.09 }));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.18, R * 1.18, capH * 0.62, 24, 1), capMat);
  grip.position.y = capY0 + capH * 0.18 + capH * 0.31;
  grip.castShadow = grip.receiveShadow = true;
  g.add(grip);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(mesh(rounded(R * 0.18, capH * 0.56, R * 0.18, R * 0.08, 1), capMat, { x: Math.cos(a) * R * 1.18, y: grip.position.y, z: Math.sin(a) * R * 1.18 }));
  }
  g.add(mesh(sphere(R * 1.18, 24), capMat, { y: capY0 + capH * 0.8, s: 1 }));
  g.children[g.children.length - 1].scale.set(1, 0.32, 1);
  // the sampling stick shows faintly through the translucent tube
  g.add(mesh(cylinder(R * 0.18, R * 0.18, bodyH * 0.8, 8), clay(CAP, { opacity: 0.5 }), { y: y0 + bodyH * 0.55 }));
  return finish(g, 'kit', [R * 2.36, L, R * 2.36]);
}

function finish(object, name, size) {
  object.name = `object:${name}`;
  object.userData = { size, scale: OBJECT_SCALE[name], flat: name === 'kit' ? [0, 0, Math.PI / 2] : [-Math.PI / 2, 0, 0] };
  return object;
}

const BUILDERS = { letter, envelope, kit };

/** @param {'letter'|'envelope'|'kit'} name  @returns {THREE.Object3D} */
export function buildObject(name) {
  const b = BUILDERS[name];
  if (!b) throw new Error(`unknown object "${name}"`);
  return b();
}
