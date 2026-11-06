// The story camera, a Steadicam on the hero. It frames them at the shot's size from the
// open side of the room, leads a little as they walk, settles when they stop, and looks
// at what their hands are doing. For far moves it cranes up over the rooftops and down
// onto the new place.
//
// Everything is a pure function of film time: the lag is an average of where the camera
// wants to be over the last moments (never state carried from frame to frame), so any
// frame can be drawn on its own, in any order, and comes out the same.
import { lerp, easeInOut, easeOut, clamp01 } from './timing.js';

/** How far from the hero, and how high we aim, for each shot size. */
export const FRAMING = {
  close: { dist: 2.5, y: 1.32 },
  medium: { dist: 4.5, y: 1.08 },
  wide: { dist: 7.4, y: 1.0 },
};
export const LAG = 1.4; // seconds the camera trails the hero by, at most
const SAMPLES = 12;
const ACTING = ['pickUp', 'give', 'place', 'read'];

const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map((v) => v * k);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Where the camera wants to be for a hero state.
 * @param {any} h hero state from story.heroAt
 * @param {any} plan the shot's plan
 * @param {any} world the world plan (for which way to look from here)
 */
export function desired(h, plan, world) {
  const size = FRAMING[plan.size] ? plan.size : 'medium';
  const F = FRAMING[size];
  const view = world.viewAt(h.pos)[size] || world.viewAt(h.pos).medium;
  const sitting = h.seated || (h.action === 'sit' && h.k > 0.5);
  let focus = [h.pos[0], sitting ? F.y - 0.36 : F.y, h.pos[1]];
  // lead the walk: aim a little ahead of where they're going
  const lead = 0.75 * (h.walking || 0);
  focus[0] += Math.sin(h.heading) * lead;
  focus[2] += Math.cos(h.heading) * lead;
  // look at what the hands are doing
  if (h.reach && ACTING.includes(h.action)) focus = focus.map((v, i) => lerp(v, h.reach[i], 0.35));
  else if (h.action === 'read') focus[1] -= 0.08;
  let dist = F.dist;
  let az = view.az;
  if (plan.nurse) {
    // keep the second person in the frame: aim between them, stand back enough for both,
    // and look across the line between them (on the room's side), so neither hides the other
    const n = plan.nurse.position;
    const nf = [n[0], plan.nurse.sitting ? F.y - 0.36 : F.y, n[2]];
    const sep = Math.hypot(n[0] - h.pos[0], n[2] - h.pos[1]);
    focus = focus.map((v, i) => (v + nf[i]) / 2);
    dist = Math.max(dist, sep * 1.7 + 1.2);
    const across = Math.atan2(n[2] - h.pos[1], -(n[0] - h.pos[0]));
    const side = Math.cos(across - view.az) >= 0 ? across : across + Math.PI;
    // but never far from the place's own view, so the building or room stays behind them
    az = view.az + Math.max(-0.4, Math.min(0.4, wrap(side + wrap(view.az - side) * 0.3 - view.az)));
  }
  const el = Math.max(0.05, view.el);
  const dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  return { position: add(focus, scale(dir, dist)), target: focus };
}

/**
 * The follow camera at time t: an average of where it wanted to be over the last LAG
 * seconds, weighted toward now, so it trails the hero and eases into each new frame.
 * @param {(t: number) => {position: number[], target: number[]}} want desired pose at any time
 */
export function follow(want, t) {
  const pos = [0, 0, 0];
  const tgt = [0, 0, 0];
  let wsum = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1);
    const w = (1 - u) ** 1.6 + 0.02;
    const d = want(t - u * LAG);
    for (let k = 0; k < 3; k++) {
      pos[k] += d.position[k] * w;
      tgt[k] += d.target[k] * w;
    }
    wsum += w;
  }
  return { position: scale(pos, 1 / wsum), target: scale(tgt, 1 / wsum) };
}

const bezier = (p0, p1, p2, p3, u) => {
  const a = (1 - u) ** 3;
  const b = 3 * (1 - u) ** 2 * u;
  const c = 3 * (1 - u) * u * u;
  const d = u ** 3;
  return p0.map((_, i) => a * p0[i] + b * p1[i] + c * p2[i] + d * p3[i]);
};

