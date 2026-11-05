// Shot timing. Every shot lasts as long as its caption takes to read, plus a hold.
// Pure and deterministic: the same screenplay always gives the same timeline.

export const READ_WPS = 2.6; // calm reading pace, words per second
export const HOLD = 1.6; // seconds to sit with an idea after reading it
export const MIN_SHOT = 3.5;
export const TURN_EXTRA = 1.5; // the turning point gets more room
export const VOICE_PAD = 0.8;
export const SIM_DEMO = 16; // scripted "your turn" segment in the film
export const FOLLOW_MIN = 5.5; // a tracking shot needs room to travel
export const TIMELAPSE_EXTRA = 2.5; // the clock needs time to run
export const DECIDE = 10;
export const TRAVEL = 0.45; // share of a shot the camera spends moving to its new setup

const words = (s = '') => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * @param {{shot: string, caption: string}} shot
 * @param {number} [voiceSeconds] length of a narrated clip for this caption, if any
 */
export function shotDuration(shot, voiceSeconds = 0) {
  let d = Math.max(MIN_SHOT, words(shot.caption) / READ_WPS + HOLD);
  if (voiceSeconds) d = Math.max(d, voiceSeconds + VOICE_PAD);
  if (shot.shot === 'turn') d += TURN_EXTRA;
  if (shot.shot === 'follow') d = Math.max(d, FOLLOW_MIN);
  if (shot.shot === 'timelapse') d += TIMELAPSE_EXTRA;
  return d;
}

/**
 * @param {any} sp screenplay
 * @param {{voice?: number[]}} [opts] per-shot narration lengths
 */
export function buildTimeline(sp, opts = {}) {
  const segments = [];
  let t = 0;
  sp.explain.forEach((shot, index) => {
    const d = shotDuration(shot, opts.voice?.[index]);
    segments.push({ act: 'explain', index, shot: shot.shot, start: t, end: t + d });
    t += d;
  });
  const explainEnd = t;
  segments.push({ act: 'simulate', index: segments.length, shot: 'simulate', start: t, end: t + SIM_DEMO });
  t += SIM_DEMO;
  segments.push({ act: 'decide', index: segments.length, shot: 'decide', start: t, end: t + DECIDE });
  t += DECIDE;
  segments.forEach((s, i) => (s.index = i));
  return { segments, explainEnd, total: t };
}

/** Which segment is on screen at time t, and how far through it (0..1). */
export function stateAt(tl, t) {
  const segs = tl.segments;
  const clamped = Math.min(Math.max(t, 0), tl.total);
  let i = segs.findIndex((s) => clamped < s.end);
  if (i === -1) i = segs.length - 1;
  const s = segs[i];
  const local = Math.min(1, Math.max(0, (clamped - s.start) / (s.end - s.start)));
  return { index: i, segment: s, local, time: clamped };
}

// ---- easing: one shared set, used everywhere
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const easeInOut = (x) => {
  x = clamp01(x);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
export const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;
/** Small wind-up before the move, then a soft settle. */
export const anticipate = (x) => {
  x = clamp01(x);
  const back = 1.2;
  return x * x * ((back + 1) * x - back);
};
/** 0 → 1 → 0 bump for highlights. */
export const bump = (x) => Math.sin(Math.PI * clamp01(x));
/** Map x from [a,b] to 0..1. */
export const span = (x, a, b) => clamp01((x - a) / (b - a));
export const lerp = (a, b, t) => a + (b - a) * t;
