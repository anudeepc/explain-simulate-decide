// The set: renderer, daylight, sky, and the diorama plinth the world stands on.
import * as THREE from './vendor/three/three.module.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { createPost } from './post.js';

import { STUDIO_LOOK, TONES } from './look.js';

/** @param {HTMLCanvasElement} canvas  @param {{accent: string, ground: string}} [tone] */
export function createStage(canvas, tone = TONES.neutral) {
  const LOOK = { ...STUDIO_LOOK, top: tone.ground };
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
  // the far floor fades into the backdrop at the same brightness, so there is no horizon line
  scene.fog = new THREE.Fog(new THREE.Color(LOOK.horizon).multiplyScalar(1.9), 40, 160);
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
      // brighter than 1, so after the film's tone curve the backdrop reads as clean white
      uniforms: { top: { value: new THREE.Color(LOOK.skyTop) }, horizon: { value: new THREE.Color(LOOK.horizon) }, lift: { value: 1.9 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform float lift; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.55, vP.y); gl_FragColor = vec4(mix(horizon, top, k) * lift, 1.0); }',
    }),
  );
  scene.add(sky);

  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 400);

  // late-afternoon light: a warm, low sun key with long soft shadows, a cool sky fill,
  // and a rim from behind that separates each prop from the ground
  scene.add(new THREE.HemisphereLight('#e4ecff', '#d9d6d0', 0.7));
  const key = new THREE.DirectionalLight('#fff4e6', 3.0);
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

  /** A soft pool of the film's accent colour on the ground under the node in focus. */
  const poolMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { alpha: { value: 0 }, color: { value: new THREE.Color(tone.accent) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float alpha; uniform vec3 color; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float k = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0); gl_FragColor = vec4(color, k * alpha * 0.2); }',
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
  const render = (time = 0, which = scene) => post.render(which, camera, { time, focus: camera.position.distanceTo(aim) });

  /**
   * A second studio for the story world: the same white backdrop and light as the
   * diorama, with a floor at `groundY`. The key light is s.userData.key; the director
   * moves it with the camera so shadows stay sharp where we look. The sun shines from
   * the north-west, the side the story camera looks from.
   */
  const makeSetScene = ({ groundY = 0 } = {}) => {
    const s = new THREE.Scene();
    s.fog = scene.fog;
    s.environment = scene.environment;
    s.environmentIntensity = scene.environmentIntensity;
    s.add(new THREE.Mesh(sky.geometry, sky.material));
    s.add(new THREE.HemisphereLight('#e4ecff', '#d9d6d0', 0.75));
    const k = new THREE.DirectionalLight('#fff4e6', 2.8);
    k.position.set(-4, 7, -5);
    k.castShadow = true;
    k.shadow.mapSize.setScalar(level > 0 ? 1024 : 2048);
    k.shadow.bias = -0.0004;
    k.shadow.normalBias = 0.02;
    k.shadow.radius = 6;
    k.shadow.blurSamples = 16;
    Object.assign(k.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
    k.shadow.camera.updateProjectionMatrix();
    s.add(k, k.target);
    const r = new THREE.DirectionalLight('#cfe1ff', 1.1);
    r.position.set(5, 4, 6);
    s.add(r);
    s.userData.key = k;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshStandardMaterial({ color: LOOK.floor, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = groundY;
    ground.receiveShadow = true;
    s.add(ground);
    return s;
  };

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

  return { THREE, renderer, scene, camera, setSize, look, addBase, markFocus, render, post, degrade, withFullQuality, makeSetScene };
}

/** Project a world point to canvas CSS pixels. */
export function toScreen(camera, v3, w, h) {
  const p = v3.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
}
