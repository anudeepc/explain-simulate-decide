// Bank: a small columned building for lenders, banks, funds and insurers.
// The coin emblem on the front glows with the value.
import { clay, rounded, cylinder, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build() {
  const object = group();
  const stone = clay('#ece4d6');
  object.add(mesh(rounded(2.6, 0.18, 1.9, 0.04), clay('#d8cdb9'), { y: 0.09 }));
  object.add(mesh(rounded(2.4, 0.16, 1.7, 0.04), stone, { y: 0.26 }));
  object.add(mesh(rounded(2.0, 1.45, 1.2, 0.06), clay(PALETTE.cream), { y: 1.05, z: -0.15 }));
  for (const x of [-0.9, -0.3, 0.3, 0.9]) object.add(mesh(cylinder(0.12, 0.13, 1.45, 18), stone, { x, y: 1.06, z: 0.62 }));
  object.add(mesh(rounded(2.4, 0.18, 1.7, 0.04), stone, { y: 1.86 }));
  const tri = new THREE.Shape();
  tri.moveTo(-1.25, 0);
  tri.lineTo(1.25, 0);
  tri.lineTo(0, 0.6);
  tri.closePath();
  const ped = new THREE.ExtrudeGeometry(tri, { depth: 1.6, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
  ped.translate(0, 0, -0.8);
  object.add(mesh(ped, stone, { y: 1.95 }));
  const coinMat = clay(PALETTE.gold, { emissive: 0.1 });
  object.add(mesh(cylinder(0.2, 0.2, 0.05, 32), coinMat, { y: 2.18, z: 0.84, rx: Math.PI / 2 }));
  object.add(mesh(rounded(0.4, 0.75, 0.06, 0.03), clay(PALETTE.navy), { y: 0.72, z: 0.46 }));
  return {
    object,
    height: 2.7,
    footprint: 1.4,
    setValue(v) {
      coinMat.emissiveIntensity = lerp(0.05, 0.8, v);
    },
  };
}
