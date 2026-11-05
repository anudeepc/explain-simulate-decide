// Shopping bag: groceries rise out of the bag (one after another) as the value rises.
import { clay, rounded, cylinder, sphere, cone, mesh, group, PALETTE, THREE, lerp, clamp01 } from './kit.js';

export default function build({ color = '#d9b98a' } = {}) {
  const object = group();
  const H = 1.55;
  object.add(mesh(rounded(1.55, H, 0.92, 0.07), clay(color), { y: H / 2 }));
  object.add(mesh(rounded(1.42, 0.02, 0.8, 0.01), clay('#a8875a'), { y: H + 0.002 }));
  const handleMat = clay(PALETTE.terracotta);
  [-0.4, 0.4].forEach((z) => object.add(mesh(new THREE.TorusGeometry(0.3, 0.04, 12, 32, Math.PI), handleMat, { y: H - 0.02, z })));
  // items: each is a group whose origin is its own top; rise = how far it pokes above the rim
  const items = [];
  const add = (node, x, z, height, rise) => {
    const g = group();
    g.add(node);
    g.userData = { x, z, height, rise };
    object.add(g);
    items.push(g);
  };
  // baguette
  const bread = group();
  bread.add(mesh(new THREE.CapsuleGeometry(0.12, 0.9, 8, 16), clay(PALETTE.gold), { y: -0.57 }));
  bread.rotation.z = 0.22;
  add(bread, -0.42, -0.1, 1.15, 0.6);
  // bottle
  const bottle = group();
  bottle.add(mesh(cylinder(0.17, 0.17, 0.75, 24), clay(PALETTE.sage), { y: -0.75 }));
  bottle.add(mesh(cylinder(0.07, 0.15, 0.25, 20), clay(PALETTE.sage), { y: -0.26 }));
  bottle.add(mesh(cylinder(0.075, 0.075, 0.1, 16), clay(PALETTE.cream), { y: -0.07 }));
  add(bottle, 0.08, -0.18, 1.12, 0.62);
  // greens
  const greens = group();
  [[-0.08, 0], [0.1, 0.05], [0.0, -0.1]].forEach(([x, z], i) => greens.add(mesh(cone(0.16, 0.6, 16), clay(i === 1 ? PALETTE.green : PALETTE.leaf), { x, y: -0.3, z })));
  add(greens, 0.45, 0.05, 0.6, 0.45);
  // box
  const box = group();
  box.add(mesh(rounded(0.42, 0.62, 0.3, 0.06), clay(PALETTE.sky), { y: -0.31 }));
  add(box, -0.1, 0.2, 0.62, 0.4);
  // apple
  const apple = group();
  apple.add(mesh(sphere(0.2, 24), clay(PALETTE.red), { y: -0.2 }));
  apple.add(mesh(cylinder(0.02, 0.02, 0.1, 8), clay(PALETTE.ink), { y: 0.02 }));
  add(apple, 0.45, 0.25, 0.42, 0.32);

  return {
    object,
    height: 2.2,
    setValue(v) {
      items.forEach((g, i) => {
        const { x, z, height, rise } = g.userData;
        const t = clamp01((v - i * 0.13) / 0.48);
        const top = H - 0.04 + lerp(i === 0 ? 0.2 : 0, rise, t);
        g.position.set(x, Math.max(top, height + 0.02), z);
      });
    },
  };
}
