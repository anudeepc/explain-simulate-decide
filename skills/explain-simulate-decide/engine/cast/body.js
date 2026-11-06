// Body: a simple standing human figure with a glowing heart. The glow and its pulse grow
// with the value: health, stress, fitness, a dose, a symptom.
import { clay, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build({ tint = '#e8c4a8' } = {}) {
  const object = group();
  const skin = clay(tint);
  const cloth = clay(PALETTE.slate);
  const limb = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);
  object.add(mesh(limb(0.13, 0.7), cloth, { x: -0.17, y: 0.48 }));
  object.add(mesh(limb(0.13, 0.7), cloth, { x: 0.17, y: 0.48 }));
  object.add(mesh(limb(0.32, 0.55), clay(PALETTE.sky), { y: 1.38 }));
  object.add(mesh(limb(0.09, 0.62), skin, { x: -0.47, y: 1.32, rz: 0.12 }));
  object.add(mesh(limb(0.09, 0.62), skin, { x: 0.47, y: 1.32, rz: -0.12 }));
  object.add(mesh(sphere(0.07, 12), skin, { y: 1.93 }));
  object.add(mesh(sphere(0.27, 40), skin, { y: 2.18 }));
  const heartMat = clay(PALETTE.red, { emissive: 0.4 });
  const heart = group();
  heart.position.set(-0.09, 1.5, 0.31);
  heart.add(mesh(sphere(0.075, 20), heartMat, { x: -0.05, y: 0.03 }));
  heart.add(mesh(sphere(0.075, 20), heartMat, { x: 0.05, y: 0.03 }));
  heart.add(mesh(new THREE.ConeGeometry(0.105, 0.15, 20).rotateZ(Math.PI), heartMat, { y: -0.06 }));
  object.add(heart);
  return {
    object,
    height: 2.5,
    footprint: 0.9,
    anchor: new THREE.Vector3(0, 1.4, 0),
    setValue(v) {
      heartMat.emissiveIntensity = lerp(0.1, 1.6, v);
      heart.scale.setScalar(lerp(0.8, 1.45, v));
    },
  };
}
