// Roof panel: an angled solar array. More of the grid fills in as the value rises.
import { clay, rounded, mesh, group, PALETTE, lerp } from './kit.js';

const COLS = 4;
const ROWS = 3;

export default function build() {
  const object = group();
  const frame = group();
  frame.position.y = 0.9;
  frame.rotation.x = 0.75;
  object.add(frame);
  frame.add(mesh(rounded(2.5, 0.08, 1.9, 0.04), clay(PALETTE.slate)));
  const cellOn = clay('#3b5a8c', { emissive: 0.15 });
  const cellOff = clay('#c9c3b8');
  const cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = mesh(rounded(0.54, 0.06, 0.54, 0.03), cellOff, { x: (c - (COLS - 1) / 2) * 0.6, y: 0.06, z: (r - (ROWS - 1) / 2) * 0.6 });
      frame.add(cell);
      cells.push(cell);
    }
  // legs
  object.add(mesh(rounded(0.1, 0.9, 0.1, 0.03), clay(PALETTE.slate), { x: -1, y: 0.45, z: 0.5 }));
  object.add(mesh(rounded(0.1, 0.9, 0.1, 0.03), clay(PALETTE.slate), { x: 1, y: 0.45, z: 0.5 }));
  object.add(mesh(rounded(0.1, 1.6, 0.1, 0.03), clay(PALETTE.slate), { x: -1, y: 0.8, z: -0.4 }));
  object.add(mesh(rounded(0.1, 1.6, 0.1, 0.03), clay(PALETTE.slate), { x: 1, y: 0.8, z: -0.4 }));
  return {
    object,
    height: 2.2,
    setValue(v) {
      const on = Math.round(lerp(2, cells.length, v));
      cells.forEach((cell, i) => {
        cell.material = i < on ? cellOn : cellOff;
        cell.scale.y = i < on ? 1.6 : 1;
      });
      cellOn.emissiveIntensity = lerp(0.1, 0.35, v);
    },
  };
}
