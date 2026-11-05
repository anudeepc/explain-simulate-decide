import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shotDuration, buildTimeline, stateAt, SIM_DEMO, DECIDE } from '../skills/explain-simulate-decide/engine/timing.js';
import { layoutWorld, lanes, routeFlow } from '../skills/explain-simulate-decide/engine/layout.js';
import { cameraSetups, poseAt } from '../skills/explain-simulate-decide/engine/camera.js';

const solar = JSON.parse(readFileSync(new URL('../examples/solar/screenplay.json', import.meta.url)));
const close = (a, b) => Math.abs(a - b) < 1e-6;

test('shot duration follows reading time with a floor', () => {
  assert.ok(close(shotDuration({ shot: 'focus', caption: 'one two three four five six seven eight nine ten' }), 10 / 2.6 + 1.6));
  assert.equal(shotDuration({ shot: 'focus', caption: 'Hi.' }), 3.5);
  assert.ok(close(shotDuration({ shot: 'turn', caption: 'Hi.' }), 3.5 + 1.5));
});

test('voice clips lengthen shots when longer than reading time', () => {
  assert.equal(shotDuration({ shot: 'focus', caption: 'Hi.' }, 6), 6.8);
});

test('timeline is contiguous: explain shots, simulate demo, decide', () => {
  const tl = buildTimeline(solar);
  assert.equal(tl.segments.length, solar.explain.length + 2);
  for (let i = 1; i < tl.segments.length; i++) assert.ok(close(tl.segments[i].start, tl.segments[i - 1].end));
  assert.equal(tl.segments.at(-2).act, 'simulate');
  assert.equal(tl.segments.at(-1).act, 'decide');
  assert.ok(close(tl.segments.at(-2).end - tl.segments.at(-2).start, SIM_DEMO));
  assert.ok(close(tl.total - tl.segments.at(-1).start, DECIDE));
  assert.ok(close(tl.explainEnd, tl.segments.at(-2).start));
});

test('stateAt finds segment and local progress, clamped', () => {
  const tl = buildTimeline(solar);
  assert.equal(stateAt(tl, 0).index, 0);
  assert.equal(stateAt(tl, 0).local, 0);
  const s1 = tl.segments[1];
  const mid = stateAt(tl, (s1.start + s1.end) / 2);
  assert.equal(mid.index, 1);
  assert.ok(close(mid.local, 0.5));
  assert.equal(stateAt(tl, 1e9).index, tl.segments.length - 1);
  assert.equal(stateAt(tl, 1e9).local, 1);
  assert.equal(stateAt(tl, -5).local, 0);
});

test('layout: flows run left to right, columns spread, attached and sky nodes follow', () => {
  const a = layoutWorld(solar.world);
  assert.deepEqual(a, layoutWorld(solar.world));
  const p = a.nodes;
  assert.ok(p.home.x < p.grid.x, 'cause before effect');
  assert.ok(Object.entries(p).every(([id, v]) => id === 'jar' || v.x < p.jar.x), 'stores end the story, on the right');
  assert.equal(p.panels.host, 'home');
  assert.equal(p.panels.x, p.home.x);
  assert.ok(p.sun.sky && p.sun.y > 3);
  const ground = Object.entries(p).filter(([, v]) => !v.sky && !v.host).map(([, v]) => v);
  for (let i = 0; i < ground.length; i++)
    for (let j = i + 1; j < ground.length; j++) assert.ok(Math.hypot(ground[i].x - ground[j].x, ground[i].z - ground[j].z) >= 3.5, 'nodes overlap');
});

test('layout copes with cycles and lone nodes', () => {
  const world = {
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'lone' }],
    flows: [{ id: 'f1', from: 'a', to: 'b' }, { id: 'f2', from: 'b', to: 'c' }, { id: 'f3', from: 'c', to: 'a' }],
  };
  const p = layoutWorld(world).nodes;
  assert.ok(p.a.x < p.b.x && p.b.x < p.c.x);
  assert.ok(p.lone);
});

test('lanes: two flows between the same nodes run on opposite sides', () => {
  const l = lanes(solar.world);
  const pa = routeFlow({ ground: [0, 0, 0] }, { ground: [6, 0, 0] }, l.export);
  const pb = routeFlow({ ground: [6, 0, 0] }, { ground: [0, 0, 0] }, l.import);
  const mid = (pts) => pts[Math.floor(pts.length / 2)];
  assert.ok(Math.sign(mid(pa)[2]) !== Math.sign(mid(pb)[2]), 'export and import share one side');
});

test('camera: one setup per segment; travels, then makes its move', () => {
  const tl = buildTimeline(solar);
  const pos = layoutWorld(solar.world).nodes;
  const nodes = Object.fromEntries(Object.entries(pos).map(([id, p]) => [id, { ...p, y: p.sky ? p.y : 0, h: 2.5, foot: 1.3 }]));
  const flows = Object.fromEntries(solar.world.flows.map((f) => [f.id, { ...f, points: [[pos[f.from].x, 0.2, pos[f.from].z], [pos[f.to].x, 0.2, pos[f.to].z]] }]));
  const ground = solar.world.nodes.filter((n) => !n.on && !n.sky).map((n) => n.id);
  const setups = cameraSetups(tl, solar, { nodes, flows, ground });
  assert.equal(setups.length, tl.segments.length);
  const p0 = poseAt(setups, 1, 0);
  assert.ok(p0.position.every((v, k) => close(v, setups[0].at(1).position[k])), 'starts where the last shot ended');
  const cut = poseAt(setups, 1, 0.01, { reducedMotion: true });
  assert.ok(cut.position.every((v, k) => close(v, setups[1].at(0).position[k])), 'reduced motion cuts');
  const follow = solar.explain.findIndex((s, i) => s.shot === 'follow' && !solar.world.nodes.find((n) => n.id === solar.world.flows.find((f) => f.id === s.focus).from).sky);
  const a = poseAt(setups, follow, 0.5).position;
  const b = poseAt(setups, follow, 0.9).position;
  assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) > 0.5, 'follow shot travels along the flow');
});
