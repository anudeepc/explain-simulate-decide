// Plug: a wall socket with a plug and cable. Beads of energy travel the cable; more and brighter as the value rises.
import { clay, rounded, cylinder, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

const BEADS = 9;

export default function build() {
  const object = group();
  // short wall section with an outlet plate
  object.add(mesh(rounded(1.3, 1.9, 0.3, 0.1), clay(PALETTE.sand), { x: -0.45, y: 0.95, z: -0.9 }));
  object.add(mesh(rounded(0.62, 0.86, 0.06, 0.08), clay(PALETTE.paper), { x: -0.45, y: 1.1, z: -0.73 }));
  // plug body + strain relief
  const plugMat = clay(PALETTE.cream);
  object.add(mesh(rounded(0.44, 0.52, 0.34, 0.12), plugMat, { x: -0.45, y: 1.1, z: -0.53 }));
  object.add(mesh(cylinder(0.09, 0.12, 0.2, 18), plugMat, { x: -0.45, y: 1.1, z: -0.3, rx: Math.PI / 2 }));
  // cable: out of the plug, down to the floor and away to the right
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.45, 1.1, -0.22),
    new THREE.Vector3(-0.45, 1.0, 0.05),
    new THREE.Vector3(-0.38, 0.4, 0.3),
    new THREE.Vector3(-0.15, 0.07, 0.55),
    new THREE.Vector3(0.35, 0.07, 0.6),
    new THREE.Vector3(0.8, 0.07, 0.25),
    new THREE.Vector3(1.15, 0.07, 0.05),
  ]);
  const cableMat = clay(PALETTE.slate, { emissive: 0 });
  object.add(mesh(new THREE.TubeGeometry(curve, 96, 0.06, 12, false), cableMat));
  object.add(mesh(sphere(0.075, 16), cableMat, { x: 1.15, y: 0.07, z: 0.05 }));
  // energy beads (positions depend only on v so frames are reproducible)
  const beadMat = clay(PALETTE.sun, { emissive: 0.5 });
  const beadGeo = sphere(0.1, 18);
  const beads = [];
  for (let i = 0; i < BEADS; i++) {
    const b = mesh(beadGeo, beadMat);
    b.castShadow = false;
    object.add(b);
    beads.push(b);
  }
  const p = new THREE.Vector3();
  return {
    object,
    height: 1.95,
    setValue(v) {
      const shown = lerp(1, BEADS, v);
      beads.forEach((b, i) => {
        const t = Math.min(1, Math.max(0, shown - i));
        b.visible = t > 0.01;
        const u = 0.06 + ((i / BEADS + v * 0.35) % 1) * 0.9;
        curve.getPointAt(u, p);
        b.position.copy(p);
        b.scale.setScalar(lerp(0.55, 1.05, v) * t);
      });
      beadMat.emissiveIntensity = lerp(0.25, 1.0, v);
      cableMat.emissive.set(PALETTE.sun);
      cableMat.emissiveIntensity = lerp(0, 0.12, v);
    },
  };
}
