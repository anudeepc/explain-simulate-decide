// Shared pieces for the film sets: floors, walls, windows, furniture, plants.
// Everything is the cast's matte clay, built in metres with the floor at y = 0.
// A set is a partial room like a theatre set: a floor patch and one or two walls,
// open toward +Z where the camera is.
import { clay, rounded, cylinder, sphere, mesh, group, canvasTexture, THREE } from '../cast/kit.js';

export const WALL_H = 2.7;
export const WALL_T = 0.12;

/** A few shared colours for sets (cool, light, calm on white). */
export const SET_PALETTE = {
  wall: '#f7f7f5',
  skirting: '#ffffff',
  nhs: '#1f63b5',
  nhsDark: '#164b8c',
  teal: '#0e7c7b',
  leaf: '#4f8f5b',
  leafDark: '#3d7449',
  leafLight: '#78ad6c',
  oak: '#d9b98c',
  oakDark: '#b98f5f',
  charcoal: '#3e4248',
  steel: '#b9c0c8',
  glass: '#cfe4f4',
};

/** A floor texture: boards, tiles or plain speckle, drawn once on a canvas. */
export function floorTexture(kind, base, line, { w = 512, h = 512, repeat = [1, 1] } = {}) {
  const { tex } = canvasTexture(w, h, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = line;
    if (kind === 'boards') {
      // planks running along x, with staggered joints
      const rows = 8;
      const ph = h / rows;
      c.lineWidth = 2;
      for (let r = 0; r <= rows; r++) {
        c.beginPath();
        c.moveTo(0, r * ph);
        c.lineTo(w, r * ph);
        c.stroke();
        const off = ((r * 0.37) % 1) * w;
        for (const x of [off, (off + w * 0.55) % w]) {
          c.beginPath();
          c.moveTo(x, r * ph);
          c.lineTo(x, (r + 1) * ph);
          c.stroke();
        }
      }
    } else if (kind === 'tiles') {
      const n = 6;
      c.lineWidth = 3;
      for (let i = 0; i <= n; i++) {
        c.beginPath();
        c.moveTo((i * w) / n, 0);
        c.lineTo((i * w) / n, h);
        c.moveTo(0, (i * h) / n);
        c.lineTo(w, (i * h) / n);
        c.stroke();
      }
    } else if (kind === 'slabs') {
      const n = 4;
      c.lineWidth = 4;
      for (let i = 0; i <= n; i++) {
        c.beginPath();
        c.moveTo((i * w) / n, 0);
        c.lineTo((i * w) / n, h);
        c.moveTo(0, (i * h) / n);
        c.lineTo(w, (i * h) / n);
        c.stroke();
      }
    }
    // a faint speckle so large surfaces are not flat colour
    c.fillStyle = line;
    c.globalAlpha = 0.08;
    for (let i = 0; i < 900; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 12345.678) % 1;
      c.fillRect(Math.abs(x) * w, Math.abs(y) * h, 2, 2);
    }
    c.globalAlpha = 1;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  return tex;
}

/** A floor patch with its top at y = 0. */
export function floor(w, d, { color = '#ffffff', map = null, x = 0, z = 0, thick = 0.08 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, map, roughness: 0.85, metalness: 0 });
  const m = mesh(rounded(w, thick, d, 0.025, 1), mat, { x, y: -thick / 2, z });
  m.castShadow = false;
  return m;
}

/**
 * A straight wall with a skirting board, from (x0, z0) to (x1, z1), standing on y = 0.
 * Openings (doors/windows) are holes along the wall: { at, w, y0, y1 } measured from the start.
 */
