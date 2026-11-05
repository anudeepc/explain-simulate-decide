// Document: a stack of pages on a folder. The stack grows as the value rises; new pages settle on top.
import { clay, rounded, mesh, group, canvasTexture, PALETTE, THREE, lerp, clamp01 } from './kit.js';

const MAX = 20;
const STEP = 0.075;
const W = 1.5;
const D = 1.9;

export default function build({ color = PALETTE.terracotta } = {}) {
  const object = group();
  object.add(mesh(rounded(W + 0.24, 0.07, D + 0.24, 0.03), clay(color), { y: 0.035 }));
  const pageMat = clay(PALETTE.paper);
  const edgeMat = clay('#efe6d6');
  const geo = rounded(W, 0.055, D, 0.02);
  const pages = [];
  for (let i = 0; i < MAX; i++) {
    const p = mesh(geo, i % 2 ? edgeMat : pageMat);
    p.userData = { x: Math.sin(i * 12.99) * 0.03, z: Math.cos(i * 78.23) * 0.03, ry: Math.sin(i * 3.7) * 0.035 };
    object.add(p);
    pages.push(p);
  }
  // top sheet with a few printed lines; rides on the top of the stack
  const { tex } = canvasTexture(256, 320, (c, w, h) => {
    c.fillStyle = PALETTE.paper;
    c.fillRect(0, 0, w, h);
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(24, 26, 110, 20, 10);
    c.fill();
    c.fillStyle = '#d6ccbb';
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.roundRect(24, 72 + i * 28, i % 3 === 2 ? 140 : 205, 11, 5);
      c.fill();
    }
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, D - 0.08), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  top.rotation.x = -Math.PI / 2;
  top.receiveShadow = true;
  object.add(top);
  return {
    object,
    height: 0.1 + MAX * STEP,
    setValue(v) {
      const n = lerp(2, MAX, v);
      let topY = 0.07;
      let topPage = pages[0];
      pages.forEach((p, i) => {
        const t = clamp01(n - i);
        p.visible = t > 0.01;
        const { x, z, ry } = p.userData;
        p.position.set(x, 0.07 + 0.0275 + i * STEP + (1 - t) * 0.12, z);
        p.rotation.y = ry + (1 - t) * 0.06;
        if (p.visible) {
          topY = p.position.y + 0.0285;
          topPage = p;
        }
      });
      top.position.set(topPage.position.x, topY, topPage.position.z);
      top.rotation.z = topPage.rotation.y;
    },
  };
}
