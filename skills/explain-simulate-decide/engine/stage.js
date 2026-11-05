// The set: renderer, daylight, sky, and the diorama plinth the world stands on.
import * as THREE from './vendor/three/three.module.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';

export const LOOK = {
  skyTop: '#7fb2e0',
  horizon: '#efe6d6',
  floor: '#d9cdb8',
  top: '#c4d6a0',
  side: '#a8805a',
  band: '#8a6646',
};

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(LOOK.horizon, 80, 220);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // sky: a gradient dome that melts into the fog at the horizon
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(LOOK.skyTop) }, horizon: { value: new THREE.Color(LOOK.horizon) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.55, vP.y); gl_FragColor = vec4(mix(horizon, top, k), 1.0); }',
    }),
  );
  scene.add(sky);

  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 400);

  // daylight: warm sun key with soft shadows, sky/ground fill, cool rim
  scene.add(new THREE.HemisphereLight('#dcebff', '#b89f78', 0.75));
  const key = new THREE.DirectionalLight('#ffecd0', 3.0);
  key.position.set(9, 18, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#d6e6ff', 0.8);
  rim.position.set(-10, 8, -12);
  scene.add(rim);

  // a far floor so the plinth sits somewhere
  const floor = new THREE.Mesh(new THREE.CircleGeometry(260, 64), new THREE.MeshStandardMaterial({ color: LOOK.floor, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  floor.receiveShadow = true;
  scene.add(floor);

  /** The diorama plinth, sized to the set. */
  const addBase = ({ minX, maxX, minZ, maxZ }) => {
    const pad = 3.2;
    const w = maxX - minX + pad * 2;
    const d = maxZ - minZ + pad * 2;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const base = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({ color: LOOK.side, roughness: 0.95 });
    const slab = new THREE.Mesh(new RoundedBoxGeometry(w, 1.1, d, 4, 0.5), side);
    slab.position.set(cx, -0.62, cz);
    slab.receiveShadow = true;
    const band = new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, 0.12, d + 0.04, 2, 0.06), new THREE.MeshStandardMaterial({ color: LOOK.band, roughness: 1 }));
    band.position.set(cx, -0.75, cz);
    const top = new THREE.Mesh(new RoundedBoxGeometry(w - 0.1, 0.22, d - 0.1, 4, 0.11), new THREE.MeshStandardMaterial({ color: LOOK.top, roughness: 0.9 }));
    top.position.set(cx, -0.1, cz);
    top.receiveShadow = true;
    base.add(slab, band, top);
    scene.add(base);
    // fit the sun's shadow camera tightly around the set
    const r = Math.hypot(w, d) / 2 + 2;
    Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 80 });
    key.target.position.set(cx, 0, cz);
    key.position.set(cx + 9, 18, cz + 12);
    key.shadow.camera.updateProjectionMatrix();
    return { w, d, cx, cz };
  };

  /** A soft ring on the ground that marks the node in focus. */
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.55, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  scene.add(ring);
  const markFocus = (x, z, alpha) => {
    ring.position.x = x;
    ring.position.z = z;
    ringMat.opacity = alpha * 0.85;
    ring.visible = alpha > 0.01;
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

  return { THREE, renderer, scene, camera, setSize, look, addBase, markFocus, render: () => renderer.render(scene, camera) };
}

/** Project a world point to canvas CSS pixels. */
export function toScreen(camera, v3, w, h) {
  const p = v3.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
}
