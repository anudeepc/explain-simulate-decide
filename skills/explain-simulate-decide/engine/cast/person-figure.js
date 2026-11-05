// Person: an abstract, faceless pawn-like figure with a slim bar beside it that rises with the value.
import { clay, rounded, sphere, mesh, group, PALETTE, THREE, lerp } from './kit.js';

function pawnGeometry() {
  const curve = new THREE.SplineCurve([
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.52, 0.02),
    new THREE.Vector2(0.56, 0.1),
    new THREE.Vector2(0.44, 0.2),
    new THREE.Vector2(0.33, 0.45),
    new THREE.Vector2(0.3, 0.8),
    new THREE.Vector2(0.36, 1.08),
    new THREE.Vector2(0.44, 1.28),
    new THREE.Vector2(0.38, 1.44),
    new THREE.Vector2(0.14, 1.52),
    new THREE.Vector2(0.001, 1.53),
  ]);
  return new THREE.LatheGeometry(curve.getPoints(60), 48);
}

export default function build({ color = PALETTE.sky } = {}) {
  const object = group();
  const fig = group();
  fig.position.x = -0.35;
  object.add(fig);
  const mat = clay(color);
  fig.add(mesh(pawnGeometry(), mat));
  fig.add(mesh(sphere(0.12, 16), mat, { y: 1.58 }));
  fig.add(mesh(sphere(0.31, 40), mat, { y: 1.9 }));
  // bar beside the figure
  object.add(mesh(rounded(0.5, 0.12, 0.5, 0.05), clay(PALETTE.sand), { x: 0.75, y: 0.06 }));
  const barH = 2.0;
  const barGeo = rounded(0.28, barH, 0.28, 0.08);
  barGeo.translate(0, barH / 2, 0);
  const barMat = clay(PALETTE.gold, { emissive: 0.1 });
  const bar = mesh(barGeo, barMat, { x: 0.75, y: 0.12 });
  object.add(bar);
  return {
    object,
    height: 2.25,
    setValue(v) {
      bar.scale.y = lerp(0.08, 1, v);
      barMat.emissiveIntensity = lerp(0.05, 0.3, v);
    },
  };
}
