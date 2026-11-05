// Piggy bank: a coin slips into the slot, the slot glows and the body swells slightly as savings grow.
import { clay, rounded, cylinder, sphere, cone, torus, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build({ color = '#e7a99c' } = {}) {
  const object = group();
  const pig = group();
  pig.rotation.y = -0.45; // snout (+x) turned toward the camera
  object.add(pig);
  const skin = clay(color);
  const dark = clay(new THREE.Color(color).multiplyScalar(0.88));
  // legs stay planted; the body scales from its centre
  for (const x of [-0.42, 0.42])
    for (const z of [-0.3, 0.3]) pig.add(mesh(cylinder(0.13, 0.15, 0.42, 18), skin, { x, y: 0.21, z }));
  const body = group();
  body.position.y = 1.0;
  pig.add(body);
  const torso = mesh(sphere(0.75, 40), skin);
  torso.scale.set(1.28, 0.98, 1.0);
  body.add(torso);
  body.add(mesh(cylinder(0.25, 0.27, 0.2, 28), dark, { x: 0.98, y: -0.04, rz: Math.PI / 2 }));
  [-0.25, 0.25].forEach((z) => body.add(mesh(cone(0.14, 0.26, 16), dark, { x: 0.45, y: 0.66, z, rz: -0.35 })));
  body.add(mesh(torus(0.1, 0.03, 24), dark, { x: -0.98, y: 0.12, ry: Math.PI / 2 }));
  // coin slot on the back + coin
  const slotMat = clay(PALETTE.ink, { emissive: 0 });
  body.add(mesh(rounded(0.46, 0.06, 0.1, 0.03), slotMat, { y: 0.73 }));
  const coin = mesh(cylinder(0.28, 0.28, 0.07, 32), clay(PALETTE.gold, { emissive: 0.1 }), { rx: Math.PI / 2 });
  body.add(coin);
  const glow = new THREE.Color(PALETTE.sun);
  return {
    object,
    height: 2.1,
    setValue(v) {
      body.scale.setScalar(lerp(0.92, 1.06, v));
      coin.position.set(0, lerp(1.0, 0.82, v), 0);
      slotMat.emissive.copy(glow);
      slotMat.emissiveIntensity = lerp(0, 1.2, v);
    },
  };
}
