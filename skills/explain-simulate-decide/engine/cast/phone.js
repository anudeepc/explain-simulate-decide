// Phone: a handset on a small dock. Its screen bars rise (staggered) and glow with the value.
import { clay, rounded, mesh, group, PALETTE, lerp, clamp01 } from './kit.js';

const BARS = 4;

export default function build({ color = PALETTE.navy } = {}) {
  const object = group();
  object.add(mesh(rounded(1.5, 0.22, 0.9, 0.09), clay(PALETTE.sand), { y: 0.11 }));
  const handset = group();
  handset.position.set(0, 0.16, 0.05);
  handset.rotation.x = -0.14;
  object.add(handset);
  const H = 2.05;
  handset.add(mesh(rounded(1.12, H, 0.16, 0.14, 4), clay(color), { y: H / 2 }));
  const screenMat = clay('#f6efe2', { emissive: 0.05 });
  handset.add(mesh(rounded(0.96, H - 0.32, 0.03, 0.08), screenMat, { y: H / 2 + 0.02, z: 0.08 }));
  handset.add(mesh(rounded(0.26, 0.05, 0.03, 0.02), clay(PALETTE.slate), { y: H - 0.09, z: 0.08 }));

  const barMat = clay(PALETTE.sky, { emissive: 0.15 });
  const accentMat = clay(PALETTE.clay, { emissive: 0.15 });
  const bars = [];
  const maxH = 1.2;
  for (let i = 0; i < BARS; i++) {
    const geo = rounded(0.15, maxH, 0.05, 0.05);
    geo.translate(0, maxH / 2, 0);
    const b = mesh(geo, i === BARS - 1 ? accentMat : barMat, { x: (i - (BARS - 1) / 2) * 0.21, y: 0.36, z: 0.11 });
    handset.add(b);
    bars.push(b);
  }
  // baseline
  handset.add(mesh(rounded(0.8, 0.03, 0.03, 0.012), clay(PALETTE.slate), { y: 0.34, z: 0.1 }));

  return {
    object,
    height: 2.2,
    setValue(v) {
      bars.forEach((b, i) => {
        const t = clamp01((v - i * 0.08) / 0.76);
        b.scale.y = lerp(0.08, 0.55 + i * 0.15, t);
      });
      screenMat.emissiveIntensity = lerp(0.04, 0.3, v);
      barMat.emissiveIntensity = lerp(0.1, 0.45, v);
      accentMat.emissiveIntensity = lerp(0.1, 0.45, v);
    },
  };
}
