// Bar stack: four bars on a plinth grow one after another as the value rises.
import { clay, rounded, mesh, group, PALETTE, lerp, clamp01 } from './kit.js';

const MAXH = [1.1, 1.6, 2.1, 2.6];
const COLORS = [PALETTE.sage, PALETTE.sky, PALETTE.gold, PALETTE.clay];

export default function build({ color } = {}) {
  const object = group();
  object.add(mesh(rounded(2.2, 0.14, 1.0, 0.06), clay(PALETTE.cream), { y: 0.07 }));
  const bars = MAXH.map((h, i) => {
    const geo = rounded(0.38, h, 0.5, 0.07);
    geo.translate(0, h / 2, 0);
    const b = mesh(geo, clay(color || COLORS[i]), { x: (i - 1.5) * 0.5, y: 0.14 });
    object.add(b);
    return b;
  });
  return {
    object,
    height: 2.8,
    setValue(v) {
      bars.forEach((b, i) => {
        const t = clamp01((v - i * 0.1) / 0.7);
        b.scale.y = lerp(0.1, 1, t);
      });
    },
  };
}
