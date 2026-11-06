// The story: the hero is one person across the film's scenes. A scene starts where the
// last one ended, holding what they held. When the next scene is somewhere else, the hero
// walks there at the start of the shot; when it is far, the camera cranes over the
// rooftops while they go. After the diagram shots the film returns to the story world with
// a short crane down onto the place.
//
// Everything here is plain data and maths. heroAt(plan, seconds) gives the hero's state
// at any moment of a shot, so a frame drawn twice, in any order, is the same.
import { planWorld, routeLength } from './sets/world.js';
import { span, easeInOut, clamp01, lerp, SCENE_BEAT, SCENE_LEAD } from './timing.js';

export const WALK_SPEED = 1.45; // metres per second, a purposeful walk
export const STEP = 0.7; // metres per step
export const CRANE_OVER = 14; // metres: a longer walk is a crane over the rooftops
export const ARRIVE = 2.6; // seconds: crane down onto the place, back in the story
export const EXIT = 1.3; // seconds: rise and fade when the film leaves the story
export const STAND = 1.0; // seconds to get up from a chair
export const SIT = 1.3; // and to sit down at the end of a walk
const ACCEL = 0.5; // seconds to reach walking speed (and to stop)
const LEAD = 0.06; // a breath before the first beat
const TAIL = 0.92; // and after the last
const HANDS = ['pickUp', 'give', 'place'];

const r3 = (v) => Math.round(v * 1000) / 1000;
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const turnTo = (from, to, k) => from + wrapAngle(to - from) * k;
const smooth = (x) => easeInOut(x);

/** Crane time for a far move. */
export const craneSeconds = (len) => Math.min(8.5, Math.max(5.5, 4.6 + len / 18));

/** A point and heading a distance s along a polyline ([x, z] points). */
export function along(path, cum, s) {
  const n = path.length;
  if (n === 1) return { p: path[0].slice(), dir: [0, 1] };
  s = Math.min(Math.max(s, 0), cum[n - 1]);
  let i = 1;
  while (i < n - 1 && cum[i] < s) i++;
  const a = path[i - 1];
  const b = path[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (s - cum[i - 1]) / seg;
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dir: [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg] };
}
const cumOf = (path) => path.reduce((c, p, i) => (c.push(i ? c[i - 1] + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), c), []);

/** Heading a person faces at distance s along a path: the average direction over the next and last few steps, so corners are taken in a curve. */
function headingAt(path, cum, s) {
  const a = along(path, cum, s - 0.45).p;
  const b = along(path, cum, s + 0.45).p;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return Math.hypot(dx, dz) < 1e-6 ? null : Math.atan2(dx, dz);
}

/**
 * Plan every scene shot of a film.
 * @param {any} sp screenplay
 * @param {{seatBack?: number, world?: any}} [o]
 * @returns {{world: any, shots: Record<number, any>, scenes: Array<{extra: number, beats: number}|null>}}
 */
