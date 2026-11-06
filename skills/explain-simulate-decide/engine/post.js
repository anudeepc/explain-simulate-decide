// The film look. The scene renders into a high-range buffer, then one chain of
// small passes finishes it the way a film camera and a grade would:
//   ambient occlusion  soft contact shade where things meet the ground and each other
//   bloom              bright things (sunlight, power, the sun) glow into the air
//   depth of field     the subject sharp, the rest of the miniature softly out of focus
//   grade              filmic tone curve, warm highlights, cool shadows, vignette, fine grain
// Everything is a pure function of the frame time, so a frame drawn twice is identical
// and a recorded MP4 matches what plays on screen.
import * as THREE from './vendor/three/three.module.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// one triangle that covers the screen
const TRI = new THREE.BufferGeometry();
TRI.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
TRI.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

const DEPTH = /* glsl */ `
uniform sampler2D tDepth; uniform float near; uniform float far;
float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return (near * far) / ((far - near) * d - far); }
`;

const AO_FRAG = /* glsl */ `
varying vec2 vUv;
${DEPTH}
uniform mat4 projInv; uniform mat4 proj; uniform mat4 viewInv; uniform vec2 texel; uniform float radius;
vec3 viewPos(vec2 uv){ float z = viewZ(uv); vec4 c = projInv * vec4(uv * 2.0 - 1.0, 0.0, 1.0); return c.xyz / c.z * z; }
void main(){
  // this pass runs at half size: snap to a full-size depth texel, or neighbours round
  // inconsistently and the rebuilt normals flip row by row
  vec2 uv = (floor(vUv / texel) + 0.5) * texel;
  float d = texture2D(tDepth, uv).x;
  if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = viewPos(uv);
  // normal from the nearer neighbour on each axis (keeps silhouettes clean)
  vec3 pr = viewPos(uv + vec2(texel.x, 0.0)); vec3 pl = viewPos(uv - vec2(texel.x, 0.0));
  vec3 pu = viewPos(uv + vec2(0.0, texel.y)); vec3 pd = viewPos(uv - vec2(0.0, texel.y));
  vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;
  vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
  vec3 n = normalize(cross(dx, dy));
  // a fixed 4x4 rotation pattern; the blur pass averages exactly one tile away
  vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
  float rot = (cell.x * 4.0 + cell.y) * 0.3926991;
  float occ = 0.0;
  const int N = 12;
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    float a = fi * 2.3999632 + rot;
    float r = (fi + 0.5) / float(N);
    vec3 dir = vec3(cos(a) * sqrt(1.0 - r), sin(a) * sqrt(1.0 - r), sqrt(r));
    // build a frame around the normal
    vec3 t = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
    vec3 b = cross(n, t);
    vec3 s = p + n * 0.04 + (t * dir.x + b * dir.y + n * dir.z) * radius * mix(0.25, 1.0, r * r);
    vec4 c = proj * vec4(s, 1.0);
    vec2 suv = c.xy / c.w * 0.5 + 0.5;
    float sz = viewZ(suv);
    float range = smoothstep(0.0, 1.0, radius / abs(p.z - sz));
    float bias = 0.03 + 0.003 * -p.z; // grows with distance, so flat ground never shades itself
    occ += (sz >= s.z + bias ? 1.0 : 0.0) * range;
  }
  // only the miniature gets contact shade; the far floor stays clean
  // only the miniature gets contact shade: not the floor far below the plinth, not
  // anything far away, and not surfaces seen edge-on (where depth is too coarse)
  float worldY = (viewInv * vec4(p, 1.0)).y;
  float near = (1.0 - smoothstep(30.0, 55.0, -p.z)) * smoothstep(-0.9, -0.5, worldY) * smoothstep(0.12, 0.3, dot(n, normalize(-p)));
  gl_FragColor = vec4(vec3(1.0 - occ / float(N) * near), 1.0);
}`;

const AO_BLUR = /* glsl */ `
varying vec2 vUv; uniform sampler2D tAo; uniform vec2 texel;
void main(){
  float s = 0.0;
  for (int x = -2; x < 2; x++) for (int y = -2; y < 2; y++) s += texture2D(tAo, vUv + vec2(float(x) + 0.5, float(y) + 0.5) * texel).r;
  gl_FragColor = vec4(vec3(s / 16.0), 1.0);
}`;

