// House: a simple home with a pitched roof. Its window glows with the value.
import { clay, rounded, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build() {
  const object = group();
  const walls = mesh(rounded(2.2, 1.5, 1.8, 0.08), clay(PALETTE.cream), { y: 0.75 });
  object.add(walls);
  const tri = new THREE.Shape();
  tri.moveTo(-1.32, 0);
  tri.lineTo(1.32, 0);
  tri.lineTo(0, 0.95);
  tri.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: 2.0, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  roofGeo.translate(0, 0, -1.0);
  const roof = mesh(roofGeo, clay(PALETTE.terracotta), { y: 1.48 });
  object.add(roof);
  const door = mesh(rounded(0.42, 0.75, 0.06, 0.04), clay(PALETTE.navy), { x: -0.45, y: 0.38, z: 0.91 });
  object.add(door);
  const windowMat = clay('#ffd98a', { emissive: 0.1 });
  const win = mesh(rounded(0.55, 0.45, 0.06, 0.04), windowMat, { x: 0.5, y: 0.85, z: 0.91 });
  object.add(win);
  object.add(mesh(rounded(0.26, 0.6, 0.26, 0.04), clay(PALETTE.slate), { x: 0.65, y: 2.25, z: -0.2 }));
  return {
    object,
    height: 2.6,
    setValue(v) {
      windowMat.emissiveIntensity = lerp(0.1, 0.9, v);
    },
  };
}