export function planStory(sp, { seatBack = 0.32, world = null } = {}) {
  world = world || planWorld(sp, { seatBack });
  const shots = {};
  const scenes = sp.explain.map(() => null);
  let last = null; // the last scene's plan, for objects left lying around
  sp.explain.forEach((shot, i) => {
    if (shot.shot !== 'scene') return;
    const place = world.places[shot.set];
    if (!place) return;
    const prev = i > 0 && sp.explain[i - 1].shot === 'scene' ? shots[i - 1] : null;
    const mark = (name) => (name ? world.standAt(place.id, name) : null);
    const firstMark = () => mark(Object.keys(place.marks)[0]) || { position: [place.origin[0], 0, place.origin[1]], facing: 0 };
    let beats = (shot.beats || []).map((b) => ({ ...b }));
    const firstWalk = beats.find((b) => b.do === 'walk' || b.do === 'sit');
    const startMark = mark(shot.at) || (firstWalk ? null : mark(beats.find((b) => b.at)?.at)) || firstMark();

    // what the hero holds when the beats begin: the first object they don't pick up from a spot
    let holding = null;
    for (const b of beats) {
      if (!b.object || holding === b.object) continue;
      if (b.do === 'pickUp' && place.spots[b.from]) continue;
      holding = b.object;
      break;
    }

    const transit = { kind: 'arrive', seconds: ARRIVE, path: null, len: 0 };
    let start = { pos: [startMark.position[0], startMark.position[2]], facing: startMark.facing, seated: !!shot.seated };
    if (prev) {
      const from = prev.end;
      // walking on to the shot's first mark: the walk to it is the journey itself
      let target = startMark;
      const lead = beats[0]?.do === 'walk' ? mark(beats[0].to) : null;
      if (lead) target = lead;
      const path = world.route(from.pos, [target.position[0], target.position[2]]);
      const len = routeLength(path);
      const sitAtEnd = !!shot.seated && !!target.seat && !lead;
      if (len < 0.25 && !from.seated) {
        const turn = Math.abs(wrapAngle(target.facing - from.facing)) > 0.2;
        Object.assign(transit, { kind: turn ? 'turn' : 'none', seconds: turn ? 0.9 : 0 });
        start = { pos: from.pos.slice(), facing: target.facing, seated: from.seated || sitAtEnd };
      } else {
        const kind = len > CRANE_OVER ? 'crane' : 'walk';
        const walkTime = len / WALK_SPEED + ACCEL;
        const seconds = kind === 'crane' ? craneSeconds(len) : (from.seated ? STAND : 0) + walkTime + (sitAtEnd ? SIT : 0);
        Object.assign(transit, { kind, seconds, path, cum: cumOf(path), len, standUp: from.seated, sitAtEnd });
        if (lead) beats = beats.slice(1);
        start = { pos: path.at(-1).slice(), facing: target.facing, seated: sitAtEnd };
      }
      Object.assign(transit, { from: { ...from }, holdFrom: from.holding, holdTo: holding });
    }

    // objects left lying from earlier scenes stay where they were put
    const used = new Set(beats.map((b) => b.object).filter(Boolean));
    const carried = {};
    // (a thing given away, into a post box or to a person, has gone)
    for (const [obj, r] of Object.entries(last?.restEnd || {})) if (!r.given && !used.has(obj) && obj !== holding && obj !== transit.holdFrom) carried[obj] = r;

    const next = sp.explain[i + 1];
    const plan = {
      index: i,
      place: place.id,
      size: shot.camera || 'medium',
      feel: shot.feel || 'neutral',
      with: shot.with || null,
      beats,
      start: { ...start, holding },
      transit,
      carried,
      exit: !next || next.shot !== 'scene' || !world.places[next.set],
      nurse: shot.with === 'nurse' ? nurseSpot(place, startMark, seatBack) : null,
      mark,
      spots: place.spots,
    };
    // where the hero ends, and what they leave lying
    const end = beatState(plan, 1);
    plan.end = { pos: end.pos, facing: end.facing, seated: end.seated, holding: end.holding, feel: end.feel, place: place.id };
    plan.restEnd = { ...carried, ...end.rest };
    scenes[i] = { extra: transit.seconds + (plan.exit ? EXIT * 0.5 : 0), beats: Math.max(1, beats.length) };
    shots[i] = plan;
    last = plan;
  });
  return { world, shots, scenes };
}

/** Where the second person in a scene sits or stands. */
function nurseSpot(place, startMark, seatBack) {
  const m = place.marks.nurse || place.marks.host || place.marks.entrance || Object.values(place.marks).at(-1);
  // a seated mark is the seat itself: the nurse sits back onto it from just in front
  const sit = m.pose === 'sit' || !!m.seat;
  const back = sit ? seatBack : 0;
  let facing = m.facing;
  if (!place.marks.nurse && !place.marks.host) facing = Math.atan2(startMark.position[0] - m.position[0], startMark.position[2] - m.position[2]);
  return { position: [r3(m.position[0] + Math.sin(facing) * back), 0, r3(m.position[2] + Math.cos(facing) * back)], facing, sitting: sit };
}

/** Seconds the transit takes, and the beats after it, within a shot of `duration` seconds. */
export function shotSpans(plan, duration) {
  const T = Math.min(plan.transit.seconds, duration * 0.8);
  return { T, beats: Math.max(0.5, duration - T) };
}

/**
 * The hero at `sec` seconds into a shot lasting `duration`.
 * @returns {any} {pos:[x,z], facing, action, k, opts, holding, scale, rest, flying, reach, feel, seated, walking, heading}
 */
export function heroAt(plan, sec, duration) {
  const { T, beats } = shotSpans(plan, duration);
  if (sec < T && plan.transit.kind !== 'none') return transitState(plan, sec, T);
  return beatState(plan, clamp01((sec - T) / beats));
}

/** Distance walked after `s` seconds of a walk of `len` metres lasting `W` seconds: speed up, cruise, slow down. */
function walked(s, W, len) {
  const ta = Math.min(ACCEL, W / 2);
  const v = len / Math.max(W - ta, 1e-3);
  if (s <= 0) return 0;
  if (s >= W) return len;
  if (s < ta) return (v * s * s) / (2 * ta);
  if (s > W - ta) return len - (v * (W - s) * (W - s)) / (2 * ta);
  return v * (s - ta / 2);
}

