// Factory: a sawtooth-roof works with two chimneys. More and larger smoke puffs as the value rises.
import { clay, rounded, cylinder, sphere, mesh, group, PALETTE, THREE, lerp, clamp01 } from './kit.js';

const PER = 4;

export default function build({ color = PALETTE.sand } = {}) {
  const object = group();
  const hallH = 1.0;
  object.add(mesh(rounded(2.0, hallH, 1.3, 0.08), clay(color), { x: 0.15, y: hallH / 2 }));
  // sawtooth roof
  const tooth = new THREE.Shape();
  tooth.moveTo(0, 0);
  tooth.lineTo(0.62, 0);
  tooth.lineTo(0.62, 0.42);
  tooth.closePath();
  const toothGeo = new THREE.ExtrudeGeometry(tooth, { depth: 1.2, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  toothGeo.translate(0, 0, -0.6);
  const roofMat = clay(PALETTE.terracotta);
  for (let i = 0; i < 3; i++) object.add(mesh(toothGeo, roofMat, { x: -0.78 + i * 0.64, y: hallH }));
  // windows + door
  const winMat = clay('#ffd98a', { emissive: 0.15 });
  for (let i = 0; i < 3; i++) object.add(mesh(rounded(0.36, 0.3, 0.05, 0.04), winMat, { x: -0.45 + i * 0.5, y: 0.62, z: 0.65 }));
  object.add(mesh(rounded(0.36, 0.48, 0.05, 0.04), clay(PALETTE.navy), { x: 0.85, y: 0.24, z: 0.65 }));
  // chimneys + smoke
  const chimMat = clay(PALETTE.slate);
  const smokeMat = clay('#e7e1d8');
  const puffGeo = sphere(1, 24);
  const puffs = [];
  [[-0.55, -0.3, 1.85], [0.05, -0.35, 1.55]].forEach(([x, z, top], c) => {
    object.add(mesh(cylinder(0.15, 0.18, top, 20), chimMat, { x, y: top / 2, z }));
    object.add(mesh(cylinder(0.19, 0.19, 0.08, 20), clay(PALETTE.terracotta), { x, y: top - 0.04, z }));
    for (let i = 0; i < PER; i++) {
      const p = mesh(puffGeo, smokeMat);
      p.userData = { x: x + i * 0.14, y: top + 0.18 + i * 0.27, z, r: 0.13 + i * 0.035, order: i * 2 + c };
      object.add(p);
      puffs.push(p);
    }
  });
  const LIGHT = new THREE.Color('#ece7df');
  const DARK = new THREE.Color('#b9b3ab');
  return {
    object,
    height: 3.1,
    setValue(v) {
      const n = lerp(1, PER * 2, v);
      const size = lerp(0.75, 1.2, v);
      puffs.forEach((p) => {
        const { x, y, z, r, order } = p.userData;
        const t = clamp01(n - order);
        p.visible = t > 0.01;
        p.position.set(x, y, z);
        p.scale.setScalar(r * size * t);
      });
      smokeMat.color.lerpColors(LIGHT, DARK, v);
      winMat.emissiveIntensity = lerp(0.1, 0.5, v);
    },
  };
}
