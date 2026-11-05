// The director: wires screenplay → model → cast → stage → camera → overlay.
// renderAt(t) is a pure function of time in film mode, so playback, scrubbing
// and recording always show exactly the same frame for the same t.
import * as THREE from './vendor/three/three.module.js';
import { validate } from './schema.js';
import { createModel, normalise, formatValue } from './model.js';
import { parse, refs } from './formula.js';
import { buildTimeline, stateAt, easeInOut, span, lerp, bump, TRAVEL } from './timing.js';
import { layoutCast } from './layout.js';
import { cameraSetups, poseAt } from './camera.js';
import { createStage, toScreen } from './stage.js';
import { createFlow } from './flow.js';
import { resolveActor } from './cast/resolve.js';
import * as overlay from './overlay.js';
import { createUI, showErrors } from './ui.js';
import { scheduleScore } from './score.js';
import { speakBrowser, stopBrowser, decodeClips } from './voice.js';
import { recordFilm } from './record.js';

const GREY = new THREE.Color('#e4dccf');

/**
 * Mount a screenplay into an element.
 * @param {HTMLElement} root
 * @param {any} sp screenplay
 * @param {{cast?: 'auto'|'studio'|'open'|'custom', voice?: 'off'|'browser'|'clips', voiceClips?: string[], interactive?: boolean, autoplay?: boolean, music?: boolean}} [options]
 */
export function mount(root, sp, options = {}) {
  const errors = validate(sp);
  if (errors.length) {
    showErrors(root, errors);
    return { errors, ready: Promise.resolve(null) };
  }
  const api = { errors: [] };
  api.ready = start(root, sp, options, api).catch((e) => {
    console.error(e);
    showErrors(root, [String(e.message || e)]);
    throw e;
  });
  return api;
}

/** Sweep an input: default → low → high → default, eased. */
function sweep(p, def, lo, hi) {
  if (p < 0.25) return lerp(def, lo, easeInOut(p / 0.25));
  if (p < 0.75) return lerp(lo, hi, easeInOut((p - 0.25) / 0.5));
  return lerp(hi, def, easeInOut((p - 0.75) / 0.25));
}