function transitState(plan, s, T) {
  const tr = plan.transit;
  const base = { feel: plan.transit.from?.feel || plan.feel, rest: { ...plan.carried }, flying: null, reach: null, scale: {} };
  if (tr.kind === 'arrive') {
    return { ...base, feel: plan.feel, pos: plan.start.pos, facing: plan.start.facing, action: plan.start.seated ? 'sit' : 'idle', k: plan.start.seated ? 1 : (s / T) * 0.4, opts: {}, holding: plan.start.holding, seated: plan.start.seated, walking: 0, heading: plan.start.facing };
  }
  const from = tr.from;
  // the old object leaves the hand and the new one arrives, out of the way of the story
  const swap = tr.holdFrom !== tr.holdTo;
  const holdingAt = (k) => (!swap ? tr.holdTo : k < 0.5 ? tr.holdFrom : tr.holdTo);
  if (tr.kind === 'turn') {
    const k = smooth(s / T);
    return { ...base, pos: from.pos, facing: turnTo(from.facing, plan.start.facing, k), action: from.seated ? 'sit' : 'idle', k: from.seated ? 1 : k * 0.3, opts: {}, holding: from.holding, seated: from.seated, walking: 0, heading: plan.start.facing };
  }
  const stand = tr.standUp ? (tr.kind === 'crane' ? Math.min(STAND, T * 0.15) : STAND) : 0;
  const sitT = tr.sitAtEnd ? SIT : 0;
  if (s < stand) {
    return { ...base, pos: from.pos, facing: from.facing, action: 'sit', k: 1 - smooth(s / stand), opts: {}, holding: from.holding, seated: false, walking: 0, heading: from.facing, prev: { action: 'sit', k: 1, opts: {} } };
  }
  const W = T - stand - sitT;
  const tw = s - stand;
  let d;
  let scaleK;
  if (tr.kind === 'crane') {
    // walk at a normal pace while the camera rises and while it comes down; the middle of
    // the journey happens while we look at the street from above
    const v = WALK_SPEED;
    const a = Math.min(v * W * 0.3, tr.len * 0.35);
    const b = Math.min(v * W * 0.5, tr.len * 0.45); // the arrival is in view as the camera comes down
    const t1 = a / v;
    const t2 = W - b / v;
    if (tw < t1) d = v * tw;
    else if (tw < t2) d = a + ((tw - t1) / Math.max(t2 - t1, 1e-3)) * (tr.len - a - b);
    else {
      // the last steps at walking pace, slowing to a stop on the mark
      const D = W - t2;
      const ta = Math.min(ACCEL, D / 2);
      const v2 = b / Math.max(D - ta / 2, 1e-3);
      const x = tw - t2;
      d = tr.len - b + (x < D - ta ? v2 * x : b - (v2 * (D - x) * (D - x)) / (2 * ta));
    }
    scaleK = tw / W < 0.5 ? 0 : 1;
  } else {
    d = walked(tw, W, tr.len);
    scaleK = clamp01((d - 0.3) / 1.2);
  }
  if (s >= T - sitT && sitT) {
    const k = smooth((s - (T - sitT)) / sitT);
    return { ...base, pos: plan.start.pos, facing: plan.start.facing, action: 'sit', k, opts: {}, holding: tr.holdTo, seated: false, walking: 0, heading: plan.start.facing, prev: { action: 'walk', k: 1, opts: {} } };
  }
  const { p } = along(tr.path, tr.cum, d);
  const head = headingAt(tr.path, tr.cum, d) ?? from.facing;
  // turn from where they faced into the walk, and at the end to face what is there
  let facing = turnTo(from.facing, head, smooth(d / 0.6));
  facing = turnTo(facing, plan.start.facing, smooth((d - (tr.len - 0.45)) / 0.45));
  const scale = {};
  if (swap) {
    if (tr.holdFrom) scale[tr.holdFrom] = tr.kind === 'crane' ? 1 : 1 - smooth(scaleK * 2);
    if (tr.holdTo) scale[tr.holdTo] = tr.kind === 'crane' ? 1 : smooth(scaleK * 2 - 1);
  }
  const speed = Math.min(1, (walked(tw + 0.05, W, tr.len) - walked(tw - 0.05, W, tr.len)) / 0.1 / WALK_SPEED);
  return {
    ...base,
    pos: p,
    facing,
    action: 'walk',
    k: d / Math.max(tr.len, 1e-3),
    opts: { cycles: Math.max(1, Math.round(tr.len / STEP)), distance: tr.len }, // distance: k = d / len, so the planted foot stays put
    holding: holdingAt(scaleK),
    scale,
    seated: false,
    walking: tr.kind === 'crane' ? 1 : speed,
    heading: head,
  };
}

