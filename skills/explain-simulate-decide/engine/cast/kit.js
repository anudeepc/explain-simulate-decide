// Shared building blocks for studio actors: one matte "clay" look for the whole cast.
// Every actor is built from these so the cast reads as one family.
import * as THREE from '../vendor/three/three.module.js';
import { RoundedBoxGeometry } from '../vendor/three/RoundedBoxGeometry.js';

export { THREE };

export const PALETTE = {
  cream: '#f4ecdd',
  paper: '#fbf7ef',
  sand: '#e3c99e',
  clay: '#d4835d',
  terracotta: '#c0623f',
  sage: '#8fae8b',
  leaf: '#6b9a6a',
  sky: '#86b6dd',
  navy: '#2f3e57',
  slate: '#5b6b80',
  sun: '#f5b83d',
  gold: '#e2b04b',
  ink: '#2b2b30',
  red: '#d65a4f',
  green: '#5aa469',
  white: '#ffffff',
};

/** Matte clay material. */
export function clay(color, { emissive = 0, opacity = 1 } = {}) {
  const c = new THREE.Color(color);
  const m = new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.82,
    metalness: 0,
    emissive: c.clone(),
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity,
  });
  return m;
}

/** Minted metal (coins): warm gold that reflects the room, so money reads as money. */
export function gold(color = '#f2c14e') {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.7, envMapIntensity: 3, emissive: c.clone(), emissiveIntensity: 0.12 });
}

/** Rounded box geometry (soft edges read as "clay"). */
export const rounded = (w, h, d, r = 0.08, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
export const cylinder = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sphere = (r, seg = 32) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
export const torus = (r, tube, seg = 48) => new THREE.TorusGeometry(r, tube, 16, seg);
export const cone = (r, h, seg = 32) => new THREE.ConeGeometry(r, h, seg);

/** Make a mesh with position/rotation in one call. */
export function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.setScalar(s);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const group = () => new THREE.Group();

/**
 * Text drawn on a canvas texture (for bills, screens, labels).
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw
 */
export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, canvas, ctx, redraw: (fn) => { fn(ctx, w, h); tex.needsUpdate = true; } };
}

export const FONT = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
