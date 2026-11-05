import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createModel, formatValue } from '../skills/explain-simulate-decide/engine/model.js';

const solar = JSON.parse(readFileSync(new URL('../examples/solar/screenplay.json', import.meta.url)));

test('defaults come from inputs', () => {
  const m = createModel(solar.model);
  assert.deepEqual(m.defaults(), { size: 6, selfUse: 50, sunHours: 4.5, price: 0.25, exportRate: 0.08 });
});

test('run computes derived values and outputs in order', () => {
  const m = createModel(solar.model);
  const v = m.run(m.defaults());
  assert.equal(Math.round(v.yearlyKwh), 7884);
  assert.equal(Math.round(v.saving), 1301);
  assert.equal(v.cost, 18000);
  assert.equal(Math.round(v.payback * 10) / 10, 13.8);
  assert.equal(v.costPerKw, 3000);
});

test('non-finite results become null', () => {
  const m = createModel({
    inputs: [{ id: 'a', min: 0, max: 1, default: 0 }],
    outputs: [{ id: 'r', formula: '1 / a' }],
  });
  assert.equal(m.run({ a: 0 }).r, null);
});

test('ranges: inputs use min/max, outputs span input corners', () => {
  const m = createModel(solar.model);
  const r = m.ranges();
  assert.deepEqual(r.size, [2, 10]);
  assert.ok(r.saving[0] < 400 && r.saving[1] > 4000, `saving range ${r.saving}`);
  assert.ok(r.payback[0] > 0 && r.payback[1] > r.payback[0]);
});

test('meta describes each value', () => {
  const m = createModel(solar.model);
  assert.deepEqual(m.meta('payback'), { id: 'payback', label: 'Years to pay back', unit: 'years', kind: 'output' });
  assert.equal(m.meta('size').kind, 'lever');
  assert.equal(m.meta('costPerKw').kind, 'constant');
});

test('formatValue handles money, rates, percents and negatives', () => {
  assert.equal(formatValue(1301.4, '$'), '$1,301');
  assert.equal(formatValue(-702.2, '$'), '-$702');
  assert.equal(formatValue(0.25, '$/kWh'), '$0.25/kWh');
  assert.equal(formatValue(0.065, '$/kWh'), '$0.065/kWh');
  assert.equal(formatValue(50, '%'), '50%');
  assert.equal(formatValue(13.84, 'years'), '13.8 years');
  assert.equal(formatValue(null, '$'), '—');
});