/** The beats, replayed up to progress u (0..1), as in the original single-set director. */
export function beatState(plan, u) {
  const beats = plan.beats;
  const spots = plan.spots;
  const mark = plan.mark;
  const pos = plan.start.pos.slice();
  let facing = plan.start.facing;
  let holding = plan.start.holding;
  let seated = plan.start.seated;
  let feel = plan.feel;
  const rest = { ...plan.carried };
  for (const b of beats) {
    if (b.object && b.do === 'pickUp' && spots[b.from] && !(b.object in rest) && holding !== b.object) rest[b.object] = { at: spots[b.from] };
  }
  const n = Math.max(1, beats.length);
  const v = span(u, LEAD, TAIL) * n;
  const cur = Math.min(n - 1, Math.floor(v));
  let action = 'idle';
  let p = u;
  let opts = {};
  let flying = null;
  let reach = null;
  let walking = 0;
  let heading = facing;
  let prev = plan.transit.kind === 'walk' || plan.transit.kind === 'crane' ? { action: 'walk', k: 1, opts: {} } : { action: 'idle', k: 0, opts: {} };
  let blend = 1;
  for (let i = 0; i <= cur && i < beats.length; i++) {
    const b = beats[i];
    const k = i < cur ? 1 : clamp01(v - i);
    if (i > 0) prev = { action, k: 1, opts };
    blend = smooth(span(k, 0, 0.18));
    if (b.feel) feel = b.feel;
    action = b.do;
    p = k;
    opts = { sitting: seated };
    walking = 0;
    if (b.do === 'walk') {
      const m = mark(b.to);
      if (!m) continue;
      const to = [m.position[0], m.position[2]];
      const dist = Math.hypot(to[0] - pos[0], to[1] - pos[1]);
      heading = Math.atan2(to[0] - pos[0], to[1] - pos[1]);
      // turn toward the goal, walk, then turn to face what is there
      if (dist > 0.05) {
        const turn = smooth(span(k, 0, 0.15));
        const go = smooth(span(k, 0.12, 0.88));
        const settle = smooth(span(k, 0.85, 1));
        facing = turnTo(turnTo(facing, heading, turn), m.facing, settle);
        pos[0] = lerp(pos[0], to[0], go);
        pos[1] = lerp(pos[1], to[1], go);
        opts = { cycles: Math.max(1, Math.round(dist / STEP)), distance: dist };
        p = go; // the body has covered dist * go, so the feet step exactly that far
        walking = k > 0.12 && k < 0.88 ? 1 : 0;
        if (k >= 1) {
          pos[0] = to[0];
          pos[1] = to[1];
        }
      } else facing = turnTo(facing, m.facing, smooth(k));
      seated = false;
    } else if (b.do === 'sit') {
      const m = mark(b.at);
      if (m) {
        pos[0] = m.position[0];
        pos[1] = m.position[2];
        facing = m.facing;
      }
      if (k >= 1) seated = true;
    } else if (b.do === 'pickUp') {
      if (i === cur && spots[b.from]) reach = spots[b.from];
      if (k >= 0.5 && b.object) {
        holding = b.object;
        delete rest[b.object];
      }
    } else if (b.do === 'give' || b.do === 'place') {
      const obj = b.object || holding;
      const spot = spots[b.to];
      if (i === cur && spot) reach = spot;
      if (k >= 0.5 && obj && holding === obj) {
        holding = null;
        if (spot) {
          rest[obj] = { at: spot, given: b.do === 'give' };
          if (i === cur && k < 0.8) flying = { obj, k: span(k, 0.5, 0.8), spot };
        }
      }
    }
  }
  if (u >= TAIL && beats.length) p = 1;
  if (seated && !['sit', 'talk', 'listen', 'read'].includes(action)) {
    action = 'sit'; // a seated hero who reacts stays in the chair
    p = 1;
  }
  if (seated && action !== 'sit') opts = { ...opts, sitting: true };
  if (!HANDS.includes(action)) reach = null;
  return { pos, facing, action, k: p, opts: { ...opts, prev, blend }, holding, scale: {}, rest, flying, reach, feel, seated, walking, heading };
}

/** Length of all the walking in a film's story, for tests and notes. */
export const storyWalk = (story) => Object.values(story.shots).reduce((s, p) => s + (p.transit.len || 0), 0);
export { routeLength };
