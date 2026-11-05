// Cause → effect: glowing beads travel along an arc from one actor to another.
import * as THREE from './vendor/three/three.module.js';

const COUNT = 14;

export function createFlow(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: '#f5b83d', emissive: '#f5b83d', emissiveIntensity: 0.8, roughness: 0.5, transparent: true });
  const geo = new THREE.SphereGeometry(0.11, 16, 12);
  const beads = new THREE.InstancedMesh(geo, mat, COUNT);
  beads.frustumCulled = false;
  scene.add(beads);
  const m4 = new THREE.Matrix4();
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  const pt = new THREE.Vector3();

  /**
   * @param {THREE.Vector3|null} from
   * @param {THREE.Vector3|null} to
   * @param {number} intensity 0..1 (0 hides)
   * @param {number} phase moving phase (seconds or progress)
   */
  function update(from, to, intensity, phase) {
    if (!from || !to || intensity <= 0.001) {
      beads.visible = false;
      return;
    }
    beads.visible = true;
    mat.opacity = intensity;
    curve.v0.copy(from);
    curve.v2.copy(to);
    curve.v1.copy(from).add(to).multiplyScalar(0.5);
    curve.v1.y += 1.2 + from.distanceTo(to) * 0.25;
    for (let i = 0; i < COUNT; i++) {
      const t = (i / COUNT + phase) % 1;
      curve.getPoint(t, pt);
      const s = Math.sin(Math.PI * t) * intensity;
      m4.makeScale(s, s, s).setPosition(pt);
      beads.setMatrixAt(i, m4);
    }
    beads.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
