// The set: renderer, daylight, sky, and the diorama plinth the world stands on.
import * as THREE from './vendor/three/three.module.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { createPost } from './post.js';

export const LOOK = {
  skyTop: '#7fb2e0',
  horizon: '#ddd3c3',
  floor: '#c4b8a6',
  top: '#bccf9f',
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
  renderer.autoClear = true;
  const post = createPost(renderer);
  // Quality steps. Phones and small machines start one step down; a machine with no
  // graphics chip (software rendering) starts two down; slow frames step down further.
  //   0 everything   1 no contact shade, lighter blur   2 no depth of field   3 fewer pixels
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const software = /swiftshader|llvmpipe|software|basic render/i.test(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '');
  const lite = !!(globalThis.matchMedia?.('(pointer: coarse)').matches || (globalThis.navigator?.hardwareConcurrency || 8) <= 4);
  let level = software ? 2 : lite ? 1 : 0;
  const FULL = { ao: post.settings.aoStrength.value, blur: post.settings.maxBlur.value };
  const applyLevel = () => {
    post.settings.aoStrength.value = level >= 1 ? 0 : FULL.ao;
    post.settings.maxBlur.value = level >= 2 ? 0 : level >= 1 ? 4 : FULL.blur;
  };
  applyLevel();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(LOOK.horizon, 80, 220);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

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

  // late-afternoon light: a warm, low sun key with long soft shadows, a cool sky fill,
  // and a rim from behind that separates each prop from the ground
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#a88d68', 0.55));
  const key = new THREE.DirectionalLight('#ffeacc', 3.0);
  key.position.set(9, 18, 12);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(level > 0 ? 2048 : 4096);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#cfe1ff', 1.3);
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
    key.position.set(cx + 13, 14, cz + 10);
    key.shadow.camera.updateProjectionMatrix();
    return { w, d, cx, cz };
  };

  /** A soft pool of warm light on the ground under the node in focus, like a stage spot. */
  const poolMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { alpha: { value: 0 }, color: { value: new THREE.Color('#ffd9a0') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float alpha; uniform vec3 color; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float k = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0); gl_FragColor = vec4(color * k * alpha * 0.55, 1.0); }',
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), poolMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  ring.renderOrder = 2;
  scene.add(ring);
  const markFocus = (x, z, alpha) => {
    ring.position.x = x;
    ring.position.z = z;
    poolMat.uniforms.alpha.value = alpha;
    ring.visible = alpha > 0.01;
  };

  const setSize = (w, h, dpr = 1) => {
    if (level >= 3) dpr = Math.min(dpr, 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    post.setSize(w * dpr, h * dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const aim = new THREE.Vector3();
  const look = (position, target) => {
    camera.position.set(...position);
    aim.set(...target);
    camera.lookAt(aim);
  };

  /** Draw a frame. The lens focuses on whatever the camera is aimed at. */
  const render = (time = 0) => post.render(scene, camera, { time, focus: camera.position.distanceTo(aim) });

  /** Step quality down once. Returns false when there is nothing left to trim. */
  const degrade = () => {
    if (level >= 3) return false;
    level++;
    applyLevel();
    return true;
  };

  /** Full quality for recording, whatever the screen could manage. */
  const withFullQuality = async (fn) => {
    const saved = level;
    level = software ? 2 : 0; // frame by frame, so slow frames only make it take longer
    applyLevel();
    try {
      return await fn();
    } finally {
      level = saved;
      applyLevel();
    }
  };

  return { THREE, renderer, scene, camera, setSize, look, addBase, markFocus, render, post, degrade, withFullQuality };
}

/** Project a world point to canvas CSS pixels. */
export function toScreen(camera, v3, w, h) {
  const p = v3.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
}
