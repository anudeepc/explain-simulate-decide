// Calendar: a desk calendar. More days are marked as the value rises.
import { clay, rounded, torus, mesh, group, PALETTE, lerp } from './kit.js';

const COLS = 7;
const ROWS = 5;

export default function build({ color = PALETTE.terracotta } = {}) {
  const object = group();
  object.add(mesh(rounded(2.1, 0.16, 0.9, 0.07), clay(PALETTE.sand), { y: 0.08 }));
  object.add(mesh(rounded(0.14, 1.3, 0.1, 0.04), clay(PALETTE.sand), { y: 0.8, z: -0.32, rx: 0.24 }));
  const board = group();
  board.position.set(0, 0.16, 0.06);
  board.rotation.x = -0.14;
  object.add(board);
  const W = 2.0;
  const H = 2.0;
  board.add(mesh(rounded(W, H, 0.1, 0.08), clay(PALETTE.paper), { y: H / 2 }));
  board.add(mesh(rounded(W, 0.42, 0.14, 0.07), clay(color), { y: H - 0.21 }));
  const ringMat = clay(PALETTE.slate);
  [-0.55, 0.55].forEach((x) => board.add(mesh(torus(0.13, 0.035, 24), ringMat, { x, y: H, ry: Math.PI / 2 })));
  const offMat = clay('#ece2d1');
  const onMat = clay(PALETTE.gold, { emissive: 0.15 });
  const tiles = [];
  const step = 0.255;
  const geo = rounded(0.2, 0.2, 0.05, 0.04);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const t = mesh(geo, offMat, { x: (c - (COLS - 1) / 2) * step, y: H - 0.62 - r * step, z: 0.06 });
      board.add(t);
      tiles.push(t);
    }
  return {
    object,
    height: 2.15,
    setValue(v) {
      const on = Math.max(1, Math.round(v * tiles.length));
      tiles.forEach((t, i) => {
        const lit = i < on;
        t.material = lit ? onMat : offMat;
        t.scale.z = lit ? 1.8 : 1;
      });
      onMat.emissiveIntensity = lerp(0.1, 0.3, v);
    },
  };
}