export function wall(x0, z0, x1, z1, { h = WALL_H, color = SET_PALETTE.wall, skirting = SET_PALETTE.skirting, openings = [], t = WALL_T, skirtSide = 1 } = {}) {
  const g = group();
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(-(z1 - z0), x1 - x0);
  g.position.set(x0, 0, z0);
  g.rotation.y = ang;
  const mat = clay(color);
  // split the wall into solid pieces around the openings
  const cuts = [...openings].sort((a, b) => a.at - b.at);
  let s = 0;
  const piece = (a, b, y0, y1) => {
    if (b - a < 0.005 || y1 - y0 < 0.005) return;
    g.add(mesh(rounded(b - a, y1 - y0, t, 0.015, 1), mat, { x: (a + b) / 2, y: (y0 + y1) / 2 }));
  };
  for (const o of cuts) {
    piece(s, o.at - o.w / 2, 0, h);
    piece(o.at - o.w / 2, o.at + o.w / 2, 0, o.y0);
    piece(o.at - o.w / 2, o.at + o.w / 2, o.y1, h);
    s = o.at + o.w / 2;
  }
  piece(s, len, 0, h);
  // skirting on the room side (local +z is the room side when walking start→end with the room on the left)
  const sk = clay(skirting);
  let a = 0;
  for (const o of cuts.filter((o) => o.y0 < 0.1)) {
    if (o.at - o.w / 2 - a > 0.01) g.add(mesh(rounded(o.at - o.w / 2 - a, 0.1, 0.02, 0.006, 1), sk, { x: (a + o.at - o.w / 2) / 2, y: 0.05, z: skirtSide * (t / 2 + 0.01) }));
    a = o.at + o.w / 2;
  }
  if (len - a > 0.01) g.add(mesh(rounded(len - a, 0.1, 0.02, 0.006, 1), sk, { x: (a + len) / 2, y: 0.05, z: skirtSide * (t / 2 + 0.01) }));
  return g;
}

/** A sky-and-garden view for windows (a soft gradient with a hedge line). */
export function viewTexture({ sky0 = '#bfdcf3', sky1 = '#eaf4fb', ground = '#9cc08e', far = '#b9d3b0' } = {}) {
  return canvasTexture(256, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, sky0);
    gr.addColorStop(0.7, sky1);
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
    c.fillStyle = far;
    c.beginPath();
    c.moveTo(0, h * 0.72);
    for (let x = 0; x <= w; x += 16) c.lineTo(x, h * 0.7 - Math.abs(Math.sin(x * 0.05)) * 18 - Math.sin(x * 0.013) * 10);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    c.fillStyle = ground;
    c.fillRect(0, h * 0.84, w, h);
  }).tex;
}

/**
 * A window on a wall face, in the local XY plane facing +Z: frame, glazing bars, a glowing view and a sill.
 * The group's origin is the centre of the glass.
 */
export function windowFrame(w, h, { frame = '#ffffff', bars = 1, sill = true, view = null } = {}) {
  const g = group();
  const fm = clay(frame);
  const glass = new THREE.MeshStandardMaterial({ map: view || viewTexture(), color: '#ffffff', emissive: '#ffffff', emissiveMap: view || null, emissiveIntensity: 0.35, roughness: 0.25 });
  if (!view) glass.emissiveMap = glass.map;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
  pane.position.z = 0.005;
  g.add(pane);
  const t = 0.06;
  g.add(mesh(rounded(w + t * 2, t, 0.07, 0.015, 1), fm, { y: h / 2 + t / 2, z: 0.03 }));
  g.add(mesh(rounded(w + t * 2, t, 0.07, 0.015, 1), fm, { y: -h / 2 - t / 2, z: 0.03 }));
  g.add(mesh(rounded(t, h, 0.07, 0.015, 1), fm, { x: -w / 2 - t / 2, z: 0.03 }));
  g.add(mesh(rounded(t, h, 0.07, 0.015, 1), fm, { x: w / 2 + t / 2, z: 0.03 }));
  for (let i = 1; i <= bars; i++) g.add(mesh(rounded(0.035, h, 0.04, 0.01, 1), fm, { x: -w / 2 + (i * w) / (bars + 1), z: 0.025 }));
  g.add(mesh(rounded(w, 0.035, 0.04, 0.01, 1), fm, { y: h * 0.12, z: 0.025 }));
  if (sill) g.add(mesh(rounded(w + 0.24, 0.04, 0.18, 0.015, 1), fm, { y: -h / 2 - t - 0.02, z: 0.08 }));
  return g;
}

