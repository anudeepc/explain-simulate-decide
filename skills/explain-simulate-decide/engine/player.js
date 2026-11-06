// The director: screenplay → model → world (nodes, flows, stores) → camera → overlay.
// filmFrame(t) is a pure function of time, so playback, scrubbing and recording
// always show exactly the same frame for the same t.
import * as THREE from './vendor/three/three.module.js';
import { validate } from './schema.js';
import { createModel, normalise, formatValue, formatInput } from './model.js';
import { parse, refs } from './formula.js';
import { buildTimeline, stateAt, easeInOut, easeOut, span, lerp, TRAVEL, clamp01 } from './timing.js';
import { layoutWorld, lanes, routeFlow, bounds, FOOT } from './layout.js';
import { cameraSetups, poseAt, breathe } from './camera.js';
import { createStage, toScreen } from './stage.js';
import { toneOf } from './look.js';
import { createFlow } from './flows.js';
import { resolveActor } from './cast/resolve.js';
import { CROWD_COLORS } from './cast/names.js';
import * as overlay from './overlay.js';
import { createUI, showErrors } from './ui.js';
import { scheduleScore } from './score.js';
import { speakBrowser, stopBrowser, decodeClips } from './voice.js';
import { recordFilm } from './record.js';

const GREY = new THREE.Color('#e4dccf');
const RUN_SECONDS = 6; // how long "Run 25 years" takes live
const TARGET_LEVEL = 0.72; // a store's target line sits at this share of its jar

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

/**
 * A process story has no numbers: give it an empty model and steady flows, so the
 * same director can stage it. Its film runs Explain, then Decide.
 */
function staged(sp) {
  if (sp.shape !== 'process') return sp;
  return {
    ...sp,
    model: { inputs: [], constants: [], derived: [], outputs: [] },
    world: { ...sp.world, flows: sp.world.flows.map((f) => ({ ...f, rate: '1', unit: '' })) },
    simulate: { controls: [], prompt: '' },
    ask: [],
  };
}

