// Tree: the canopy fills out (and greens up) as the value rises.
import { clay, cylinder, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

const PALE = new THREE.Color(PALETTE.sage);
const LUSH = new THREE.Color(PALETTE.leaf);

export default function build() {
  const object = group();
  const mound = mesh(sphere(0.55, 32), clay('#cdb48c'));
  mound.scale.set(1, 0.22, 1);
  object.add(mound);
  const trunkMat = clay('#a87650');
  object.add(mesh(cylinder(0.15, 0.22, 1.4, 20), trunkMat, { y: 0.7 }));
  object.add(mesh(cylinder(0.05, 0.07, 0.5, 12), trunkMat, { x: 0.18, y: 1.15, rz: -0.7 }));
  const canopy = group();
  canopy.position.y = 1.3;
  object.add(canopy);
  const leafMat = clay(PALETTE.leaf);
  [
    [0, 0.62, 0, 0.66],
    [-0.5, 0.36, 0.12, 0.48],
    [0.52, 0.42, 0.04, 0.5],
    [0.08, 1.08, -0.05, 0.46],
    [-0.1, 0.42, 0.42, 0.42],
    [0.25, 0.5, -0.4, 0.42],
  ].forEach(([x, y, z, r]) => canopy.add(mesh(sphere(r, 32), leafMat, { x, y, z })));
  return {
    object,
    height: 2.9,
    setValue(v) {
      canopy.scale.setScalar(lerp(0.42, 1, v));
      leafMat.color.lerpColors(PALE, LUSH, v);
    },
  };
}
