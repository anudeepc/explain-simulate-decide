// Clock: a desk clock. The hand sweeps clockwise from 12 and a soft arc fills the face behind it.
import { clay, rounded, cylinder, sphere, mesh, group, PALETTE, THREE } from './kit.js';

const SEG = 120;

export default function build({ color = PALETTE.terracotta } = {}) {
  const object = group();
  const cy = 1.25;
  const R = 1.0;
  const dial = group();
  dial.position.y = cy;
  object.add(dial);
  // case + face (cylinders turned to face the camera)
  dial.add(mesh(cylinder(R, R, 0.36, 64), clay(color), { rx: Math.PI / 2 }));
  dial.add(mesh(cylinder(R * 0.86, R * 0.86, 0.04, 64), clay(PALETTE.paper), { z: 0.18, rx: Math.PI / 2 }));
  // elapsed arc: one fan geometry, mirrored so it fills clockwise; we reveal it with drawRange
  const arcGeo = new THREE.CircleGeometry(R * 0.8, SEG, Math.PI / 2, Math.PI * 2);
  const arcMat = clay('#f3d79c', { emissive: 0.1 });
  const arc = mesh(arcGeo, arcMat, { z: 0.205 });
  arc.scale.x = -1;
  arc.castShadow = false;
  dial.add(arc);
  // hour ticks
  const tickMat = clay(PALETTE.ink);
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 - (i / 12) * Math.PI * 2;
    const big = i % 3 === 0;
    dial.add(mesh(rounded(big ? 0.06 : 0.04, big ? 0.16 : 0.09, 0.03, 0.015), tickMat, {
      x: Math.cos(a) * R * 0.7, y: Math.sin(a) * R * 0.7, z: 0.215, rz: a - Math.PI / 2,
    }));
  }
  // hand (pivot at the centre)
  const handGeo = rounded(0.07, 0.72, 0.04, 0.03);
  handGeo.translate(0, 0.3, 0);
  const hand = mesh(handGeo, clay(PALETTE.ink), { z: 0.24 });
  dial.add(hand);
  dial.add(mesh(cylinder(0.08, 0.08, 0.06, 24), clay(PALETTE.ink), { z: 0.25, rx: Math.PI / 2 }));
  // feet + top knob
  object.add(mesh(sphere(0.16), clay(PALETTE.ink), { x: -0.55, y: 0.14, s: 1 }));
  object.add(mesh(sphere(0.16), clay(PALETTE.ink), { x: 0.55, y: 0.14 }));
  object.add(mesh(cylinder(0.1, 0.12, 0.16, 20), clay(PALETTE.ink), { y: cy + R + 0.06 }));
  object.add(mesh(sphere(0.12), clay(color), { y: cy + R + 0.18 }));

  return {
    object,
    height: cy + R + 0.3,
    setValue(v) {
      hand.rotation.z = -v * Math.PI * 2;
      const n = Math.round(v * SEG);
      arc.visible = n > 0;
      arcGeo.setDrawRange(0, n * 3);
    },
  };
}
