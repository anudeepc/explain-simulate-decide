import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createModel, formatValue } from '../skills/explain-simulate-decide/engine/model.js';

const solar = JSON.parse(readFileSync(new URL('../examples/solar/screenplay.json', import.meta.url)));

const time = solar.world.time;

test('defaults come from inputs', () => {
  const m = createModel(solar.model, time);
  assert.equal(m.defaults().size, 7);
  assert.equal(m.defaults().battery, 0);
});

test('run computes derived values and outputs in order', () => {
  const m = createModel(solar.model, time);
  const v = m.run(m.defaults());
  assert.equal(Math.round(v.yearlyKwh), 9198);
  assert.equal(Math.round(v.direct + v.exportedKwh), Math.round(v.yearlyKwh), 'every kWh is used or sent out');
  assert.equal(Math.round(v.saving), Math.round(v.billSaving + v.exportCredit));
  assert.equal(v.cost, 18200);
});

test('a battery moves power from export to home use', () => {
  const m = createModel(solar.model, time);
  const a = m.run({ battery: 0 });
  const b = m.run({ battery: 10 });
  assert.ok(b.exportedKwh < a.exportedKwh && b.boughtKwh < a.boughtKwh);
  assert.ok(b.cost > a.cost);
});

test('stores integrate over the clock; milestones find the crossing', () => {
  const m = createModel(solar.model, time);
  const sim = m.simulate(m.defaults());
  const end = m.levelsAt(sim, 25).savings;
  assert.ok(Math.abs(end - sim.base.saving * 25) < 1e-6, 'constant change integrates exactly');
  assert.ok(Math.abs(sim.reached.paidBack - sim.base.cost / sim.base.saving) < 0.01);
  const never = m.simulate({ exportRate: 0, selfUse: 20, price: 0.1 });
  assert.equal(never.reached.paidBack, null);
});

test('feedback: a store can read itself (a loan with interest)', () => {
  const m = createModel({
    inputs: [{ id: 'rate', default: 6 }, { id: 'pay', default: 1500 }],
    outputs: [{ id: 'yearly', formula: 'pay * 12' }],
    stores: [{ id: 'balance', start: '100000', change: 'balance * rate / 100 - pay * 12', floor: 0 }],
    milestones: [{ id: 'clear', store: 'balance', reaches: '0' }],
  }, { span: 30, unit: 'year' });
  const sim = m.simulate(m.defaults());
  assert.ok(sim.reached.clear > 6 && sim.reached.clear < 8, `cleared at ${sim.reached.clear}`);
  assert.equal(m.levelsAt(sim, 30).balance, 0);
});

test('non-finite results become null', () => {
  const m = createModel({
    inputs: [{ id: 'a', min: 0, max: 1, default: 0 }],
    outputs: [{ id: 'r', formula: '1 / a' }],
  });
  assert.equal(m.run({ a: 0 }).r, null);
});

test('ranges: inputs use min/max; others span corners and the clock', () => {
  const m = createModel(solar.model, time);
  const r = m.ranges();
  assert.deepEqual(r.size, [2, 12]);
  assert.ok(r.savings[0] === 0 && r.savings[1] > 50000);
});

test('meta describes each value', () => {
  const m = createModel(solar.model, time);
  assert.deepEqual(m.meta('saving'), { id: 'saving', label: 'Saved each year', unit: '$', kind: 'output' });
  assert.equal(m.meta('size').kind, 'lever');
  assert.equal(m.meta('efficiency').kind, 'constant');
  assert.equal(m.meta('savings').kind, 'store');
  assert.equal(m.meta('paidBack').unit, 'years');
});

test('formatValue handles money, rates, percents and negatives', () => {
  assert.equal(formatValue(1301.4, '$'), '$1,301');
  assert.equal(formatValue(71.4, '$'), '$71');
  assert.equal(formatValue(-702.2, '$'), '-$702');
  assert.equal(formatValue(0.25, '$/kWh'), '$0.25/kWh');
  assert.equal(formatValue(0.065, '$/kWh'), '$0.065/kWh');
  assert.equal(formatValue(607.3, '$/yr'), '$607/yr');
  assert.equal(formatValue(50, '%'), '50%');
  assert.equal(formatValue(13.84, 'years'), '13.8 years');
  assert.equal(formatValue(null, '$'), '—');
});
