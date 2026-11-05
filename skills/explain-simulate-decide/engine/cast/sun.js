// Sun: grows brighter and its rays lengthen as the value rises.
import { clay, sphere, cone, mesh, group, PALETTE, lerp } from './kit.js';

export default function build() {
  const object = group();
  const core = clay(PALETTE.sun, { emissive: 0.4 });
  const body = mesh(sphere(0.62), core, { y: 2.2 });
  object.add(body);
  const rays = group();
  rays.position.y = 2.2;
  const rayMat = clay(PALETTE.gold, { emissive: 0.25 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = mesh(cone(0.09, 0.42, 12), rayMat, { x: Math.cos(a) * 0.95, y: Math.sin(a) * 0.95, rz: a - Math.PI / 2 });
    rays.add(r);
  }
  object.add(rays);
  // a slim pole so it "stands" on its mark like a stage prop
  object.add(mesh(sphere(0.001), core));
  return {
    object,
    height: 3.2,
    setValue(v) {
      core.emissiveIntensity = lerp(0.15, 0.9, v);
      body.scale.setScalar(lerp(0.85, 1.12, v));
      rays.children.forEach((r, i) => {
        const a = (i / 12) * Math.PI * 2;
        const d = lerp(0.82, 1.18, v);
        r.position.set(Math.cos(a) * d, Math.sin(a) * d, 0);
        r.scale.setScalar(lerp(0.6, 1.25, v));
      });
      rays.rotation.z = v * 0.5;
    },
  };
}