/** A framed picture on a wall, facing +Z. draw(ctx, w, h) paints the artwork. */
export function picture(w, h, draw, { frame = '#2b2b30' } = {}) {
  const g = group();
  g.add(mesh(rounded(w, h, 0.03, 0.008, 1), clay(frame), { z: 0.015 }));
  const { tex } = canvasTexture(256, Math.round((256 * h) / w), draw);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  art.position.z = 0.032;
  g.add(art);
  return g;
}

/** Simple calm abstract artwork. */
export function abstractArt(colors) {
  return (c, w, h) => {
    c.fillStyle = '#fbfbf9';
    c.fillRect(0, 0, w, h);
    c.fillStyle = colors[0];
    c.beginPath();
    c.arc(w * 0.38, h * 0.45, w * 0.24, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = colors[1];
    c.fillRect(w * 0.48, h * 0.3, w * 0.3, h * 0.42);
    c.fillStyle = colors[2] || colors[0];
    c.fillRect(w * 0.18, h * 0.76, w * 0.64, h * 0.04);
  };
}

/** A potted plant: a pot and a cluster of leafy balls. size ≈ total height. */
export function plant(size = 0.9, { pot = '#ffffff', leaf = SET_PALETTE.leaf, leaf2 = SET_PALETTE.leafDark, leaf3 = SET_PALETTE.leafLight, tall = false } = {}) {
  const g = group();
  const ph = size * 0.32;
  const pr = size * 0.17;
  g.add(mesh(cylinder(pr, pr * 0.78, ph, 20), clay(pot), { y: ph / 2 }));
  g.add(mesh(cylinder(pr * 0.92, pr * 0.92, 0.02, 20), clay('#5a4636'), { y: ph - 0.005 }));
  const mats = [clay(leaf), clay(leaf2), clay(leaf3)];
  const blobs = tall
    ? [[0, 0.62, 0, 0.2], [0.09, 0.82, 0.04, 0.17], [-0.08, 0.95, -0.03, 0.16], [0.03, 1.08, 0.02, 0.13], [-0.1, 0.72, 0.08, 0.15]]
    : [[0, 0.55, 0, 0.24], [0.15, 0.62, 0.05, 0.17], [-0.14, 0.66, -0.04, 0.18], [0.02, 0.78, -0.06, 0.17], [-0.05, 0.6, 0.15, 0.15]];
  if (tall) g.add(mesh(cylinder(0.015 * size, 0.02 * size, size * 0.5, 8), clay('#6b5340'), { y: ph + size * 0.22 }));
  blobs.forEach(([x, y, z, r], i) => g.add(mesh(sphere(r * size, 14), mats[i % 3], { x: x * size, y: y * size, z: z * size })));
  return g;
}

/**
 * A chair whose sitter faces +Z. Seat top at `seat`. Styles: 'wood', 'visitor' (with arms), 'office' (swivel).
 */
export function chair({ seat = 0.45, color = '#ffffff', frame = '#3e4248', style = 'wood', back = 0.42 } = {}) {
  const g = group();
  const cm = clay(color);
  const fm = clay(frame);
  const W = style === 'office' ? 0.5 : 0.46;
  const D = 0.44;
  g.add(mesh(rounded(W, 0.07, D, 0.03, 2), cm, { y: seat - 0.035 }));
  if (style === 'office') {
    g.add(mesh(cylinder(0.03, 0.03, seat - 0.12, 10), fm, { y: (seat - 0.12) / 2 + 0.06 }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(rounded(0.3, 0.035, 0.05, 0.015, 1), fm, { x: Math.cos(a) * 0.15, y: 0.06, z: Math.sin(a) * 0.15, ry: -a }));
      g.add(mesh(sphere(0.03, 8), fm, { x: Math.cos(a) * 0.28, y: 0.03, z: Math.sin(a) * 0.28 }));
    }
    g.add(mesh(rounded(W * 0.92, back, 0.07, 0.03, 2), cm, { y: seat + 0.12 + back / 2, z: -D / 2 + 0.02, rx: -0.08 }));
    g.add(mesh(rounded(0.05, 0.22, 0.04, 0.015, 1), fm, { y: seat + 0.08, z: -D / 2 - 0.01 }));
  } else {
    const legH = seat - 0.07;
    const lm = style === 'wood' ? clay(frame) : fm;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.add(mesh(cylinder(0.018, 0.015, legH, 10), lm, { x: x * (W / 2 - 0.04), y: legH / 2, z: z * (D / 2 - 0.04) }));
    }
    // backrest: two posts and a curved rail / padded back
    for (const x of [-1, 1]) g.add(mesh(cylinder(0.016, 0.016, back + 0.02, 8), lm, { x: x * (W / 2 - 0.04), y: seat + back / 2, z: -D / 2 + 0.04 }));
    g.add(mesh(rounded(W - 0.02, style === 'wood' ? 0.1 : back * 0.62, 0.04, 0.018, 2), style === 'wood' ? lm : cm, { y: seat + back - (style === 'wood' ? 0.06 : back * 0.32), z: -D / 2 + 0.04, rx: -0.06 }));
    if (style === 'visitor') {
      for (const x of [-1, 1]) {
        g.add(mesh(rounded(0.05, 0.035, D - 0.06, 0.015, 1), fm, { x: x * (W / 2 + 0.01), y: seat + 0.2, z: 0 }));
        g.add(mesh(cylinder(0.014, 0.014, 0.2, 8), fm, { x: x * (W / 2 + 0.01), y: seat + 0.1, z: D / 2 - 0.08 }));
      }
    }
  }
  return g;
}

