// Building: a plain three-storey block with a door and rows of windows: a school, an
// office, a hospital, a council, a company. More windows light up as the value rises.
import { clay, rounded, mesh, group, PALETTE, THREE, lerp } from './kit.js';

const COLS = 4;
const ROWS = 3;

export default function build({ tint = '#d9c7a7' } = {}) {
  const object = group();
  const W = 2.3;
  const D = 1.5;
  const FLOOR = 0.78;
  const H = ROWS * FLOOR + 0.25;
  object.add(mesh(rounded(W, H, D, 0.06), clay(tint), { y: H / 2 }));
  object.add(mesh(rounded(W + 0.12, 0.14, D + 0.12, 0.04), clay(PALETTE.slate), { y: H + 0.07 }));
  // a sign band and a door, so it reads as a public building, not a house
  object.add(mesh(rounded(1.1, 0.2, 0.05, 0.03), clay(PALETTE.navy), { y: FLOOR * 0.98, z: D / 2 + 0.03 }));
  object.add(mesh(rounded(0.46, 0.62, 0.05, 0.03), clay(PALETTE.navy), { y: 0.31, z: D / 2 + 0.02 }));
  const windows = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 && (c === 1 || c === 2)) continue; // the door and sign take the middle of the ground floor
      const mat = clay('#f7e3a6', { emissive: 0 });
      const w = mesh(rounded(0.34, 0.4, 0.04, 0.03), mat, { x: -W / 2 + 0.36 + c * ((W - 0.72) / (COLS - 1)), y: 0.45 + r * FLOOR + (r ? 0.05 : 0), z: D / 2 + 0.02 });
      windows.push(mat);
      object.add(w);
    }
  }
  const dark = new THREE.Color('#5b6b80');
  const warm = new THREE.Color('#ffd98a');
  return {
    object,
    height: H + 0.2,
    footprint: 1.45,
    setValue(v) {
      const n = v * windows.length;
      windows.forEach((m, i) => {
        const k = Math.min(1, Math.max(0, n - i));
        m.color.copy(dark).lerp(warm, k);
        m.emissive.copy(m.color);
        m.emissiveIntensity = lerp(0, 0.55, k);
      });
    },
  };
}
