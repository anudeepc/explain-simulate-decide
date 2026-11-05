// Power bill: a printed bill on a small easel. The amount bar grows and warms as the value rises.
import { clay, rounded, mesh, group, canvasTexture, PALETTE, FONT, THREE, lerp } from './kit.js';

const LOW = new THREE.Color(PALETTE.sage);
const MID = new THREE.Color(PALETTE.gold);
const HIGH = new THREE.Color(PALETTE.terracotta);

export default function build({ color = PALETTE.terracotta } = {}) {
  const object = group();
  // easel base with a front lip that holds the sheet
  object.add(mesh(rounded(1.8, 0.16, 0.9, 0.07), clay(PALETTE.sand), { y: 0.08 }));
  object.add(mesh(rounded(1.6, 0.12, 0.1, 0.04), clay(PALETTE.sand), { y: 0.2, z: 0.2 }));
  // back strut
  object.add(mesh(rounded(0.14, 1.3, 0.1, 0.04), clay(PALETTE.sand), { y: 0.8, z: -0.3, rx: 0.22 }));

  const W = 1.5;
  const H = 2.0;
  const sheet = group();
  sheet.position.set(0, 0.16, 0.06);
  sheet.rotation.x = -0.14;
  object.add(sheet);
  sheet.add(mesh(rounded(W, H, 0.06, 0.03), clay(PALETTE.paper), { y: H / 2 }));

  // printed face: header, a "$" mark and a few muted lines (kept deliberately minimal)
  const { tex } = canvasTexture(384, 512, (c, w, h) => {
    c.fillStyle = PALETTE.paper;
    c.fillRect(0, 0, w, h);
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(28, 28, w - 56, 54, 14);
    c.fill();
    c.fillStyle = PALETTE.ink;
    c.font = `700 120px ${FONT}`;
    c.textBaseline = 'middle';
    c.fillText('$', 34, 170);
    c.fillStyle = '#d9cfbf';
    [[120, 132, 200], [120, 170, 160], [120, 208, 190], [34, 262, 300], [34, 296, 240]].forEach(([x, y, len]) => {
      c.beginPath();
      c.roundRect(x, y, len, 14, 7);
      c.fill();
    });
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, H - 0.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.set(0, H / 2, 0.032);
  sheet.add(face);

  // amount: a track with a fill that grows left→right
  const trackW = 1.18;
  const trackY = 0.42;
  sheet.add(mesh(rounded(trackW + 0.08, 0.3, 0.04, 0.05), clay('#ece3d4'), { y: trackY, z: 0.04 }));
  const fillMat = clay(PALETTE.sage, { emissive: 0.12 });
  const fillGeo = rounded(trackW, 0.22, 0.08, 0.06);
  fillGeo.translate(trackW / 2, 0, 0);
  const fill = mesh(fillGeo, fillMat, { x: -trackW / 2, y: trackY, z: 0.06 });
  sheet.add(fill);

  return {
    object,
    height: 2.3,
    setValue(v) {
      fill.scale.x = lerp(0.1, 1, v);
      fill.scale.y = lerp(0.85, 1.2, v);
      if (v < 0.5) fillMat.color.lerpColors(LOW, MID, v * 2);
      else fillMat.color.lerpColors(MID, HIGH, (v - 0.5) * 2);
      fillMat.emissive.copy(fillMat.color);
      fillMat.emissiveIntensity = lerp(0.08, 0.3, v);
    },
  };
}
