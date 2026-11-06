// The story: the hero is one person across the film's scenes. A scene starts where the
// last one ended, holding what they held. When the next scene is somewhere else, the hero
// walks there at the start of the shot; when it is far, the camera cranes over the
// rooftops while they go. After the diagram shots the film returns to the story world with
// a short crane down onto the place.
//
// Everything here is plain data and maths. heroAt(plan, seconds) gives the hero's state
// at any moment of a shot, so a frame drawn twice, in any order, is the same.
import { planWorld, routeLength } from './sets/world.js';
import { span, easeInOut, clamp01, lerp, SCENE_BEAT, SCENE_LEAD, READ_WPS } from './timing.js';

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
const words = (x = '') => x.trim().split(/\s+/).filter(Boolean).length;
/** A beat with its own subtitle lasts long enough to read it (in units of SCENE_BEAT). */
export const beatWeight = (b) => Math.max(1, b.caption ? (words(b.caption) / READ_WPS + 1.4) / SCENE_BEAT : 1);
/** Which beat is playing at beat progress u (0..1), and how far through it (k). */
export function beatAt(plan, u) {
  const w = plan.weights;
  const n = Math.max(1, w.length);
  const x = span(u, LEAD, TAIL) * plan.weightSum;
  let cur = 0;
  while (cur < n - 1 && x >= plan.cum[cur + 1]) cur++;
  return { cur, k: clamp01((x - plan.cum[cur]) / (w[cur] || 1)) };
}

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
        if (lead) {
          transit.caption = beats[0].caption || null; // the walk's own subtitle plays during the journey
          beats = beats.slice(1);
        }
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
      feel: shot.feel || (prev ? prev.end.feel : 'neutral'), // a feeling carries on into the next scene unless the shot changes it
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
    // each beat's share of the scene: one SCENE_BEAT, or longer when it has a subtitle to read
    plan.weights = beats.length ? beats.map(beatWeight) : [1];
    plan.cum = plan.weights.reduce((c, w) => [...c, c.at(-1) + w], [0]);
    plan.weightSum = plan.cum.at(-1);
    // where the hero ends, and what they leave lying
    const end = beatState(plan, 1);
    const { prev: _p, blend: _b, ...endOpts } = end.opts || {};
    plan.end = { pos: end.pos, facing: end.facing, seated: end.seated, holding: end.holding, feel: end.feel, place: place.id, action: end.action, k: end.k, opts: endOpts };
    plan.restEnd = { ...carried, ...end.rest };
    scenes[i] = { extra: transit.seconds + (plan.exit ? EXIT * 0.5 : 0), beats: Math.max(1, plan.weightSum) };
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

/**
 * The subtitle at `sec` seconds into a scene shot. A beat (or the walk that opens the shot)
 * can carry its own subtitle, so each step reads as it happens; otherwise the shot's caption.
 * @returns {{text: string, alpha: number, own: boolean}}
 */
export function captionAt(plan, sec, duration, shotCaption) {
  const { T, beats } = shotSpans(plan, duration);
  const fade = (k, a, b) => smooth(span(k, 0, a)) * (1 - smooth(span(k, 1 - b, 1)));
  if (sec < T && plan.transit.kind !== 'none') {
    if (plan.transit.caption) return { text: plan.transit.caption, alpha: fade(sec / T, 0.15, 0.08), own: true };
    return { text: shotCaption, alpha: 1, own: false };
  }
  const { cur, k } = beatAt(plan, clamp01((sec - T) / beats));
  const b = plan.beats[cur];
  if (b?.caption) return { text: b.caption, alpha: fade(k, 0.12, 0.08), own: true };
  // the shot's caption between steps that have their own: fade it in after one, and out before one
  const before = cur > 0 ? !!plan.beats[cur - 1].caption : !!plan.transit.caption && plan.transit.kind !== 'none';
  const after = !!plan.beats[cur + 1]?.caption;
  if (before || after) return { text: shotCaption, alpha: (before ? smooth(span(k, 0, 0.12)) : 1) * (after ? 1 - smooth(span(k, 0.92, 1)) : 1), own: true };
  return { text: shotCaption, alpha: 1, own: false };
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
    // distance: k = d / len, so the planted foot stays put; and the first steps grow out of the
    // pose the last scene ended in (reading, holding), never snapping from it
    opts: { cycles: Math.max(1, Math.round(tr.len / STEP)), distance: tr.len, ...(!tr.standUp && from.action && from.action !== 'walk' ? { prev: { action: from.action, k: from.k, opts: from.opts || {}, feel: from.feel }, blend: smooth(clamp01(s / 0.6)) } : {}) },
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
  const at = beatAt(plan, u);
  const cur = at.cur;
  const v = cur + at.k;
  let size = plan.size;
  let action = 'idle';
  let p = u;
  let opts = {};
  let flying = null;
  let reach = null;
  let walking = 0;
  let heading = facing;
  // the first beat blends from how the journey left the hero: seated, walking, or standing
  const tr = plan.transit;
  const journeyFeel = tr.kind === 'arrive' || !tr.from ? plan.feel : tr.from.feel || plan.feel;
  const cameWalking = tr.kind === 'walk' || tr.kind === 'crane';
  let prev = plan.start.seated
    ? { action: 'sit', k: 1, opts: {}, feel: journeyFeel }
    : cameWalking
      ? { action: 'walk', k: 1, opts: { cycles: Math.max(1, Math.round(tr.len / STEP)), distance: tr.len }, feel: journeyFeel }
      : { action: 'idle', k: 0, opts: {}, feel: journeyFeel };
  let blend = 1;
  for (let i = 0; i <= cur && i < beats.length; i++) {
    const b = beats[i];
    const k = i < cur ? 1 : clamp01(v - i);
    if (i > 0) prev = { action, k: 1, opts, feel }; // the feel too, so a change of heart eases in
    blend = smooth(span(k, 0, 0.18));
    if (b.feel) feel = b.feel;
    size = b.camera || plan.size; // a beat can ask for its own framing, such as a detail of the hands
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
        walking = Math.sin(Math.PI * span(k, 0.12, 0.88)); // eases up and down with the walk, so the camera's lead never jumps
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
    } else if (b.do === 'use') {
      // working with the thing in hand, in front of the body (at the counter, the hero already faces it)
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
  // how much the camera looks toward the hands: in at the start of the beat, out at its end,
  // so the frame never jumps when the beat changes
  const kk = clamp01(v - cur);
  const reachW = reach ? smooth(span(kk, 0, 0.3)) * (1 - smooth(span(kk, 0.75, 1))) : 0;
  // a change of framing between beats is a camera move, not a cut: blend from the last framing
  const prevSize = cur > 0 ? beats[cur - 1].camera || plan.size : plan.size;
  const sizeK = prevSize === size ? 1 : smooth(span(kk, 0, 0.6)); // a slow, deliberate move in to the hands
  return { pos, facing, action, k: p, opts: { ...opts, prev, blend }, holding, scale: {}, rest, flying, reach, reachW, feel, seated, walking, heading, size, prevSize, sizeK, beat: cur };
}

/** Length of all the walking in a film's story, for tests and notes. */
export const storyWalk = (story) => Object.values(story.shots).reduce((s, p) => s + (p.transit.len || 0), 0);
export { routeLength };