async function start(root, sp, options, api) {
  const opts = { cast: 'auto', voice: 'off', interactive: true, autoplay: false, music: true, ...options };
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

  // ---- model
  const model = createModel(sp.model);
  const ranges = model.ranges();
  const defaults = model.defaults();
  const inputsById = Object.fromEntries(sp.model.inputs.map((i) => [i.id, i]));
  const castById = Object.fromEntries(sp.cast.map((c) => [c.id, c]));

  // which inputs each value depends on (for choosing what a shot "drives")
  const formulaOf = Object.fromEntries([...(sp.model.derived || []), ...sp.model.outputs].map((d) => [d.id, d.formula]));
  const depsCache = {};
  const inputDeps = (id) => {
    if (depsCache[id]) return depsCache[id];
    if (inputsById[id]) return (depsCache[id] = [id]);
    if (!formulaOf[id]) return (depsCache[id] = []);
    const out = new Set();
    for (const r of refs(parse(formulaOf[id]))) inputDeps(r).forEach((x) => out.add(x));
    return (depsCache[id] = [...out]);
  };
  const driveFor = (shot) => {
    if (shot.drive) return shot.drive;
    if (['establish', 'handoff'].includes(shot.shot)) return null;
    const plays = castById[shot.focus]?.plays;
    if (!plays) return null;
    if (inputsById[plays]) return plays;
    const deps = inputDeps(plays);
    return deps.find((d) => inputsById[d].kind === 'lever') || deps[0] || null;
  };

  // ---- voice clips decide shot lengths when present
  let clips = [];
  if (opts.voice === 'clips' && opts.voiceClips?.length) {
    const decodeCtx = new OfflineAudioContext(1, 1, 48000);
    clips = await decodeClips(decodeCtx, opts.voiceClips);
  }
  const tl = buildTimeline(sp, { voice: clips.map((c) => c?.duration || 0) });
  const layout = layoutCast(sp.cast);
  let setups = cameraSetups(tl, sp, layout);
  const simIndex = tl.segments.findIndex((s) => s.act === 'simulate');
  const decideIndex = tl.segments.length - 1;

  // ---- DOM + stage
  const wrap = document.createElement('div');
  wrap.className = 'esd';
  const c3 = document.createElement('canvas');
  const c2 = document.createElement('canvas');
  c3.setAttribute('aria-hidden', 'true');
  c2.setAttribute('role', 'img');
  c2.setAttribute('aria-label', sp.question);
  wrap.append(c3, c2);
  root.replaceChildren(wrap);
  const stage = createStage(c3);
  const ctx2 = c2.getContext('2d');
  const flow = createFlow(stage.scene);

  // ---- cast
  const actors = {};
  await Promise.all(
    sp.cast.map(async (entry, n) => {
      const actor = await resolveActor(entry, opts.cast, n);
      const p = layout[entry.id];
      actor.object.position.set(p.x, 0.06, p.z);
      actor.object.rotation.y = p.rotY;
      stage.scene.add(actor.object);
      stage.addMark(p.x, p.z);
      const mats = new Map();
      actor.object.traverse((o) => {
        if (o.isMesh) {
          const list = Array.isArray(o.material) ? o.material : [o.material];
          list.forEach((m) => m?.color && !mats.has(m) && mats.set(m, m.color.clone()));
        }
      });
      actor.mats = mats;
      actor.entry = entry;
      actor.emphasis = 1;
      actors[entry.id] = actor;
    }),
  );
  const heights = Object.fromEntries(Object.entries(actors).map(([id, a]) => [id, a.height]));
  const reframe = (aspect) => (setups = cameraSetups(tl, sp, layout, { heights, aspect }));
  reframe(16 / 9);

  // keep material colours in sync with swaps actors make inside setValue
  const refreshMats = (actor) => {
    actor.object.traverse((o) => {
      if (o.isMesh && o.material?.color && !actor.mats.has(o.material)) actor.mats.set(o.material, o.material.color.clone());
    });
  };

  // ---- sizing
  let W = 0;
  let H = 0;
  let recording = null;
  const resize = () => {
    if (recording) return;
    const r = root.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(240, r.height);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    stage.setSize(W, H, dpr);
    reframe(W / H);
    c2.width = Math.round(W * dpr);
    c2.height = Math.round(H * dpr);
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  new ResizeObserver(resize).observe(root);
  resize();

  // ---- frame description (pure in t for film mode)
  const emphasisFor = (seg) => {
    const e = {};
    for (const id of Object.keys(actors)) e[id] = 1;
    if (seg.act !== 'explain') {
      if (seg.act === 'decide') for (const id of Object.keys(e)) e[id] = 0.75;
      return e;
    }
    const shot = sp.explain[seg.index];
    if (['establish', 'handoff'].includes(shot.shot)) return e;
    for (const id of Object.keys(e)) e[id] = id === shot.focus || id === shot.affects ? 1 : 0.25;
    return e;
  };

  function filmFrame(t) {
    const st = stateAt(tl, t);
    const seg = st.segment;
    const local = st.local;
    const values = { ...defaults };
    const f = { seg, local, values, labels: [], caption: '', captionAlpha: 0, flow: null, act: seg.act, sim: null, decideAlpha: 0 };

    // emphasis eases from the previous shot's
    const prev = emphasisFor(tl.segments[Math.max(0, st.index - 1)]);
    const cur = emphasisFor(seg);
    const k = st.index === 0 ? 1 : easeInOut(span(local, 0, 0.3));
    f.emphasis = Object.fromEntries(Object.keys(cur).map((id) => [id, lerp(prev[id], cur[id], k)]));
    f.pose = poseAt(setups, st.index, local, { reducedMotion });
    const textAlpha = span(local, 0.1, 0.22) * (1 - span(local, 0.95, 1));

    if (seg.act === 'explain') {
      const shot = sp.explain[seg.index];
      const drive = driveFor(shot);
      if (drive) {
        const inp = inputsById[drive];
        values[drive] = sweep(span(local, TRAVEL * 0.8, 0.96), inp.default, inp.min, inp.max);
      }
      f.caption = shot.caption;
      f.captionAlpha = textAlpha;
      if (shot.shot === 'cause') f.flow = { from: shot.focus, to: shot.affects, intensity: bump(span(local, 0.25, 1)) };
      const labelled = [shot.focus, shot.affects].filter(Boolean);
      if (shot.shot !== 'establish' && shot.shot !== 'handoff') f.labels = labelled.map((id) => ({ id, alpha: textAlpha }));
      f.readoutAlpha = st.index === 0 ? span(local, 0.7, 1) : 1;
    } else if (seg.act === 'simulate') {
      const controls = sp.simulate.controls.slice(0, 3);
      const part = 1 / controls.length;
      const active = Math.min(controls.length - 1, Math.floor(local / part));
      controls.forEach((id, i) => {
        if (i > active) return;
        const inp = inputsById[id];
        const p = i < active ? 1 : span((local - i * part) / part, 0.1, 0.95);
        values[id] = sweep(p, inp.default, inp.min, inp.max);
      });
      f.caption = sp.simulate.prompt;
      f.captionAlpha = textAlpha;
      f.sim = { alpha: span(local, 0.02, 0.12) * (1 - span(local, 0.97, 1)), active: controls[active] };
      f.labels = sp.cast.filter((c) => c.plays).map((c) => ({ id: c.id, alpha: span(local, 0.05, 0.2) * 0.95 * (1 - span(local, 0.97, 1)) }));
      f.readoutAlpha = 1;
    } else {
      f.decideAlpha = span(local, 0.12, 0.3);
      f.readoutAlpha = 1 - span(local, 0, 0.2);
    }
    return f;
  }

  // ---- live (interactive) state
  let mode = 'film'; // film | live | decide
  let liveValues = { ...defaults };
  let liveSince = 0;
  let poseFrom = null;

  function liveFrame(now) {
    const target = mode === 'decide' ? setups[decideIndex] : setups[simIndex];
    const k = easeInOut(Math.min(1, (now - liveSince) / 1600));
    const from = poseFrom || target;
    const sway = reducedMotion ? 0 : Math.sin(now / 4000) * 0.25;
    const pose = {
      position: target.position.map((v, i) => lerp(from.position[i], v, k) + (i === 0 ? sway : 0)),
      target: target.target.map((v, i) => lerp(from.target[i], v, k)),
    };
    const emphasis = Object.fromEntries(Object.keys(actors).map((id) => [id, mode === 'decide' ? 0.75 : 1]));
    return {
      act: mode === 'decide' ? 'decide' : 'simulate',
      values: liveValues,
      pose,
      emphasis,
      labels: mode === 'live' ? sp.cast.filter((c) => c.plays).map((c) => ({ id: c.id, alpha: 0.95 })) : [],
      caption: '',
      captionAlpha: 0,
      readoutAlpha: mode === 'live' ? 0 : 0,
      flow: null,
    };
  }

  // ---- apply a frame to the scene and paint the overlay
  const tmp = new THREE.Vector3();
  function apply(frame, timeForFlow, painted) {
    const all = model.run(frame.values);
    for (const [id, actor] of Object.entries(actors)) {
      const plays = actor.entry.plays;
      if (plays && ranges[plays]) actor.setValue(normalise(all[plays], ranges[plays]));
      else actor.setValue(0.6);
      refreshMats(actor);
      const e = frame.emphasis[id] ?? 1;
      if (Math.abs(e - actor.emphasis) > 0.001 || e < 1) {
        for (const [m, base] of actor.mats) m.color.copy(base).lerp(GREY, (1 - e) * 0.7);
        actor.emphasis = e;
      }
    }
    if (frame.flow) {
      const a = actors[frame.flow.from].object.position.clone().setY(actors[frame.flow.from].height * 0.7);
      const b = actors[frame.flow.to].object.position.clone().setY(actors[frame.flow.to].height * 0.7);
      flow.update(a, b, frame.flow.intensity, (timeForFlow * 0.35) % 1);
    } else flow.update(null, null, 0, 0);
    stage.look(frame.pose.position, frame.pose.target);
    stage.render();

    // overlay
    ctx2.clearRect(0, 0, W, H);
    overlay.drawActs(ctx2, W, H, frame.act, sp.question);
    const placed = [];
    const lh = H * 0.017 * 3.6;
    const items = [];
    for (const { id, alpha } of frame.labels) {
      const actor = actors[id];
      tmp.copy(actor.object.position).setY(actor.height + 0.35);
      const s = toScreen(stage.camera, tmp, W, H);
      if (s.visible) items.push({ id, alpha, actor, s });
    }
    items.sort((a, b) => b.s.y - a.s.y);
    for (const { id, alpha, actor, s } of items) {
      const plays = actor.entry.plays;
      const meta = plays ? model.meta(plays) : null;
      const isAssumption = plays && inputsById[plays]?.source === 'assumption';
      const title = meta?.label || actor.entry.label || id;
      const lw = Math.max(110, title.length * H * 0.0095);
      let y = s.y;
      // nudge labels upward until they no longer overlap ones already placed
      for (let guard = 0; guard < 8; guard++) {
        const hit = placed.find((r) => Math.abs(r.x - s.x) < (r.w + lw) / 2 + 6 && Math.abs(r.y - y) < lh);
        if (!hit) break;
        y = hit.y - lh - 4;
      }
      placed.push({ x: s.x, y, w: lw });
      overlay.drawLabel(ctx2, H, s.x, y, title, plays ? formatValue(all[plays], meta.unit) : '', alpha, isAssumption);
    }
    if (painted) {
      const items = sp.model.outputs.map((o) => ({ label: o.label, value: formatValue(all[o.id], o.unit) }));
      overlay.drawReadout(ctx2, W, H, items, frame.readoutAlpha ?? 0);
      if (frame.sim) {
        const controls = sp.simulate.controls.map((id) => {
          const inp = inputsById[id];
          return { id, label: inp.label, value: formatValue(frame.values[id], inp.unit), v: normalise(frame.values[id], [inp.min, inp.max]), assumption: inp.source === 'assumption' };
        });
        overlay.drawSimPanel(ctx2, W, H, controls, frame.sim.alpha, frame.sim.active);
      }
      overlay.drawDecideCard(ctx2, W, H, sp, frame.decideAlpha || 0);
    }
    overlay.drawCaption(ctx2, W, H, frame.caption, frame.captionAlpha);
    overlay.drawSource(ctx2, W, H, sp, 1);
    return all;
  }

  // ---- audio
  let audioCtx = null;
  let score = null;
  let soundOn = opts.music;
  let clipNodes = [];
  const stopAudio = () => {
    score?.stop();
    score = null;
    clipNodes.forEach((n) => { try { n.stop(); } catch {} });
    clipNodes = [];
    stopBrowser();
  };
  const startAudio = (offset) => {
    stopAudio();
    if (!soundOn) return;
    audioCtx ||= new AudioContext();
    audioCtx.resume();
    const limit = opts.interactive ? { segments: tl.segments.filter((s) => s.end <= tl.explainEnd + 1e-6), total: tl.explainEnd } : tl;
    score = scheduleScore(audioCtx, limit, audioCtx.destination, { offset });
    if (opts.voice === 'clips') {
      tl.segments.forEach((seg) => {
        const buf = seg.act === 'explain' ? clips[seg.index] : null;
        if (!buf || seg.start + 0.3 < offset) return;
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx.destination);
        src.start(audioCtx.currentTime + seg.start + 0.3 - offset);
        clipNodes.push(src);
      });
    }
  };

  // ---- playback loop
  let t = 0;
  let playing = false;
  let last = 0;
  let lastSeg = -1;
  const filmEnd = () => (opts.interactive ? tl.explainEnd : tl.total);

  const ui = createUI(wrap, sp, model, {
    togglePlay: () => (playing ? pause() : play()),
    seekFraction: (fr) => {
      enterFilm();
      seek(fr * filmEnd());
    },
    skipToModel: () => enterLive(),
    toggleSound: () => {
      soundOn = !soundOn;
      ui.setSound(soundOn);
      if (playing && mode === 'film') startAudio(t);
      else stopAudio();
    },
    setInput: (id, v) => {
      liveValues = { ...liveValues, [id]: v };
      ui.setValues(model.run(liveValues));
    },
    reset: () => {
      liveValues = { ...defaults };
      ui.setValues(model.run(liveValues));
    },
    toDecide: () => enterDecide(),
    backToModel: () => enterLive(),
    replay: () => {
      enterFilm();
      seek(0);
      play();
    },
    record: () => downloadRecording(),
  });
  ui.setSound(soundOn);
  if (!opts.interactive) ui.showBar(false);

  function enterFilm() {
    if (mode !== 'film') {
      mode = 'film';
      ui.showSim(false);
      ui.showDecide(false);
    }
  }
  function currentPose() {
    return { position: stage.camera.position.toArray(), target: poseAt(setups, stateAt(tl, t).index, stateAt(tl, t).local).target };
  }
  function enterLive() {
    pause();
    poseFrom = currentPose();
    liveSince = performance.now();
    mode = 'live';
    ui.showDecide(false);
    ui.showSim(true);
    ui.setValues(model.run(liveValues));
    ui.announce(sp.simulate.prompt || '');
  }
  function enterDecide() {
    poseFrom = currentPose();
    liveSince = performance.now();
    mode = 'decide';
    ui.showSim(false);
    ui.showDecide(true);
    ui.announce('You decide.');
  }

  function play() {
    if (mode !== 'film') enterFilm();
    if (t >= filmEnd() - 0.05) t = 0;
    playing = true;
    last = performance.now();
    lastSeg = -1;
    ui.setPlaying(true);
    startAudio(t);
  }
  function pause() {
    playing = false;
    ui.setPlaying(false);
    stopAudio();
  }
  function seek(time) {
    t = Math.min(Math.max(0, time), filmEnd());
    lastSeg = -1;
    if (playing) startAudio(t);
  }

  function tick(now) {
    if (!recording) {
      if (mode === 'film') {
        if (playing) {
          t += Math.min(0.1, (now - last) / 1000);
          if (t >= filmEnd()) {
            t = filmEnd();
            if (opts.interactive) enterLive();
            else pause();
          }
        }
        last = now;
        const st = stateAt(tl, t);
        if (playing && st.index !== lastSeg) {
          lastSeg = st.index;
          const text = st.segment.act === 'explain' ? sp.explain[st.index].caption : '';
          if (text) {
            ui.announce(text);
            if (opts.voice === 'browser' && soundOn) speakBrowser(text);
          }
        }
        if (mode === 'film') {
          apply(filmFrame(t), t, true);
          ui.setTime(t, filmEnd());
        }
      }
      if (mode !== 'film') apply(liveFrame(now), now / 1000, false);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---- recording
  async function renderAudio(sampleRate) {
    const off = new OfflineAudioContext(2, Math.ceil(tl.total * sampleRate), sampleRate);
    scheduleScore(off, tl, off.destination, { start: 0 });
    tl.segments.forEach((seg) => {
      const buf = seg.act === 'explain' ? clips[seg.index] : null;
      if (!buf) return;
      const src = off.createBufferSource();
      src.buffer = buf;
      src.connect(off.destination);
      src.start(seg.start + 0.3);
    });
    return off.startRendering();
  }

  async function record({ width = 1920, height = 1080, fps = 60, onProgress } = {}) {
    pause();
    const saved = { W, H, mode };
    recording = true;
    enterFilm();
    stage.setSize(width, height, 1);
    reframe(width / height);
    c2.width = width;
    c2.height = height;
    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    W = width;
    H = height;
    const comp = document.createElement('canvas');
    comp.width = width;
    comp.height = height;
    const cctx = comp.getContext('2d');
    try {
      return await recordFilm(
        {
          total: tl.total,
          drawFrame(time) {
            apply(filmFrame(time), time, true);
            cctx.drawImage(c3, 0, 0, width, height);
            cctx.drawImage(c2, 0, 0, width, height);
            return comp;
          },
          renderAudio: opts.music || clips.length ? renderAudio : null,
        },
        { width, height, fps, onProgress },
      );
    } finally {
      recording = null;
      resize();
      if (saved.mode === 'live') enterLive();
    }
  }

  async function downloadRecording() {
    try {
      ui.setProgress('Recording… 0%');
      const blob = await record({ onProgress: (p) => ui.setProgress(`Recording… ${Math.round(p * 100)}%`) });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${sp.question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'explainer'}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      ui.setProgress('');
    } catch (e) {
      ui.setProgress(`Could not record: ${e.message}`);
      setTimeout(() => ui.setProgress(''), 6000);
    }
  }

  Object.assign(api, {
    timeline: tl,
    duration: tl.total,
    play,
    pause,
    seek: (time) => {
      enterFilm();
      seek(time);
    },
    /** Draw film frame at time t (used by tests and screenshots). */
    renderAt: (time) => {
      pause();
      enterFilm();
      t = time;
      apply(filmFrame(time), time, true);
    },
    record,
    enterLive,
    enterDecide,
    setInputs: (vals) => {
      liveValues = { ...liveValues, ...vals };
      ui.setValues(model.run(liveValues));
    },
  });
  if (opts.autoplay) play();
  else apply(filmFrame(0), 0, true);
  globalThis.dispatchEvent?.(new CustomEvent('esd-ready'));
  return api;
}
