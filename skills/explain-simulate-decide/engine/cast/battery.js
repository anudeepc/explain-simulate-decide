// Battery: an upright cell whose window fills (and turns from red to green) with the value.
import { clay, rounded, cylinder, mesh, group, PALETTE, THREE, lerp } from './kit.js';

const EMPTY = new THREE.Color(PALETTE.red);
const HALF = new THREE.Color(PALETTE.gold);
const FULL = new THREE.Color(PALETTE.green);

export default function build({ color = PALETTE.slate } = {}) {
  const object = group();
  const bodyH = 2.0;
  object.add(mesh(rounded(1.25, bodyH, 1.0, 0.22, 4), clay(color), { y: bodyH / 2 }));
  object.add(mesh(cylinder(0.24, 0.26, 0.2), clay(PALETTE.sand), { y: bodyH + 0.08 }));
  // recessed window
  const winH = 1.62;
  const winY0 = (bodyH - winH) / 2;
  object.add(mesh(rounded(0.9, winH, 0.06, 0.08), clay(PALETTE.navy), { y: bodyH / 2, z: 0.48 }));
  const fillMat = clay(PALETTE.green, { emissive: 0.25 });
  const fillH = winH - 0.12;
  const fillGeo = rounded(0.76, fillH, 0.06, 0.06);
  fillGeo.translate(0, fillH / 2, 0);
  const fill = mesh(fillGeo, fillMat, { y: winY0 + 0.06, z: 0.52 });
  object.add(fill);
  // little divider ticks over the window (quarters)
  const tickMat = clay(color);
  for (let i = 1; i < 4; i++) object.add(mesh(rounded(0.9, 0.035, 0.03, 0.012), tickMat, { y: winY0 + 0.06 + (fillH * i) / 4, z: 0.56 }));

  return {
    object,
    height: 2.2,
    setValue(v) {
      fill.scale.y = lerp(0.05, 1, v);
      if (v < 0.5) fillMat.color.lerpColors(EMPTY, HALF, v * 2);
      else fillMat.color.lerpColors(HALF, FULL, (v - 0.5) * 2);
      fillMat.emissive.copy(fillMat.color);
      fillMat.emissiveIntensity = lerp(0.12, 0.4, v);
    },
  };
}
