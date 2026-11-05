// Car: a small rounded car. Its side charge bar fills and its headlights glow with the value.
import { clay, rounded, cylinder, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

export default function build({ color = PALETTE.terracotta } = {}) {
  const object = group();
  const car = group();
  car.rotation.y = -0.42; // three-quarter view: nose turned toward the camera
  object.add(car);
  car.add(mesh(rounded(2.1, 0.58, 1.08, 0.24, 4), clay(color), { y: 0.56 }));
  car.add(mesh(rounded(1.2, 0.56, 0.96, 0.12, 4), clay(PALETTE.cream), { x: -0.12, y: 1.0 }));
  // glass: side panes run through the cabin so they show on both flanks; windscreen + rear window
  const glass = clay('#a9c6df');
  car.add(mesh(rounded(0.42, 0.26, 0.975, 0.06), glass, { x: -0.38, y: 1.03 }));
  car.add(mesh(rounded(0.38, 0.26, 0.975, 0.06), glass, { x: 0.13, y: 1.03 }));
  car.add(mesh(rounded(0.06, 0.28, 0.74, 0.03), glass, { x: 0.47, y: 1.03 }));
  car.add(mesh(rounded(0.06, 0.26, 0.7, 0.03), glass, { x: -0.71, y: 1.03 }));
  // wheels
  const tyre = clay(PALETTE.ink);
  const hub = clay(PALETTE.sand);
  for (const x of [-0.66, 0.66])
    for (const z of [-0.5, 0.5]) {
      car.add(mesh(cylinder(0.3, 0.3, 0.24, 28), tyre, { x, y: 0.3, z, rx: Math.PI / 2 }));
      car.add(mesh(cylinder(0.13, 0.13, 0.26, 20), hub, { x, y: 0.3, z: z * 1.02, rx: Math.PI / 2 }));
    }
  // headlights (front = +x) and tail lights
  const lightMat = clay('#ffe2a0', { emissive: 0.1 });
  [-0.3, 0.3].forEach((z) => car.add(mesh(sphere(0.12, 20), lightMat, { x: 1.03, y: 0.66, z, s: 1 })));
  [-0.3, 0.3].forEach((z) => car.add(mesh(rounded(0.06, 0.12, 0.2, 0.03), clay(PALETTE.red), { x: -1.05, y: 0.68, z })));
  // charge bar along the camera-side flank
  const trackW = 0.9;
  car.add(mesh(rounded(trackW + 0.08, 0.16, 0.05, 0.05), clay(PALETTE.navy), { x: 0.05, y: 0.56, z: 0.55 }));
  const fillGeo = rounded(trackW, 0.1, 0.06, 0.04);
  fillGeo.translate(trackW / 2, 0, 0);
  const fillMat = clay(PALETTE.green, { emissive: 0.3 });
  const fill = mesh(fillGeo, fillMat, { x: 0.05 - trackW / 2, y: 0.56, z: 0.57 });
  car.add(fill);
  const glow = new THREE.Color('#ffe2a0');
  return {
    object,
    height: 1.35,
    setValue(v) {
      fill.scale.x = lerp(0.06, 1, v);
      lightMat.emissive.copy(glow);
      lightMat.emissiveIntensity = lerp(0.05, 1.1, v);
      fillMat.emissiveIntensity = lerp(0.15, 0.5, v);
    },
  };
}
