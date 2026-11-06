// Tank: a glass tank that fills with whatever builds up that isn't money: water, sleep
// debt, carbon in the air, stock on a shelf. Same parts as the jar: a level, a target
// line, a flag when it is reached, and a ghost ring at the previous try.
import { clay, rounded, cylinder, torus, mesh, group, PALETTE, THREE, clamp01 } from './kit.js';

const R = 0.95;
const H = 2.3;

export default function build({ tint = '#4f9fc4' } = {}) {
  const object = group();
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.25, metalness: 0, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 0.6, emissive: new THREE.Color(tint), emissiveIntensity: 0.08 });
  const liquidGeo = cylinder(R * 0.9, R * 0.9, 1, 48);
  liquidGeo.translate(0, 0.5, 0);
  const liquid = mesh(liquidGeo, liquidMat, { y: 0.09 });
  object.add(liquid);
  const surface = mesh(cylinder(R * 0.9, R * 0.9, 0.012, 48), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(tint).lerp(new THREE.Color('#ffffff'), 0.45), roughness: 0.1, clearcoat: 1 }));
  object.add(surface);

  const glass = new THREE.MeshPhysicalMaterial({ color: '#eaf4f6', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.2, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  const shell = mesh(new THREE.CylinderGeometry(R, R, H, 48, 1, true), glass, { y: H / 2 + 0.05 });
  shell.castShadow = false;
  shell.renderOrder = 2;
  object.add(shell);
  object.add(mesh(cylinder(R + 0.05, R + 0.05, 0.09, 48), clay('#d9d2c4'), { y: 0.045 }));
  object.add(mesh(torus(R + 0.01, 0.04, 64), clay(PALETTE.slate), { y: H + 0.05, rx: Math.PI / 2 }));
  // a measuring scale up the side
  for (let i = 1; i < 6; i++) object.add(mesh(rounded(0.18, 0.025, 0.02, 0.01), clay(PALETTE.ink), { x: -R * 0.55, y: 0.09 + (i / 6) * (H - 0.2), z: R * 0.82, ry: -0.6 }));

  const targetMat = clay(PALETTE.terracotta, { emissive: 0.2 });
  const target = mesh(torus(R + 0.06, 0.035, 64), targetMat, { rx: Math.PI / 2 });
  object.add(target);
  const flag = group();
  flag.add(mesh(cylinder(0.025, 0.025, 0.9, 10), clay(PALETTE.ink), { y: 0.45 }));
  const flagMat = clay(PALETTE.green, { emissive: 0.2 });
  flag.add(mesh(rounded(0.45, 0.28, 0.03, 0.02), flagMat, { x: 0.23, y: 0.75 }));
  flag.position.set(R + 0.06, 0, 0);
  object.add(flag);
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const ghost = mesh(torus(R + 0.02, 0.02, 64), ghostMat, { rx: Math.PI / 2 });
  object.add(ghost);

  const yOf = (f) => 0.09 + clamp01(f) * (H - 0.2);
  const api = {
    object,
    height: H + 0.3,
    footprint: 1.3,
    anchor: new THREE.Vector3(0, H + 0.3, 0),
    setValue(v) {
      const h = Math.max(0.001, clamp01(v) * (H - 0.2));
      liquid.scale.y = h;
      liquid.visible = v > 0.002;
      surface.position.y = 0.09 + h;
      surface.visible = v > 0.002;
    },
    setTarget(f) {
      target.visible = f !== null;
      if (f === null) return;
      target.position.y = yOf(f);
      flag.position.y = yOf(f);
    },
    setReached(k) {
      const r = clamp01(k);
      flag.scale.setScalar(Math.max(0.001, r));
      targetMat.color.set(r > 0.5 ? PALETTE.green : PALETTE.terracotta);
      targetMat.emissive.copy(targetMat.color);
    },
    setGhost(f) {
      ghostMat.opacity = f === null ? 0 : 0.85;
      if (f !== null) ghost.position.y = yOf(f);
    },
  };
  api.setTarget(null);
  api.setReached(0);
  api.setGhost(null);
  api.setValue(0.3);
  return api;
}
