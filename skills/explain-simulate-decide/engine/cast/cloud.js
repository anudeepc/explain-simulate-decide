// Cloud: v = cloud cover. More puffs swell in and the cloud greys slightly as cover grows.
import { clay, sphere, mesh, group, PALETTE, THREE, lerp, clamp01 } from './kit.js';

// [x, y, z, r, appearsAt]
const PUFFS = [
  [0, 0, 0, 0.6, 0],
  [-0.6, -0.15, 0.05, 0.44, 0],
  [0.6, -0.12, 0, 0.47, 0],
  [-0.25, 0.32, -0.12, 0.46, 0.15],
  [0.32, 0.36, -0.05, 0.42, 0.3],
  [-1.0, -0.24, -0.05, 0.3, 0.45],
  [1.0, -0.22, 0.05, 0.33, 0.55],
  [0.05, 0.62, -0.18, 0.36, 0.65],
];

const LIGHT = new THREE.Color(PALETTE.white);
const GREY = new THREE.Color('#c2c8d0');

export default function build() {
  const object = group();
  const cloud = group();
  cloud.position.y = 1.85;
  object.add(cloud);
  const mat = clay(PALETTE.white);
  const geo = sphere(1, 32);
  const puffs = PUFFS.map(([x, y, z, r]) => {
    const m = mesh(geo, mat, { x, y, z, s: r });
    cloud.add(m);
    return m;
  });
  // soft flat underside
  const base = mesh(geo, mat, { y: -0.22 });
  base.scale.set(0.95, 0.24, 0.42);
  cloud.add(base);
  return {
    object,
    height: 2.8,
    setValue(v) {
      puffs.forEach((m, i) => {
        const [, , , r, at] = PUFFS[i];
        const t = at === 0 ? 1 : clamp01((v - at) / 0.25);
        m.visible = t > 0.01;
        m.scale.setScalar(r * t);
      });
      cloud.scale.setScalar(lerp(0.78, 1.1, v));
      mat.color.lerpColors(LIGHT, GREY, clamp01((v - 0.35) / 0.65));
    },
  };
}
