// House: a small home whose front roof slope faces the audience (so panels read).
// Its windows glow brighter with the value. Offers a "roof" slot for props that sit on it.
import { clay, rounded, mesh, group, PALETTE, THREE, lerp } from './kit.js';

const W = 2.8; // along x
const D = 2.2; // along z
const WALL = 1.55;
const RISE = 1.15;

export default function build() {
  const object = group();
  object.add(mesh(rounded(W, WALL, D, 0.08), clay(PALETTE.cream), { y: WALL / 2 }));
  // gable roof, ridge along x: triangle in the z/y plane extruded along x
  const tri = new THREE.Shape();
  const eave = D / 2 + 0.28;
  tri.moveTo(-eave, 0);
  tri.lineTo(eave, 0);
  tri.lineTo(0, RISE);
  tri.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: W + 0.3, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  roofGeo.translate(0, 0, -(W + 0.3) / 2);
  roofGeo.rotateY(Math.PI / 2);
  object.add(mesh(roofGeo, clay('#b5614a'), { y: WALL - 0.02 }));
  object.add(mesh(rounded(0.3, 0.8, 0.3, 0.05), clay(PALETTE.slate), { x: 0.95, y: WALL + RISE * 0.75, z: -0.35 }));
  // front: door and two windows
  object.add(mesh(rounded(0.46, 0.85, 0.06, 0.04), clay(PALETTE.navy), { x: -0.75, y: 0.43, z: D / 2 + 0.01 }));
  const windowMat = clay('#ffd98a', { emissive: 0.1 });
  for (const x of [0.15, 0.9]) object.add(mesh(rounded(0.5, 0.48, 0.06, 0.04), windowMat, { x, y: 0.9, z: D / 2 + 0.01 }));
  // a step and a little path stone so it sits on the ground
  object.add(mesh(rounded(0.7, 0.08, 0.35, 0.03), clay(PALETTE.sand), { x: -0.75, y: 0.04, z: D / 2 + 0.2 }));

  const slope = Math.atan2(RISE, eave);
  const roof = {
    position: new THREE.Vector3(0, WALL + RISE * 0.47 + 0.06, eave * 0.53),
    rotation: new THREE.Euler(slope, 0, 0),
  };
  return {
    object,
    height: WALL + RISE + 0.1,
    footprint: 1.6,
    slots: { roof },
    setValue(v) {
      windowMat.emissiveIntensity = lerp(0.08, 1.1, v);
    },
  };
}
