// Balance scale: the beam tips from left-heavy (0) through level (0.5) to right-heavy (1).
import { clay, rounded, cylinder, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build() {
  const object = group();
  const metal = clay(PALETTE.gold);
  object.add(mesh(rounded(1.3, 0.18, 0.8, 0.07), clay(PALETTE.navy), { y: 0.09 }));
  object.add(mesh(cylinder(0.3, 0.38, 0.14, 32), metal, { y: 0.25 }));
  const pivotY = 2.05;
  object.add(mesh(cylinder(0.07, 0.09, pivotY - 0.3, 20), metal, { y: 0.3 + (pivotY - 0.3) / 2 }));
  object.add(mesh(sphere(0.14, 24), metal, { y: pivotY + 0.04 }));
  const L = 0.92;
  const beam = mesh(rounded(2 * L + 0.16, 0.1, 0.14, 0.05), metal, { y: pivotY });
  object.add(beam);
  const hang = 0.82;
  const makePan = (weightColor) => {
    const pan = group();
    pan.add(mesh(cylinder(0.018, 0.018, hang, 8), clay(PALETTE.slate), { y: -hang / 2 }));
    pan.add(mesh(sphere(0.05, 12), metal));
    pan.add(mesh(cylinder(0.38, 0.28, 0.1, 32), clay(PALETTE.sand), { y: -hang }));
    const wgeo = rounded(0.4, 0.4, 0.4, 0.1);
    wgeo.translate(0, 0.2, 0);
    const w = mesh(wgeo, clay(weightColor), { y: -hang + 0.05 });
    pan.add(w);
    object.add(pan);
    return { pan, w };
  };
  const left = makePan(PALETTE.terracotta);
  const right = makePan(PALETTE.sky);
  const MAX = 0.3;
  return {
    object,
    height: 2.25,
    setValue(v) {
      const a = lerp(MAX, -MAX, v); // + raises the right end, so the left is heavy at 0
      beam.rotation.z = a;
      const c = Math.cos(a) * L;
      const s = Math.sin(a) * L;
      left.pan.position.set(-c, pivotY - s, 0);
      right.pan.position.set(c, pivotY + s, 0);
      left.w.scale.setScalar(lerp(1.15, 0.55, v));
      right.w.scale.setScalar(lerp(0.55, 1.15, v));
    },
  };
}
