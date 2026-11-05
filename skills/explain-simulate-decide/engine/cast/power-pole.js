// Power pole: where the home meets the grid. Wires run off the back of the set.
// A small meter on the pole swings with the value.
import { clay, rounded, cylinder, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build() {
  const object = group();
  const wood = clay('#9a7350');
  object.add(mesh(cylinder(0.11, 0.15, 3.6, 16), wood, { y: 1.8 }));
  object.add(mesh(rounded(1.9, 0.14, 0.16, 0.04), wood, { y: 3.3 }));
  const insulator = clay('#e9eef2');
  for (const x of [-0.8, 0, 0.8]) object.add(mesh(cylinder(0.07, 0.09, 0.22, 12), insulator, { x, y: 3.48 }));
  object.add(mesh(cylinder(0.28, 0.28, 0.62, 24), clay('#9aa3ad'), { x: 0.36, y: 2.55 }));
  object.add(mesh(cylinder(0.3, 0.3, 0.05, 24), clay('#7d8690'), { x: 0.36, y: 2.88 }));
  // wires heading away to the rest of the grid
  const wireMat = clay(PALETTE.ink);
  for (const x of [-0.8, 0, 0.8]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 3.58, 0), new THREE.Vector3(x, 3.35, -1.1), new THREE.Vector3(x, 3.2, -1.9)]);
    object.add(mesh(new THREE.TubeGeometry(curve, 16, 0.018, 6), wireMat));
  }
  // meter
  object.add(mesh(rounded(0.5, 0.62, 0.2, 0.06), clay(PALETTE.cream), { y: 1.35, z: 0.18 }));
  object.add(mesh(cylinder(0.19, 0.19, 0.03, 32), clay(PALETTE.paper), { y: 1.42, z: 0.29, rx: Math.PI / 2 }));
  const needle = group();
  needle.position.set(0, 1.42, 0.31);
  needle.add(mesh(rounded(0.025, 0.17, 0.02, 0.01), clay(PALETTE.red), { y: 0.075 }));
  object.add(needle);
  return {
    object,
    height: 3.7,
    footprint: 0.9,
    anchor: new THREE.Vector3(0, 1.4, 0),
    setValue(v) {
      needle.rotation.z = lerp(1.1, -1.1, v);
    },
  };
}