/** Bezier position at arc-length fraction s (0..1), so the move has an even pace. */
function evenBezier(p, s) {
  const N = 48;
  const pts = [];
  const cum = [0];
  for (let i = 0; i <= N; i++) {
    pts.push(bezier(p[0], p[1], p[2], p[3], i / N));
    if (i) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  }
  const target = s * cum[N];
  let i = 1;
  while (i < N && cum[i] < target) i++;
  const k = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return { u: (i - 1 + k) / N, point: pts[i - 1].map((v, j) => lerp(v, pts[i][j], k)) };
}

const flat = (p) => [p[0], 0, p[2]];
function horiz(pose) {
  const d = sub(pose.position, pose.target);
  const l = Math.hypot(d[0], d[2]) || 1;
  return [d[0] / l, 0, d[2] / l];
}

/**
 * A crane from one place to another: straight up over the rooftops, along the street
 * high enough to see where we are going, and straight down onto the new place. The camera
 * only moves sideways once it is above the roofs, so it never brushes a building.
 * @param {number} k progress 0..1
 */
export function crane(k, from, to) {
  const g0 = flat(from.target);
  const g1 = flat(to.target);
  const far = len(sub(g1, g0));
  const H = Math.min(28, Math.max(15, 13 + far * 0.25));
  const up = easeInOut(span01(k, 0, 0.38));
  const down = easeInOut(span01(k, 0.62, 1));
  const glide = easeInOut(span01(k, 0.2, 0.8));
  // draw back as we rise, for a high three-quarter view of the street
  const d0 = horiz(from);
  const d1 = horiz(to);
  const dir = add(scale(d0, 1 - glide), scale(d1, glide));
  const dl = Math.hypot(dir[0], dir[2]) || 1;
  const pull = H * 0.75 * Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
  const y = from.position[1] + (H - from.position[1]) * up - (H - to.position[1]) * down;
  const position = [lerp(from.position[0], to.position[0], glide) + (dir[0] / dl) * pull, y, lerp(from.position[2], to.position[2], glide) + (dir[2] / dl) * pull];
  const ty = from.target[1] + (0.3 - from.target[1]) * up - (0.3 - to.target[1]) * down;
  const target = [lerp(from.target[0], to.target[0], glide), ty, lerp(from.target[2], to.target[2], glide)];
  return { position, target };
}
const span01 = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));

/**
 * Back in the story: come down onto the place from a high view of the street, or from
 * the place's own establishing view (a building's front, seen from across the road).
 */
export function arrive(k, to, establish = null) {
  if (establish) {
    const e = easeInOut(k);
    const mid = add(to.position, [0, 1.2, 0]);
    return { position: bezier(establish.position, mid, mid, to.position, e), target: bezier(establish.target, establish.target, to.target, to.target, e) };
  }
  const g = flat(to.target);
  const H = 11;
  const dir = horiz(to);
  const high = add(add(g, scale(dir, H * 1.05)), [0, H, 0]);
  const near = add(to.position, add(scale(dir, 1.8), [0, 2.2, 0]));
  const e = easeOut(k * 0.9 + 0.1 * easeInOut(k));
  const position = bezier(high, add(high, [0, -H * 0.45, 0]), near, to.position, e);
  const target = bezier(add(g, [0, 0.4, 0]), to.target, to.target, to.target, e);
  return { position, target };
}

/** Leaving the story: the camera lifts and draws back as the picture fades. */
export function rise(pose, k) {
  const e = easeInOut(k);
  const back = horiz(pose);
  return {
    position: add(pose.position, add(scale(back, 1.6 * e), [0, 1.5 * e, 0])),
    target: add(pose.target, [0, 0.25 * e, 0]),
  };
}

/** Is the straight line from a to b blocked by an axis-aligned box ({min, max} of [x, y, z])? */
export function blocks(a, b, min, max, pad = 0) {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    const lo = min[i] - pad;
    const hi = max[i] + pad;
    if (Math.abs(d) < 1e-9) {
      if (a[i] < lo || a[i] > hi) return false;
      continue;
    }
    let ta = (lo - a[i]) / d;
    let tb = (hi - a[i]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

export const mixPose = (a, b, k) => ({ position: a.position.map((v, i) => lerp(v, b.position[i], k)), target: a.target.map((v, i) => lerp(v, b.target[i], k)) });
export { clamp01 };
