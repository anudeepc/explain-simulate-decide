// The set: renderer, soft studio lighting, floor, backdrop and actor marks.
import * as THREE from './vendor/three/three.module.js';

export const BACKDROP = '#efe9df';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKDROP);
  scene.fog = new THREE.Fog(BACKDROP, 30, 70);

  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);

  // lighting: warm sky, soft key with shadows, cool rim from behind
  scene.add(new THREE.HemisphereLight('#fff7ea', '#d9cbb5', 1.35));
  const key = new THREE.DirectionalLight('#fff3e0', 2.1);
  key.position.set(7, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 16;
  key.shadow.camera.bottom = -16;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 50;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#dbe7ff', 0.7);
  rim.position.set(-8, 7, -10);
  scene.add(rim);

  // floor: a large soft disc that fades into the backdrop
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(60, 96),
    new THREE.MeshStandardMaterial({ color: '#e9e1d3', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // curved cyclorama behind the set
  const cyc = new THREE.Mesh(
    new THREE.CylinderGeometry(34, 34, 30, 96, 1, true, Math.PI * 0.6, Math.PI * 0.8),
    new THREE.MeshStandardMaterial({ color: '#efe7da', roughness: 1, side: THREE.BackSide }),
  );
  cyc.position.set(0, 14.9, 4);
  scene.add(cyc);

  const markMat = new THREE.MeshStandardMaterial({ color: '#ddd2bf', roughness: 1 });
  /** A round stage mark under each actor. */
  const addMark = (x, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.42, 0.06, 64), markMat);
    m.position.set(x, 0.03, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  const setSize = (w, h, dpr = 1) => {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const look = (position, target) => {
    camera.position.set(...position);
    camera.lookAt(...target);
  };

  return { THREE, renderer, scene, camera, setSize, look, addMark, render: () => renderer.render(scene, camera) };
}

/** Project a world point to canvas CSS pixels. */
export function toScreen(camera, v3, w, h) {
  const p = v3.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
}
