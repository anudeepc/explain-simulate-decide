// Stand-in: a labelled block, like a labelled crate on a theatre stage.
// Used for any concept the studio cast does not cover.
import { clay, rounded, mesh, group, canvasTexture, PALETTE, FONT, THREE, lerp } from './kit.js';

export default function build({ label = '?', color = PALETTE.sky } = {}) {
  const object = group();
  const body = mesh(rounded(1.6, 1.6, 1.6, 0.18, 4), clay(color), { y: 0.8 });
  object.add(body);
  const { tex } = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.paper;
    ctx.beginPath();
    ctx.roundRect(24, 24, w - 48, h - 48, 40);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = String(label).split(/\s+/);
    const lines = [];
    let line = '';
    ctx.font = `600 64px ${FONT}`;
    for (const w2 of words) {
      const t = line ? `${line} ${w2}` : w2;
      if (ctx.measureText(t).width > w - 110 && line) {
        lines.push(line);
        line = w2;
      } else line = t;
    }
    lines.push(line);
    lines.slice(0, 4).forEach((l, i, arr) => ctx.fillText(l, w / 2, h / 2 + (i - (arr.length - 1) / 2) * 76));
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.set(0, 0.8, 0.81);
  object.add(face);
  const meter = mesh(rounded(1.6, 0.12, 0.2, 0.05), clay(PALETTE.gold, { emissive: 0.3 }), { y: 0.06, z: 0.75 });
  object.add(meter);
  return {
    object,
    height: 1.8,
    setValue(v) {
      meter.scale.x = lerp(0.08, 1, v);
      meter.position.x = -0.8 * (1 - meter.scale.x);
    },
  };
}