async function start(root, sp, options, api) {
  sp = staged(sp);
  const opts = { cast: 'auto', voice: 'off', interactive: true, autoplay: false, music: true, ...options };
  const isProcess = sp.shape === 'process';
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const world = sp.world;
  const clockDef = world.time || null;
  const SPAN = clockDef?.span || 1;

  // ---- model
  const model = createModel(sp.model, clockDef || {});
  const defaults = model.defaults();
  const inputsById = Object.fromEntries(sp.model.inputs.map((i) => [i.id, i]));
  const nodeById = Object.fromEntries(world.nodes.map((n) => [n.id, n]));
  const flowById = Object.fromEntries(world.flows.map((f) => [f.id, f]));
  const rateAst = Object.fromEntries(world.flows.map((f) => [f.id, parse(f.rate)]));
  const targetAst = Object.fromEntries(world.nodes.filter((n) => n.target !== undefined).map((n) => [n.id, parse(String(n.target))]));
  const ranges = model.ranges(rateAst);
  const milestoneOf = Object.fromEntries((sp.model.milestones || []).map((m) => [m.store, m]));
  const hostOf = (id) => nodeById[id]?.on || id;
  const COMPARING = ['cause', 'turn', 'compare'];
  const siblingsOf = (fid) => world.flows.filter((g) => g.id !== fid && g.to === flowById[fid].to && g.carrier === flowById[fid].carrier).map((g) => g.id);

  // flows of one kind share a scale, so a trickle next to a stream reads as less
  const groupKey = (f) => `${f.carrier}|${f.unit || ''}`;
  const groupMax = {};
  {
    const sim0 = model.simulate(defaults);
    const scope0 = { ...sim0.base, ...model.levelsAt(sim0, 0) };
    for (const f of world.flows) {
      const k = groupKey(f);
      groupMax[k] = Math.max(groupMax[k] || 0, Math.abs(model.evaluate(rateAst[f.id], scope0)) * 1.4, 1e-9);
    }
    for (const f of world.flows) {
      const k = groupKey(f);
      if (groupMax[k] <= 1e-9) groupMax[k] = Math.max(Math.abs(ranges[f.id]?.[1] || 1), 1e-9);
    }
  }

  // which inputs a value depends on (to pick what a shot sweeps)
  const formulaOf = Object.fromEntries([...(sp.model.derived || []), ...sp.model.outputs].map((d) => [d.id, d.formula]));
  const depsCache = {};
  const inputDeps = (id) => {
    if (depsCache[id]) return depsCache[id];
    if (inputsById[id]) return (depsCache[id] = [id]);
    depsCache[id] = [];
    const ast = formulaOf[id] ? parse(formulaOf[id]) : null;
    if (!ast) return depsCache[id];
    const out = new Set();
    for (const r of refs(ast)) inputDeps(r).forEach((x) => out.add(x));
    return (depsCache[id] = [...out]);
  };
  const pickLever = (deps) => deps.find((d) => inputsById[d].kind === 'lever') || deps[0] || null;
  const driveFor = (shot) => {
    if (shot.drive) return shot.drive;
    if (['establish', 'handoff', 'follow', 'timelapse', 'turn'].includes(shot.shot)) return null; // the turn holds still unless told what to sweep
    if (flowById[shot.focus]) {
      const deps = new Set();
      for (const r of refs(rateAst[shot.focus])) inputDeps(r).forEach((x) => deps.add(x));
      return pickLever([...deps]);
    }
    const plays = nodeById[shot.focus]?.plays;
    return plays ? pickLever(inputDeps(plays)) : null;
  };

  // ---- voice clips decide shot lengths when present
  let clips = [];
  if (opts.voice === 'clips' && opts.voiceClips?.length) {
    const decodeCtx = new OfflineAudioContext(1, 1, 48000);
    clips = await decodeClips(decodeCtx, opts.voiceClips);
  }
  const tl = buildTimeline(sp, { voice: clips.map((c) => c?.duration || 0) });
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
  const tone = toneOf(sp);
  wrap.style.setProperty('--esd-accent', tone.accent);
  const stage = createStage(c3, tone);
  const ctx2 = c2.getContext('2d');

  // ---- nodes: build every prop, then place it (attached props ride on their host)
  const layout = layoutWorld(world);
  const pos = layout.nodes;
  const actors = {};
  const holders = {};
  await Promise.all(
    world.nodes.map(async (nd, n) => {
      const actor = await resolveActor(nd, opts.cast, n, { storeUnit: nd.store ? model.meta(nd.store)?.unit : null });
      const holder = new THREE.Group();
      holder.add(actor.object);
      const mats = new Map();
      actor.object.traverse((o) => {
        if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.color && !mats.has(m) && mats.set(m, m.color.clone()));
      });
      Object.assign(actor, { mats, entry: nd, emphasis: 1 });
      actors[nd.id] = actor;
      holders[nd.id] = holder;
    }),
  );
  for (const nd of world.nodes) {
    const holder = holders[nd.id];
    if (nd.on) {
      const host = actors[nd.on];
      const slot = host.slots?.roof || host.slots?.top || { position: new THREE.Vector3(0, host.height, 0), rotation: new THREE.Euler() };
      holder.position.copy(slot.position);
      holder.rotation.copy(slot.rotation);
      holders[nd.on].add(holder);
    } else {
      const p = pos[nd.id];
      holder.position.set(p.x, p.y, p.z);
      holder.rotation.y = p.rotY;
      // things in the sky light the set; they do not throw shadows on it
      if (nd.sky) holder.traverse((o) => (o.castShadow = false));
      stage.scene.add(holder);
    }
  }
  const groundIds = world.nodes.filter((n) => !n.on && !n.sky).map((n) => n.id);
  stage.addBase(bounds(Object.fromEntries(groundIds.map((id) => [id, pos[id]]))));
  stage.scene.updateMatrixWorld(true);

  // ---- flows: route each one between its nodes' ports
  const anchorWorld = (id) => {
    const a = actors[id];
    return holders[id].localToWorld(a.anchor ? a.anchor.clone() : new THREE.Vector3(0, a.height * 0.55, 0)).toArray();
  };
  /** Where a flow leaves or enters a node; `top` when it sits on another node or trades with the sky. */
  const portOf = (id, other) => {
    const nd = nodeById[id];
    const h = hostOf(id);
    const g = pos[h];
    return { p: anchorWorld(id), ground: [g.x, 0, g.z], foot: actors[h].footprint ?? FOOT, sky: !!nd.sky, top: nd.on || nodeById[other]?.sky ? anchorWorld(id) : undefined };
  };
  const laneOf = lanes(world);
  const flows3d = {};
  const flowPoints = {};
  for (const f of world.flows) {
    const pts = routeFlow(portOf(f.from, f.to), portOf(f.to, f.from), laneOf[f.id]);
    flowPoints[f.id] = pts;
    flows3d[f.id] = createFlow(stage.scene, f.carrier, pts);
  }

  // ---- camera framing info
  const camNodes = {};
  for (const nd of world.nodes) {
    const h = hostOf(nd.id);
    const p = pos[h];
    const a = actors[h];
    camNodes[nd.id] = nd.sky
      ? { x: pos[nd.id].x, y: pos[nd.id].y, z: pos[nd.id].z, h: actors[nd.id].height, foot: 1.2, sky: true }
      : { x: p.x, y: 0, z: p.z, h: a.height, foot: a.footprint ?? FOOT, host: nd.on };
  }
  const camSet = { nodes: camNodes, ground: groundIds, flows: Object.fromEntries(world.flows.map((f) => [f.id, { from: f.from, to: f.to, carrier: f.carrier, points: flowPoints[f.id] }])) };
  let setups = cameraSetups(tl, sp, camSet);
  const reframe = (aspect) => (setups = cameraSetups(tl, sp, camSet, { aspect }));

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

  // ---- emphasis: who is in the light for this shot
  const ALL_ON = () => ({ nodes: Object.fromEntries(world.nodes.map((n) => [n.id, 1])), flows: Object.fromEntries(world.flows.map((f) => [f.id, 1])), focusNode: null });
  const emphasisFor = (seg) => {
    const e = ALL_ON();
    if (seg.act === 'decide') {
      for (const k of Object.keys(e.nodes)) e.nodes[k] = 0.8;
      for (const k of Object.keys(e.flows)) e.flows[k] = 0.6;
      return e;
    }
    if (seg.act !== 'explain') return e;
    const shot = sp.explain[seg.index];
    if (!shot.focus || ['establish', 'handoff'].includes(shot.shot)) return e;
    const lit = new Set();
    const litFlows = new Set();
    if (flowById[shot.focus]) {
      const f = flowById[shot.focus];
      const group = [f.id, ...(COMPARING.includes(shot.shot) ? siblingsOf(f.id) : [])];
      group.forEach((id) => {
        litFlows.add(id);
        [flowById[id].from, flowById[id].to].forEach((n) => lit.add(n).add(hostOf(n)));
      });
      e.focusNode = hostOf(f.to);
    } else {
      lit.add(shot.focus).add(hostOf(shot.focus));
      world.nodes.filter((n) => n.on === shot.focus).forEach((n) => lit.add(n.id));
      world.flows.filter((f) => f.from === shot.focus || f.to === shot.focus).forEach((f) => litFlows.add(f.id));
      e.focusNode = hostOf(shot.focus);
    }
    for (const k of Object.keys(e.nodes)) e.nodes[k] = lit.has(k) ? 1 : 0.3;
    for (const k of Object.keys(e.flows)) e.flows[k] = flowById[shot.focus]?.id === k ? 1 : litFlows.has(k) ? 0.75 : 0.2;
    return e;
  };
  const mixEmphasis = (a, b, k) => ({
    nodes: Object.fromEntries(Object.keys(b.nodes).map((id) => [id, lerp(a.nodes[id], b.nodes[id], k)])),
    flows: Object.fromEntries(Object.keys(b.flows).map((id) => [id, lerp(a.flows[id], b.flows[id], k)])),
    focusNode: b.focusNode,
  });

  // the clock in the film: runs during timelapse shots, then stays at the end
  const firstLapse = sp.explain.findIndex((s) => s.shot === 'timelapse');
  const filmTau = (seg, local) => {
    if (!clockDef) return 0;
    if (seg.act === 'explain') {
      if (sp.explain[seg.index].shot === 'timelapse') return SPAN * easeInOut(span(local, 0.18, 0.88));
      return firstLapse >= 0 && seg.index > firstLapse ? SPAN : 0;
    }
    if (seg.act === 'simulate') {
      const start = firstLapse >= 0 ? SPAN : 0;
      if (local < 0.66) return start;
      if (local < 0.7) return lerp(start, 0, easeInOut(span(local, 0.66, 0.7)));
      return SPAN * easeInOut(span(local, 0.7, 0.97));
    }
    return SPAN;
  };

  // answers shown on the painted "Make it yours" card in the recorded film
  const demoAnswers = (sp.ask || []).map((q) => {
    if (q.input) return { question: q.question, answer: formatInput(inputsById[q.input], defaults[q.input]) };
    const best = q.choices.find((c) => Object.entries(c.set).every(([id, v]) => Math.abs(v - defaults[id]) < 1e-9));
    return { question: q.question, answer: best ? best.label : 'Skipped: typical values' };
  });

  function filmFrame(t) {
    const st = stateAt(tl, t);
    const seg = st.segment;
    const local = st.local;
    const values = { ...defaults };
    const f = { act: seg.act, values, tau: filmTau(seg, local), labels: [], caption: '', captionAlpha: 0, sim: null, ask: 0, decideAlpha: 0, readoutAlpha: 1, clockAlpha: 0, ringAlpha: 0 };
    const prev = emphasisFor(tl.segments[Math.max(0, st.index - 1)]);
    const cur = emphasisFor(seg);
    f.emphasis = mixEmphasis(prev, cur, st.index === 0 ? 1 : easeInOut(span(local, 0, 0.3)));
    f.pose = reducedMotion ? poseAt(setups, st.index, local, { reducedMotion }) : breathe(poseAt(setups, st.index, local), t);
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
      f.ringAlpha = shot.focus && !['establish', 'handoff'].includes(shot.shot) ? textAlpha : 0;
      if (shot.focus && !['establish', 'handoff'].includes(shot.shot)) {
        if (flowById[shot.focus]) {
          f.labels.push({ flow: shot.focus, alpha: textAlpha });
          if (COMPARING.includes(shot.shot)) siblingsOf(shot.focus).forEach((id) => f.labels.push({ flow: id, alpha: textAlpha }));
        } else f.labels.push({ node: shot.focus, alpha: textAlpha });
        if (drive && !flowById[shot.focus]) {
          // also label the thing being swept, if another node plays it
          const n = world.nodes.find((nd) => nd.plays === drive && nd.id !== shot.focus);
          if (n) f.labels.push({ node: n.id, alpha: textAlpha });
        } else if (drive) {
          const n = world.nodes.find((nd) => nd.plays === drive);
          if (n) f.labels.push({ node: n.id, alpha: textAlpha });
        }
      }
      if (shot.shot === 'timelapse') f.clockAlpha = span(local, 0.12, 0.2) * (1 - span(local, 0.96, 1));
      f.readoutAlpha = st.index === 0 ? span(local, 0.7, 1) : 1;
    } else if (seg.act === 'simulate') {
      f.ask = span(local, 0.02, 0.07) * (1 - span(local, 0.26, 0.3));
      const controls = sp.simulate.controls.slice(0, 2);
      const part = 0.36 / controls.length;
      controls.forEach((id, i) => {
        const p0 = 0.3 + i * part;
        if (local < p0) return;
        const inp = inputsById[id];
        values[id] = sweep(span(local, p0, p0 + part * 0.95), inp.default, inp.min, inp.max);
      });
      const active = controls[Math.min(controls.length - 1, Math.max(0, Math.floor((local - 0.3) / part)))];
      f.caption = local > 0.3 ? sp.simulate.prompt : '';
      f.captionAlpha = span(local, 0.32, 0.4) * (1 - span(local, 0.97, 1));
      f.sim = { alpha: span(local, 0.28, 0.34) * (1 - span(local, 0.97, 1)), active: local < 0.66 ? active : null };
      f.labels = world.nodes.filter((n) => n.plays || n.store || n.groups).map((n) => ({ node: n.id, alpha: span(local, 0.3, 0.38) * (1 - span(local, 0.97, 1)) }));
      f.clockAlpha = span(local, 0.68, 0.72) * (1 - span(local, 0.97, 1));
    } else {
      f.decideAlpha = span(local, 0.12, 0.3);
      f.readoutAlpha = 1 - span(local, 0, 0.2);
    }
    return f;
  }

  // ---- live (interactive) state
  let mode = 'film'; // film | ask | live | decide
  let liveValues = { ...defaults };
  let liveSince = 0;
  let poseFrom = null;
  let runStart = null; // performance.now() when the clock started running
  let ghost = {}; // store node id → level from the previous try
  let hovered = null;

  const liveTau = (now) => {
    if (!clockDef) return 0;
    if (runStart === null) return SPAN;
    const k = (now - runStart) / 1000 / RUN_SECONDS;
    if (k >= 1) {
      runStart = null;
      ui.setRunning(false);
      return SPAN;
    }
    return SPAN * easeInOut(k);
  };

  // the viewer's own turn and zoom of the camera in Simulate, on top of the directed pose
  const view = { az: 0, el: 0, zoom: 1 };
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 1.8;
  const viewTouched = () => view.az !== 0 || view.el !== 0 || view.zoom !== 1;
  function viewed(pose) {
    if (!viewTouched()) return pose;
    const [tx, ty, tz] = pose.target;
    const dx = pose.position[0] - tx;
    const dy = pose.position[1] - ty;
    const dz = pose.position[2] - tz;
    const r = Math.hypot(dx, dy, dz) * view.zoom;
    const az = Math.atan2(dx, dz) + view.az;
    // keep the camera above the plinth and short of straight down
    const polar = Math.min(1.45, Math.max(0.2, Math.acos(dy / Math.hypot(dx, dy, dz)) - view.el));
    return { position: [tx + r * Math.sin(polar) * Math.sin(az), ty + r * Math.cos(polar), tz + r * Math.sin(polar) * Math.cos(az)], target: pose.target };
  }

  function liveFrame(now) {
    const target = mode === 'decide' ? setups[decideIndex].at(1) : setups[simIndex].at(1);
    const k = easeInOut(Math.min(1, (now - liveSince) / 1600));
    const from = poseFrom || target;
    const sway = reducedMotion ? 0 : Math.sin(now / 4000) * 0.25;
    const directed = {
      position: target.position.map((v, i) => lerp(from.position[i], v, k) + (i === 0 && !viewTouched() ? sway : 0)),
      target: target.target.map((v, i) => lerp(from.target[i], v, k)),
    };
    const pose = mode === 'live' ? viewed(directed) : directed;
    const tau = liveTau(now);
    const e = emphasisFor({ act: mode === 'decide' ? 'decide' : 'simulate' });
    const labels = mode === 'live' ? world.nodes.filter((n) => n.plays || n.store || n.groups).map((n) => ({ node: n.id, alpha: 0.95, hint: hovered === n.id })) : [];
    return {
      act: mode === 'decide' ? 'decide' : 'simulate',
      values: liveValues,
      tau,
      pose,
      emphasis: e,
      labels,
      caption: '',
      captionAlpha: 0,
      readoutAlpha: 0,
      clockAlpha: mode === 'live' && clockDef ? 1 : 0,
      ringAlpha: hovered ? 0.9 : 0,
      ringNode: hovered,
      ghost: mode === 'live',
    };
  }

  // ---- model state for a set of values (cached: the same values give the same run)
  let simKey = '';
  let simCache = null;
  const simFor = (values) => {
    const key = JSON.stringify(values);
    if (key !== simKey) {
      simKey = key;
      simCache = model.simulate(values);
    }
    return simCache;
  };
  const storeView = (nd, sim, levels) => {
    const level = levels[nd.store];
    const target = targetAst[nd.id] ? model.evaluate(targetAst[nd.id], sim.base) : null;
    const top = Math.max(1e-9, target && target > 0 ? target / TARGET_LEVEL : Math.abs(ranges[nd.store]?.[1] || 1));
    return { level, target, top };
  };
  const timeWord = (n) => `${clockDef.unit}${Math.abs(n - 1) < 1e-9 ? '' : 's'}`;
  const milestoneText = (m, sim) => {
    const t = sim.reached[m.id];
    return t === null ? `Not within ${SPAN} ${timeWord(SPAN)}` : `${formatValue(t, '')} ${timeWord(t)}`;
  };
  const readouts = (sim) => [
    ...sp.model.outputs.map((o) => ({ id: o.id, label: o.label, value: formatValue(sim.base[o.id], o.unit) })),
    ...(sp.model.milestones || []).map((m) => ({ id: m.id, label: m.label, value: milestoneText(m, sim) })),
  ];
  const compareRows = (values) => {
    const opts2 = sp.decide.compare || [];
    const head = readouts(simFor(values)).map((r) => r.label);
    const rows = opts2.map((o) => {
      const sim = model.simulate({ ...values, ...o.set });
      return { label: o.label, cells: readouts(sim).map((r) => r.value) };
    });
    return { head, rows };
  };

  // ---- apply a frame to the scene and paint the overlay
  const tmp = new THREE.Vector3();
  function apply(frame, timeForFlow, painted) {
    const sim = simFor(frame.values);
    const levels = model.levelsAt(sim, frame.tau);
    const scope = { ...sim.base, ...levels };
    const appear = {};
    for (const nd of world.nodes) {
      const inp = nd.appears ? inputsById[nd.appears] : null;
      appear[nd.id] = inp ? easeOut(clamp01((frame.values[nd.appears] - inp.min) / (0.12 * (inp.max - inp.min) || 1))) : 1;
    }
    for (const nd of world.nodes) {
      const actor = actors[nd.id];
      if (nd.store) {
        const v = storeView(nd, sim, levels);
        actor.setValue(clamp01(v.level / v.top));
        actor.setTarget?.(v.target !== null ? clamp01(v.target / v.top) : null);
        const m = milestoneOf[nd.store];
        const at = m ? sim.reached[m.id] : null;
        actor.setReached?.(at !== null && at !== undefined ? clamp01((frame.tau - at) / (SPAN * 0.05)) : 0);
        actor.setGhost?.(frame.ghost && ghost[nd.id] !== undefined ? clamp01(ghost[nd.id] / v.top) : null);
      } else if (nd.groups && actor.setGroups) actor.setGroups(nd.groups.map((g) => clamp01((scope[g.value] ?? 0) / 100)));
      else if (nd.plays && actor.percent) actor.setValue(clamp01((scope[nd.plays] ?? 0) / 100));
      else if (nd.plays && ranges[nd.plays]) actor.setValue(normalise(scope[nd.plays], ranges[nd.plays]));
      else actor.setValue(actor.percent ? 1 : 0.6); // a crowd with no number is everyone
      const s = Math.max(0.001, appear[nd.id]);
      holders[nd.id].scale.setScalar(s);
      holders[nd.id].visible = appear[nd.id] > 0.002;
      actor.object.traverse((o) => {
        if (o.isMesh && o.material?.color && !actor.mats.has(o.material)) actor.mats.set(o.material, o.material.color.clone());
      });
      const e = frame.emphasis.nodes[nd.id] ?? 1;
      if (Math.abs(e - actor.emphasis) > 0.001 || e < 1) {
        for (const [m, base] of actor.mats) m.color.copy(base).lerp(GREY, (1 - e) * 0.7);
        actor.emphasis = e;
      }
    }
    for (const f of world.flows) {
      const rate = model.evaluate(rateAst[f.id], scope);
      flows3d[f.id].update({
        amount: clamp01(Math.max(0, rate) / groupMax[groupKey(f)]),
        emphasis: frame.emphasis.flows[f.id] ?? 1,
        visible: Math.min(appear[f.from], appear[f.to]),
        time: timeForFlow,
      });
    }
    const ringNode = frame.ringNode || frame.emphasis.focusNode;
    if (ringNode && pos[ringNode] && !pos[ringNode].sky) stage.markFocus(pos[ringNode].x, pos[ringNode].z, frame.ringAlpha);
    else stage.markFocus(0, 0, 0);
    stage.look(frame.pose.position, frame.pose.target);
    stage.render(timeForFlow);

    // ---- overlay
    overlay.theme.accent = tone.accent; // two films on one page each keep their own colour
    ctx2.clearRect(0, 0, W, H);
    overlay.drawActs(ctx2, W, H, frame.act, sp.question, overlay.sourceLine(sp), overlay.actsOf(sp));
    const items = [];
    for (const lb of frame.labels) {
      let text;
      if (lb.flow) {
        const f = flowById[lb.flow];
        tmp.copy(flows3d[f.id].midpoint()).setY(tmp.y + 0.5);
        text = { title: f.label, value: isProcess ? '' : formatValue(model.evaluate(rateAst[f.id], scope), f.unit || '') };
      } else {
        const nd = nodeById[lb.node];
        if (appear[nd.id] < 0.5) continue;
        const a = actors[nd.id];
        holders[nd.id].localToWorld(tmp.set(0, a.height + 0.3, 0));
        if (nd.store) {
          const v = storeView(nd, sim, levels);
          text = { title: nd.label, value: formatValue(v.level, model.meta(nd.store).unit || '') + (v.target !== null ? ` of ${formatValue(v.target, model.meta(nd.store).unit || '')}` : '') };
        } else if (nd.groups) {
          // one crowd, several outcomes: a coloured dot and a share for each
          // whole people, as the crowd shows them; an outcome nobody reaches is left out
          const parts = nd.groups.map((g, i) => ({ color: CROWD_COLORS[i], n: Math.round(scope[g.value] ?? 0), label: g.label })).filter((x) => x.n > 0);
          text = { title: nd.label, value: '', parts: parts.map((x) => ({ color: x.color, text: `${x.n} in 100: ${x.label}` })) };
        } else if (nd.plays) {
          const meta = model.meta(nd.plays);
          text = { title: meta.label, value: inputsById[nd.plays] ? formatInput(inputsById[nd.plays], scope[nd.plays]) : formatValue(scope[nd.plays], meta.unit || ''), assumption: inputsById[nd.plays]?.source === 'assumption' };
        } else text = { title: nd.label, value: '' };
        if (lb.hint) text.title += '  ↕ drag';
      }
      const s = toScreen(stage.camera, tmp, W, H);
      if (s.visible) items.push({ ...text, alpha: lb.alpha, s });
    }
    items.sort((a, b) => b.s.y - a.s.y);
    const placed = [];
    const lh = H * 0.017 * 3.6;
    for (const it of items) {
      const lw = Math.max(110, Math.max(it.title.length, it.value.length, ...(it.parts || []).map((x) => x.text.length + 2)) * H * 0.0095);
      let y = it.s.y;
      for (let guard = 0; guard < 8; guard++) {
        const hit = placed.find((r) => Math.abs(r.x - it.s.x) < (r.w + lw) / 2 + 6 && Math.abs(r.y - y) < lh);
        if (!hit) break;
        y = hit.y - lh - 4;
      }
      placed.push({ x: it.s.x, y, w: lw });
      overlay.drawLabel(ctx2, H, it.s.x, y, it.title, it.value, it.alpha, it.assumption, it.parts);
    }
    if (clockDef && frame.clockAlpha > 0.01) {
      const unit = clockDef.unit[0].toUpperCase() + clockDef.unit.slice(1);
      overlay.drawClock(ctx2, W, H, `${unit} ${Math.round(frame.tau)} of ${SPAN}`, frame.clockAlpha);
    }
    if (painted) {
      overlay.drawReadout(ctx2, W, H, readouts(sim), frame.readoutAlpha ?? 0);
      if (frame.sim) {
        const controls = sp.simulate.controls.map((id) => {
          const inp = inputsById[id];
          return { id, label: inp.label, value: formatInput(inp, frame.values[id]), v: normalise(frame.values[id], [inp.min, inp.max]), assumption: inp.source === 'assumption' };
        });
        overlay.drawSimPanel(ctx2, W, H, controls, frame.sim.alpha, frame.sim.active);
      }
      overlay.drawAskCard(ctx2, W, H, demoAnswers, frame.ask || 0);
      overlay.drawDecideCard(ctx2, W, H, sp, frame.decideAlpha || 0, frame.decideAlpha > 0.01 && sp.decide.compare ? compareRows(defaults) : null);
    }
    overlay.drawCaption(ctx2, W, H, frame.caption, subtitles ? frame.captionAlpha : 0);
    overlay.drawSource(ctx2, W, H, sp, 1);
    return sim;
  }

  // ---- audio
  let audioCtx = null;
  let score = null;
  let soundOn = opts.music;
  let subtitles = opts.subtitles ?? true;
  let clipNodes = [];
  // While sound plays, the music is the film's clock (as in any video player): the picture
  // follows the audio, so slow frames skip ahead instead of drifting out of time with it.
  let audioClock = null; // { at: audio time when scheduled, film: film time then }
  const stopAudio = () => {
    audioClock = null;
    score?.stop();
    score = null;
    clipNodes.forEach((n) => {
      try {
        n.stop();
      } catch {}
    });
    clipNodes = [];
    stopBrowser();
  };
  const startAudio = (offset) => {
    stopAudio();
    if (!soundOn) return;
    if (!audioCtx) {
      audioCtx = new AudioContext();
      // a browser may hold sound until the viewer clicks; when it starts, schedule from where the film is
      audioCtx.addEventListener('statechange', () => {
        if (audioCtx.state === 'running' && playing && mode === 'film' && !audioClock) startAudio(t);
      });
    }
    audioCtx.resume();
    if (audioCtx.state !== 'running') return; // the statechange above schedules it once sound is allowed
    audioClock = { at: audioCtx.currentTime, film: offset };
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
  const shown = (values) => Object.fromEntries(readouts(simFor(values)).map((r) => [r.id, r.value]));
  const refreshLive = () => {
    ui.setValues(liveValues, shown(liveValues));
    const c = compareRows(liveValues);
    ui.setCompare(c.head, c.rows);
  };
  /** Remember where each store ended, so the next try shows a ghost of it. */
  const keepGhost = () => {
    const sim = simFor(liveValues);
    const levels = model.levelsAt(sim, SPAN);
    for (const nd of world.nodes) if (nd.store) ghost[nd.id] = levels[nd.store];
  };

  const ui = createUI(wrap, sp, model, {
    togglePlay: () => (playing ? pause() : play()),
    seekFraction: (fr) => {
      enterFilm();
      seek(fr * filmEnd());
    },
    skipToModel: () => afterFilm(),
    toggleSubtitles: () => {
      subtitles = !subtitles;
      ui.setSubtitles(subtitles);
      drawnKey = ''; // redraw a paused frame
    },
    toggleSound: () => {
      soundOn = !soundOn;
      ui.setSound(soundOn);
  ui.setSubtitles(subtitles);
      if (playing && mode === 'film') startAudio(t);
      else stopAudio();
    },
    applyAsk: (vals) => {
      liveValues = { ...defaults, ...vals };
      ghost = {};
      enterLive();
      runClock();
    },
    showAsk: () => enterAsk(),
    setInput: (id, v) => {
      if (runStart === null) keepGhost();
      liveValues = { ...liveValues, [id]: v };
      refreshLive();
    },
    reset: () => {
      keepGhost();
      liveValues = { ...defaults };
      refreshLive();
    },
    runClock: () => runClock(),
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
  ui.setSubtitles(subtitles);
  if (!opts.interactive) ui.showBar(false);

  function runClock() {
    if (!clockDef) return;
    runStart = performance.now();
    ui.setRunning(true);
  }
  function enterFilm() {
    if (mode !== 'film') {
      mode = 'film';
      ui.showAsk(false);
      ui.showSim(false);
      ui.showDecide(false);
    }
  }
  function currentPose() {
    return { position: stage.camera.position.toArray(), target: stage.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10).add(stage.camera.position).toArray() };
  }
  function moveCamera() {
    poseFrom = currentPose();
    liveSince = performance.now();
    view.az = 0;
    view.el = 0;
    view.zoom = 1;
  }
  function afterFilm() {
    if (isProcess) enterDecide();
    else if ((sp.ask || []).length) enterAsk();
    else enterLive();
  }
  function enterAsk() {
    if (isProcess) return enterDecide(); // nothing to ask or run in a process story
    pause();
    c2.style.touchAction = '';
    if (mode === 'film') moveCamera();
    mode = 'ask';
    ui.showSim(false);
    ui.showDecide(false);
    ui.showAsk(true);
    ui.announce('Make it yours. Answer what you know.');
  }
  function enterLive() {
    if (isProcess) return enterDecide();
    pause();
    moveCamera();
    mode = 'live';
    c2.style.touchAction = 'none'; // one finger orbits the scene instead of scrolling the page
    ui.showAsk(false);
    ui.showDecide(false);
    ui.showSim(true);
    refreshLive();
    ui.announce(sp.simulate.prompt || '');
  }
  function enterDecide() {
    if (mode === 'film') pause();
    moveCamera();
    c2.style.touchAction = '';
    mode = 'decide';
    ui.showSim(false);
    ui.showDecide(true);
    refreshLive();
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

  // ---- direct manipulation: drag a node to change the input it plays;
  // drag empty space to look around the world, pinch to zoom, double-click to reset
  const ray = new THREE.Raycaster();
  const draggable = world.nodes.filter((n) => n.plays && inputsById[n.plays]).map((n) => n.id);
  const pick = (ev) => {
    const r = c2.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), stage.camera);
    let best = null;
    for (const id of draggable) {
      if (!holders[id].visible) continue;
      const hit = ray.intersectObject(actors[id].object, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { id, d: hit.distance };
    }
    return best?.id || null;
  };
  let drag = null;
  let orbit = null;
  const pointers = new Map();
  const pinchGap = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  c2.addEventListener('pointermove', (ev) => {
    if (mode !== 'live') return;
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (orbit && pointers.size >= 2) {
      view.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, orbit.zoom0 * (orbit.gap0 / pinchGap())));
      return;
    }
    if (orbit) {
      const r = c2.getBoundingClientRect();
      view.az = orbit.az0 - ((ev.clientX - orbit.x0) / r.width) * Math.PI * 1.1;
      view.el = Math.min(0.9, Math.max(-0.9, orbit.el0 + ((ev.clientY - orbit.y0) / r.height) * 1.4));
      return;
    }
    if (drag) {
      const inp = inputsById[nodeById[drag.id].plays];
      let v = drag.v0 + ((drag.y0 - ev.clientY) / (H * 0.4)) * (inp.max - inp.min);
      const step = inp.toggle ? 1 : inp.step || (inp.max - inp.min) / 100;
      v = Math.min(inp.max, Math.max(inp.min, Math.round((v - inp.min) / step) * step + inp.min));
      liveValues = { ...liveValues, [inp.id]: v };
      refreshLive();
      return;
    }
    hovered = pick(ev);
    c2.style.cursor = hovered ? 'ns-resize' : 'grab';
  });
  c2.addEventListener('pointerdown', (ev) => {
    if (mode !== 'live') return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    c2.setPointerCapture(ev.pointerId);
    if (pointers.size >= 2) {
      // a second finger turns the gesture into a pinch
      drag = null;
      orbit = { ...(orbit || { x0: ev.clientX, y0: ev.clientY, az0: view.az, el0: view.el }), zoom0: view.zoom, gap0: pinchGap() };
      return;
    }
    const id = pick(ev);
    if (id) {
      if (runStart === null) keepGhost();
      drag = { id, y0: ev.clientY, v0: liveValues[nodeById[id].plays] };
      hovered = id;
      return;
    }
    orbit = { x0: ev.clientX, y0: ev.clientY, az0: view.az, el0: view.el, zoom0: view.zoom, gap0: 1 };
    c2.style.cursor = 'grabbing';
  });
  const endDrag = (ev) => {
    pointers.delete(ev.pointerId);
    if (pointers.size === 0) {
      drag = null;
      orbit = null;
      if (mode === 'live') c2.style.cursor = 'grab';
    } else if (orbit) {
      const [p] = [...pointers.values()];
      orbit = { x0: p.x, y0: p.y, az0: view.az, el0: view.el, zoom0: view.zoom, gap0: 1 };
    }
  };
  c2.addEventListener('pointerup', endDrag);
  c2.addEventListener('pointercancel', endDrag);
  // trackpad pinch (and ctrl + wheel) zooms; a plain wheel still scrolls the page
  c2.addEventListener(
    'wheel',
    (ev) => {
      if (mode !== 'live' || !ev.ctrlKey) return;
      ev.preventDefault();
      view.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * Math.exp(ev.deltaY * 0.01)));
    },
    { passive: false },
  );
  c2.addEventListener('dblclick', () => mode === 'live' && moveCamera());

  // ---- drawing only when it shows: not off screen, not in a hidden tab, and not
  // again for a paused film frame that has not changed
  let onScreen = true;
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting)).observe(root);
  let drawnKey = '';
  let wasShown = true;
  globalThis.document?.fonts?.ready.then(() => (drawnKey = '')); // redraw captions in the real typeface
  // frame pacing: if frames run slow, trim the costliest finishing passes, one step at a time
  let slow = 0;
  let paced = 0;
  function pace(dt) {
    if (dt <= 0 || dt > 500) return;
    paced++;
    slow = slow * 0.95 + (dt > 40 ? 1 : 0) * 0.05;
    if (paced > 90 && slow > 0.6 && stage.degrade()) {
      slow = 0;
      paced = 0;
      resize();
    }
  }
  function tick(now) {
    const shown = onScreen && !globalThis.document?.hidden;
    // the film and its sound wait together while nobody can see them
    if (!recording && shown !== wasShown) {
      wasShown = shown;
      if (playing && mode === 'film') shown ? startAudio(t) : stopAudio();
    }
    if (!recording && !shown) last = now;
    else if (!recording) {
      const dt = now - last;
      if (mode === 'film') {
        if (playing) {
          if (audioClock && audioCtx.state === 'running') t = audioClock.film + (audioCtx.currentTime - audioClock.at);
          else t += Math.min(0.1, dt / 1000);
          if (t >= filmEnd()) {
            t = filmEnd();
            if (opts.interactive) afterFilm();
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
        const key = `${t}|${W}|${H}`;
        if (mode === 'film' && (playing || key !== drawnKey)) {
          drawnKey = key;
          apply(filmFrame(t), t, true);
          ui.setTime(t, filmEnd());
          if (playing) pace(dt);
        }
      }
      if (mode !== 'film') {
        drawnKey = '';
        apply(liveFrame(now), now / 1000, false);
        pace(dt);
        last = now;
      }
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

  async function record({ width = 1920, height = 1080, fps = 60, onProgress, seconds } = {}) {
    pause();
    const savedMode = mode;
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
      return await stage.withFullQuality(() =>
        recordFilm(
          {
            total: Math.min(seconds || Infinity, tl.total),
            drawFrame(time) {
              apply(filmFrame(time), time, true);
              cctx.drawImage(c3, 0, 0, width, height);
              cctx.drawImage(c2, 0, 0, width, height);
              return comp;
            },
            renderAudio: opts.music || clips.length ? renderAudio : null,
          },
          { width, height, fps, onProgress },
        ),
      );
    } finally {
      recording = null;
      resize();
      if (savedMode === 'live') enterLive();
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
    /** Film-look settings (exposure, bloom, focus blur, grain), for tuning and tests. */
    look: stage.post.settings,
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
    enterAsk,
    enterLive,
    enterDecide,
    runClock,
    setInputs: (vals) => {
      keepGhost();
      liveValues = { ...liveValues, ...vals };
      refreshLive();
    },
  });
  if (opts.autoplay) play();
  else apply(filmFrame(0), 0, true);
  globalThis.dispatchEvent?.(new CustomEvent('esd-ready'));
  return api;
}
