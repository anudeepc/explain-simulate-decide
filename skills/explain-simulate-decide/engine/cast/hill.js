// Hill: a low grassy rise with a field and a few trees: land, a farm, a forest, nature.
// The grass greens and the trees fill out as the value rises.
import { clay, sphere, cylinder, cone, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build({ tint = PALETTE.leaf } = {}) {
  const object = group();
  const ground = new THREE.SphereGeometry(1.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  ground.scale(1, 0.42, 1);
  const grassMat = clay(tint);
  object.add(mesh(ground, grassMat));
  // field rows on the front slope
  const rowMat = clay('#c9a86a');
  for (let i = 0; i < 4; i++) object.add(mesh(new THREE.CapsuleGeometry(0.05, 0.9, 4, 8).rotateZ(Math.PI / 2), rowMat, { x: 0.25, y: 0.42 - i * 0.06, z: 0.5 + i * 0.22, ry: 0.15 }));
  const trees = [];
  const leafMat = clay(PALETTE.green);
  for (const [x, z, s] of [[-0.75, -0.35, 1], [-0.2, -0.75, 0.85], [0.55, -0.55, 0.75]]) {
    const t = group();
    t.position.set(x, 0.3, z);
    t.add(mesh(cylinder(0.06, 0.08, 0.5, 10), clay('#8a6646'), { y: 0.25 }));
    t.add(mesh(cone(0.36, 0.8, 20), leafMat, { y: 0.8 }));
    t.userData.s = s;
    trees.push(t);
    object.add(t);
  }
  object.add(mesh(sphere(0.001), grassMat));
  const dry = new THREE.Color('#c8b67a');
  const lush = new THREE.Color(tint);
  return {
    object,
    height: 1.9,
    footprint: 1.5,
    anchor: new THREE.Vector3(0, 0.75, 0),
    setValue(v) {
      grassMat.color.copy(dry).lerp(lush, v);
      trees.forEach((t) => t.scale.setScalar(t.userData.s * lerp(0.45, 1.1, v)));
    },
  };
}