// bloom: keep only what is brighter than paper, then a dual-filter blur pyramid
const PREFILTER = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform vec2 texel; uniform float threshold;
void main(){
  vec3 c = texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, -1.0)).rgb
         + texture2D(tColor, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - threshold, 0.0);
  k = k * k / (k + 0.6);
  gl_FragColor = vec4(c * k / max(l, 1e-4), 1.0);
}`;
const DOWN = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform vec2 texel;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * 4.0;
  c += texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;
const UP = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tBase; uniform vec2 texel;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + texel * vec2(-2.0, 0.0)).rgb + texture2D(tColor, vUv + texel * vec2(2.0, 0.0)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(0.0, -2.0)).rgb + texture2D(tColor, vUv + texel * vec2(0.0, 2.0)).rgb;
  c += (texture2D(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, -1.0)).rgb
      + texture2D(tColor, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + texel * vec2(1.0, 1.0)).rgb) * 2.0;
  gl_FragColor = vec4(c / 12.0 + texture2D(tBase, vUv).rgb, 1.0);
}`;

const FINAL = /* glsl */ `
varying vec2 vUv;
${DEPTH}
uniform sampler2D tColor; uniform sampler2D tAo; uniform sampler2D tBloom;
uniform vec2 texel; uniform vec2 res; uniform float time;
uniform float focus; uniform float aperture; uniform float maxBlur;
uniform float aoStrength; uniform float bloomStrength; uniform float exposure; uniform float vignette; uniform float grain; uniform float contrast; uniform float saturation;

float coc(float z){ return clamp(aperture * abs(z - focus) / max(z, 0.1) * res.y / 1080.0, 0.0, maxBlur); }

// Khronos PBR Neutral: keeps base colours true (the clay palette stays the clay palette)
// and only rolls off highlights, unlike ACES, which greys pastels out.
vec3 neutral(vec3 c){
  float x = min(c.r, min(c.g, c.b));
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= off;
  float peak = max(c.r, max(c.g, c.b));
  const float sc = 0.76;
  if (peak < sc) return c;
  const float d = 1.0 - sc;
  float np = 1.0 - d * d / (peak + d - sc);
  c *= np / peak;
  float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0);
  return mix(c, vec3(np), g);
}
vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main(){
  float z = -viewZ(vUv);
  float c0 = coc(z);
  vec3 col = texture2D(tColor, vUv).rgb;
  if (c0 > 0.6) {
    // golden-angle gather; a sample only counts if it is itself blurred that far
    vec3 sum = col; float wsum = 1.0;
    const int N = 28;
    for (int i = 1; i < N; i++) {
      float fi = float(i);
      float r = sqrt(fi / float(N)) * c0;
      float a = fi * 2.3999632;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r * texel;
      float zs = -viewZ(uv);
      float cs = coc(zs);
      float w = smoothstep(r - 1.0, r + 1.0, zs < z ? cs : min(cs, c0) + 0.5 * c0);
      sum += texture2D(tColor, uv).rgb * w; wsum += w;
    }
    col = sum / wsum;
  }
  float ao = texture2D(tAo, vUv).r;
  col *= mix(1.0, ao, aoStrength);
  col += texture2D(tBloom, vUv).rgb * bloomStrength;
  col = neutral(col * exposure);
  vec2 q = vUv - 0.5; q.x *= res.x / res.y;
  col *= 1.0 - vignette * smoothstep(0.35, 1.05, length(q));
  col = toSrgb(clamp(col, 0.0, 1.0));
  // grade, in display space: a gentle S-curve for contrast, a little more colour,
  // shadows a touch cool and highlights a touch warm
  col = mix(col, col * col * (3.0 - 2.0 * col), contrast);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col += vec3(-0.006, 0.0, 0.008) * (1.0 - l) * (1.0 - l); // a touch of cool in the shadows; whites stay white
  // fine grain, new each frame of film time, plus dither against banding
  float g = hash(gl_FragCoord.xy + floor(time * 24.0) * 17.31) - 0.5;
  col += g * grain + (hash(gl_FragCoord.yx * 1.31) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const LEVELS = 5;

export function createPost(renderer) {
  const gl2 = renderer.capabilities.isWebGL2;
  const quadCam = new THREE.Camera();
  const quad = new THREE.Mesh(TRI);
  quad.frustumCulled = false;
  const make = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const rt = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...o });

  const depthTexture = new THREE.DepthTexture(1, 1);
  depthTexture.type = THREE.FloatType; // 32-bit: 16 or 24 bits band on flat ground
  const scene = rt(1, 1, { depthBuffer: true, depthTexture, samples: gl2 ? 4 : 0 });
  const aoRaw = rt(1, 1, { type: THREE.UnsignedByteType });
  const aoBlur = rt(1, 1, { type: THREE.UnsignedByteType });
  const down = Array.from({ length: LEVELS }, () => rt(1, 1));
  const up = Array.from({ length: LEVELS }, () => rt(1, 1));

  const depthU = () => ({ tDepth: { value: depthTexture }, near: { value: 0.1 }, far: { value: 400 } });
  const aoMat = make(AO_FRAG, { ...depthU(), projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, viewInv: { value: new THREE.Matrix4() }, texel: { value: new THREE.Vector2() }, radius: { value: 0.9 } });
  const aoBlurMat = make(AO_BLUR, { tAo: { value: aoRaw.texture }, texel: { value: new THREE.Vector2() } });
  const preMat = make(PREFILTER, { tColor: { value: scene.texture }, texel: { value: new THREE.Vector2() }, threshold: { value: 1.6 } });
  const downMat = make(DOWN, { tColor: { value: null }, texel: { value: new THREE.Vector2() } });
  const upMat = make(UP, { tColor: { value: null }, tBase: { value: null }, texel: { value: new THREE.Vector2() } });
  const finalMat = make(FINAL, {
    ...depthU(),
    tColor: { value: scene.texture },
    tAo: { value: aoBlur.texture },
    tBloom: { value: null },
    texel: { value: new THREE.Vector2() },
    res: { value: new THREE.Vector2() },
    time: { value: 0 },
    focus: { value: 20 },
    aperture: { value: 9 },
    maxBlur: { value: 7 },
    aoStrength: { value: 0.75 },
    bloomStrength: { value: 0.55 },
    exposure: { value: 1.0 },
    contrast: { value: 0.28 },
    saturation: { value: 1.0 },
    vignette: { value: 0.1 },
    grain: { value: 0.018 },
  });
  const finalU = finalMat.uniforms;
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  black.needsUpdate = true;

  let w = 1;
  let h = 1;
  const pass = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quad, quadCam);
  };

  const api = {
    /** Look settings that a shot or the player may change. */
    settings: finalU,
    setSize(width, height) {
      w = Math.max(1, Math.round(width));
      h = Math.max(1, Math.round(height));
      scene.setSize(w, h);
      const hw = Math.max(1, w >> 1);
      const hh = Math.max(1, h >> 1);
      aoRaw.setSize(hw, hh);
      aoBlur.setSize(hw, hh);
      for (let i = 0; i < LEVELS; i++) {
        const lw = Math.max(1, w >> (i + 1));
        const lh = Math.max(1, h >> (i + 1));
        down[i].setSize(lw, lh);
        up[i].setSize(lw, lh);
      }
      finalU.texel.value.set(1 / w, 1 / h);
      finalU.res.value.set(w, h);
    },
    /**
     * @param {THREE.Scene} s
     * @param {THREE.PerspectiveCamera} cam
     * @param {{time?: number, focus?: number}} o
     */
    render(s, cam, { time = 0, focus } = {}) {
      const prevTarget = renderer.getRenderTarget();
      const prevTone = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(scene);
      renderer.clear();
      renderer.render(s, cam);

      for (const m of [aoMat, finalMat]) {
        m.uniforms.near.value = cam.near;
        m.uniforms.far.value = cam.far;
      }
      aoMat.uniforms.proj.value.copy(cam.projectionMatrix);
      aoMat.uniforms.projInv.value.copy(cam.projectionMatrixInverse);
      aoMat.uniforms.viewInv.value.copy(cam.matrixWorld);
      aoMat.uniforms.texel.value.set(1 / w, 1 / h);
      if (finalU.aoStrength.value > 0) {
        pass(aoMat, aoRaw);
        aoBlurMat.uniforms.texel.value.set(1 / aoRaw.width, 1 / aoRaw.height);
        pass(aoBlurMat, aoBlur);
        finalU.tAo.value = aoBlur.texture;
      } else finalU.tAo.value = black; // unused when strength is 0

      // bloom pyramid
      preMat.uniforms.texel.value.set(0.5 / w, 0.5 / h);
      pass(preMat, down[0]);
      for (let i = 1; i < LEVELS; i++) {
        downMat.uniforms.tColor.value = down[i - 1].texture;
        downMat.uniforms.texel.value.set(1 / down[i - 1].width, 1 / down[i - 1].height);
        pass(downMat, down[i]);
      }
      let src = down[LEVELS - 1];
      for (let i = LEVELS - 2; i >= 0; i--) {
        upMat.uniforms.tColor.value = src.texture;
        upMat.uniforms.tBase.value = down[i].texture;
        upMat.uniforms.texel.value.set(0.5 / src.width, 0.5 / src.height);
        pass(upMat, up[i]);
        src = up[i];
      }
      finalU.tBloom.value = src.texture;

      finalU.time.value = time;
      if (focus !== undefined) finalU.focus.value = focus;
      pass(finalMat, prevTarget);
      renderer.toneMapping = prevTone;
    },
  };
  return api;
}
