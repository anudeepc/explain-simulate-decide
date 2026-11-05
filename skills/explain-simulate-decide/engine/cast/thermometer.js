// Thermometer: a wall thermometer on a stand. The column rises and shifts from cool blue through amber to warm red.
import { clay, rounded, cylinder, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

const COLD = new THREE.Color(PALETTE.sky);
const WARM = new THREE.Color(PALETTE.gold);
const HOT = new THREE.Color(PALETTE.red);

export default function build() {
  const object = group();
  object.add(mesh(rounded(1.2, 0.18, 0.8, 0.07), clay(PALETTE.sand), { y: 0.09 }));
  object.add(mesh(rounded(0.95, 2.6, 0.16, 0.14, 4), clay(PALETTE.cream), { y: 0.18 + 1.3, z: -0.08 }));
  const liquid = clay(PALETTE.red, { emissive: 0.15 });
  const bulbY = 0.62;
  object.add(mesh(sphere(0.25), liquid, { y: bulbY, z: 0.12 }));
  // glass tube (translucent) with the column inside
  const top = 2.5;
  const tubeLen = top - (bulbY + 0.12);
  const glass = mesh(cylinder(0.13, 0.13, tubeLen, 24), clay(PALETTE.white, { opacity: 0.32 }), { y: bulbY + 0.12 + tubeLen / 2, z: 0.12 });
  glass.castShadow = false;
  glass.material.depthWrite = false;
  glass.renderOrder = 2;
  object.add(glass);
  object.add(mesh(sphere(0.13, 20), glass.material, { y: top, z: 0.12 }));
  const colLen = tubeLen + 0.08;
  const colGeo = cylinder(0.075, 0.075, colLen, 20);
  colGeo.translate(0, colLen / 2, 0);
  const column = mesh(colGeo, liquid, { y: bulbY + 0.1, z: 0.12 });
  object.add(column);
  // scale ticks on the board
  const tickMat = clay(PALETTE.slate);
  for (let i = 0; i <= 8; i++) {
    const big = i % 2 === 0;
    object.add(mesh(rounded(big ? 0.22 : 0.13, 0.035, 0.03, 0.012), tickMat, { x: 0.3 + (big ? 0 : -0.045), y: bulbY + 0.3 + (i / 8) * (tubeLen - 0.3), z: 0.01 }));
  }
  return {
    object,
    height: 2.8,
    setValue(v) {
      column.scale.y = lerp(0.08, 1, v);
      if (v < 0.5) liquid.color.lerpColors(COLD, WARM, v * 2);
      else liquid.color.lerpColors(WARM, HOT, (v - 0.5) * 2);
      liquid.emissive.copy(liquid.color);
      liquid.emissiveIntensity = lerp(0.1, 0.3, v);
    },
  };
}