/** A row of books standing on a shelf (origin at the left end, bottom). */
export function books(n, colors, { h = 0.24, d = 0.17 } = {}) {
  const g = group();
  let x = 0;
  for (let i = 0; i < n; i++) {
    const t = 0.025 + ((i * 37) % 5) * 0.006;
    const bh = h * (0.82 + ((i * 53) % 7) * 0.03);
    g.add(mesh(rounded(t, bh, d, 0.006, 1), clay(colors[i % colors.length]), { x: x + t / 2, y: bh / 2 }));
    x += t + 0.003;
  }
  g.userData.width = x;
  return g;
}

/** A floor rug (thin rounded slab) with a border stripe. */
export function rug(w, d, color, border) {
  const g = group();
  const m = mesh(rounded(w, 0.012, d, 0.006, 1), clay(color), { y: 0.006 });
  m.castShadow = false;
  g.add(m);
  if (border) {
    const b = mesh(rounded(w - 0.16, 0.004, d - 0.16, 0.002, 1), clay(border), { y: 0.0125 });
    b.castShadow = false;
    g.add(b);
    const inner = mesh(rounded(w - 0.24, 0.004, d - 0.24, 0.002, 1), clay(color), { y: 0.0135 });
    inner.castShadow = false;
    g.add(inner);
  }
  return g;
}

/** A mark: where the hero stands (feet on the floor) and which way they face (radians about Y, 0 = +Z). */
export const mark = (position, facing = 0, extra = {}) => ({ position: r3(position), facing: r3(facing), ...extra });

/** Facing (radians about Y, 0 = +Z) from a point toward a target on the floor. */
export const faceToward = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/** Round numbers so marks and cameras print cleanly. */
export const r3 = (v) => (Array.isArray(v) ? v.map(r3) : Math.round(v * 1000) / 1000);
