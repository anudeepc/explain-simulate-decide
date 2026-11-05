import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shotDuration, buildTimeline, stateAt, SIM_DEMO, DECIDE } from '../skills/explain-simulate-decide/engine/timing.js';
import { layoutCast } from '../skills/explain-simulate-decide/engine/layout.js';
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

test('layout is deterministic and actors do not overlap', () => {
  for (let n = 1; n <= 10; n++) {
    const cast = Array.from({ length: n }, (_, i) => ({ id: `a${i}` }));
    const a = layoutCast(cast);
    assert.deepEqual(a, layoutCast(cast));
    const pts = Object.values(a);
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) >= 2.8, `overlap n=${n}`);
  }
});

test('camera: one setup per segment; travels then holds', () => {
  const tl = buildTimeline(solar);
  const layout = layoutCast(solar.cast);
  const setups = cameraSetups(tl, solar, layout);
  assert.equal(setups.length, tl.segments.length);
  const p0 = poseAt(setups, 1, 0);
  assert.deepEqual(p0.position, setups[0].position);
  const pEnd = poseAt(setups, 1, 0.45);
  assert.ok(pEnd.position.every((v, k) => close(v, setups[1].position[k])));
  const cut = poseAt(setups, 1, 0.01, { reducedMotion: true });
  assert.ok(cut.position.every((v, k) => close(v, setups[1].position[k])));
});
