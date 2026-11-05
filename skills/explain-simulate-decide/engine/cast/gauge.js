// Gauge: a semicircle dial. The needle sweeps from the calm left (0) to the warm right (1).
import { clay, rounded, cylinder, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build({ color = PALETTE.navy } = {}) {
  const object = group();
  // plinth
  object.add(mesh(rounded(2.2, 0.3, 0.9, 0.1), clay(PALETTE.sand), { y: 0.15 }));
  const dial = group();
  dial.position.set(0, 0.42, 0);
  dial.rotation.x = -0.1;
  object.add(dial);
  const R = 1.08;
  const half = new THREE.Shape();
  half.moveTo(R, 0);
  half.absarc(0, 0, R, 0, Math.PI, false);
  half.lineTo(-R, -0.12);
  half.lineTo(R, -0.12);
  half.closePath();
  const caseGeo = new THREE.ExtrudeGeometry(half, { depth: 0.24, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 3, curveSegments: 48 });
  caseGeo.translate(0, 0.12, -0.12);
  dial.add(mesh(caseGeo, clay(color)));
  // face
  const faceShape = new THREE.Shape();
  const r = R - 0.1;
  faceShape.moveTo(r, 0);
  faceShape.absarc(0, 0, r, 0, Math.PI, false);
  faceShape.closePath();
  const face = mesh(new THREE.ShapeGeometry(faceShape, 48), clay(PALETTE.paper), { y: 0.14, z: 0.2 });
  dial.add(face);
  // three colour bands: calm → caution → warm
  const bands = [PALETTE.sage, PALETTE.gold, PALETTE.terracotta];
  bands.forEach((c, i) => {
    const g = new THREE.TorusGeometry(r - 0.16, 0.07, 10, 24, Math.PI / 3 - 0.03);
    dial.add(mesh(g, clay(c), { y: 0.14, z: 0.2, rz: Math.PI - (i + 1) * (Math.PI / 3) + 0.015 }));
  });
  // needle
  const needleGeo = rounded(0.08, 0.86, 0.05, 0.03);
  needleGeo.translate(0, 0.36, 0);
  const needle = mesh(needleGeo, clay(PALETTE.ink), { y: 0.14, z: 0.3 });
  dial.add(needle);
  dial.add(mesh(cylinder(0.13, 0.13, 0.1, 24), clay(PALETTE.ink), { y: 0.14, z: 0.3, rx: Math.PI / 2 }));

  return {
    object,
    height: 1.8,
    setValue(v) {
      needle.rotation.z = lerp(Math.PI / 2 - 0.12, -Math.PI / 2 + 0.12, v);
    },
  };
}
