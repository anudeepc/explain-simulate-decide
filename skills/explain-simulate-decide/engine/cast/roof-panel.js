// Solar panels. On their own they stand on a tilted frame; mounted on a roof they lie flat
// on the slope. More cells switch on as the value rises.
import { clay, rounded, mesh, group, PALETTE, lerp } from './kit.js';

export default function build({ mounted = false } = {}) {
  const COLS = mounted ? 5 : 4;
  const ROWS = mounted ? 2 : 3;
  const CELL = mounted ? 0.44 : 0.6;
  const object = group();
  const frame = group();
  if (!mounted) {
    frame.position.y = 0.9;
    frame.rotation.x = 0.75;
  }
  object.add(frame);
  frame.add(mesh(rounded(COLS * CELL + 0.12, 0.07, ROWS * CELL + 0.12, 0.03), clay(PALETTE.slate)));
  const cellOn = clay('#2f5590', { emissive: 0.15 });
  cellOn.roughness = 0.35;
  cellOn.metalness = 0.2;
  const cellOff = clay('#c9c3b8');
  const cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = mesh(rounded(CELL - 0.06, 0.05, CELL - 0.06, 0.02), cellOff, { x: (c - (COLS - 1) / 2) * CELL, y: 0.05, z: (r - (ROWS - 1) / 2) * CELL });
      frame.add(cell);
      cells.push(cell);
    }
  if (!mounted) {
    for (const [x, z, h] of [[-1, 0.5, 0.9], [1, 0.5, 0.9], [-1, -0.4, 1.6], [1, -0.4, 1.6]]) {
      object.add(mesh(rounded(0.1, h, 0.1, 0.03), clay(PALETTE.slate), { x, y: h / 2, z }));
    }
  }
  return {
    object,
    height: mounted ? 0.2 : 2.2,
    setValue(v) {
      const on = Math.round(lerp(2, cells.length, v));
      cells.forEach((cell, i) => {
        cell.material = i < on ? cellOn : cellOff;
        cell.scale.y = i < on ? 1.5 : 1;
      });
      cellOn.emissiveIntensity = lerp(0.08, 0.3, v);
    },
  };
}
