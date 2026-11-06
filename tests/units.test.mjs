import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnit, checkUnit } from '../skills/explain-simulate-decide/engine/units.js';
import { parse } from '../skills/explain-simulate-decide/engine/formula.js';

const same = (a, b) => {
  const x = parseUnit(a);
  const y = parseUnit(b);
  return JSON.stringify(Object.entries(x.d).sort()) === JSON.stringify(Object.entries(y.d).sort()) && Math.abs(x.k - y.k) < 1e-9;
};

test('reads units from any topic', () => {
  assert.ok(same('$ a year', '$/yr'));
  assert.ok(same('h per night', 'h/night'));
  assert.ok(same('kilowatt hours', 'kWh'));
  assert.ok(same('cigarettes a day', 'cigarette/day'), 'unknown words become countable things, plural or not');
  assert.ok(same('people', 'person'));
  assert.ok(same('kW', 'kWh/h'), 'power is energy over time');
  assert.deepEqual(parseUnit('').d, {});
  assert.equal(parseUnit('%').k, -2);
  assert.equal(parseUnit('people per 1,000').k, -3);
  assert.deepEqual(parseUnit('t CO2e/yr').d, { mass: 1, co2e: 1, time: -1 });
  assert.notDeepEqual(parseUnit('€').d, parseUnit('$').d, 'currencies never mix');
});

const units = { size: 'kW', sun: 'h/day', year: 'kWh/yr', bill: '$/month', price: '$/kWh', pct: '%', bat: 'kWh', cyc: '/day', save: '$/yr', sleep: 'h/night', screen: 'min/night' };
const check = (f, want) => checkUnit(parse(f), parseUnit(want), (id) => parseUnit(units[id]), 'X');

test('accepts correct formulas with conversions', () => {
  assert.equal(check('size * sun * 365', 'kWh/yr'), null);
  assert.equal(check('bill * 12 / price', 'kWh/yr'), null);
  assert.equal(check('year * pct / 100', 'kWh/yr'), null);
  assert.equal(check('min(year, bat * cyc * 365)', 'kWh/yr'), null);
  assert.equal(check('max(save, 0) / 12', '$/month'), null);
  assert.equal(check('sleep - screen / 60', 'h/night'), null);
});

test('catches missing or wrong conversions', () => {
  assert.match(check('size * sun', 'kWh/yr'), /365 times too small/);
  assert.match(check('size * sun * 12', 'kWh/yr'), /times too small/);
  assert.match(check('year * pct', 'kWh/yr'), /100 times too big/);
  assert.match(check('sleep - screen', 'h/night'), /different sizes/);
  assert.match(check('min(year * pct, year)', 'kWh/yr'), /different sizes/);
});

test('catches mixed units', () => {
  assert.match(check('year + save', 'kWh/yr'), /adds energy per time and \$ per time/);
  assert.match(check('min(year, bat * 365)', 'kWh/yr'), /compares energy/);
  assert.match(check('save', 'kWh/yr'), /comes out in \$ per time, but its unit says energy per time/);
});

test('powers: plain bases with any power, unit bases only with a fixed power', () => {
  const u = { p: '%', n: 'tests', side: 'm', len: 'm' };
  const c = (f, want) => checkUnit(parse(f), parseUnit(want), (id) => parseUnit(u[id] ?? ''), 'X');
  assert.equal(c('100 - 100 * pow(1 - p / 100, n / n)', '%'), null);
  assert.equal(c('pow(side, 2)', 'm²'), null);
  assert.match(c('pow(side, n / n)', 'm'), /changing power/);
  assert.match(c('pow(2, len)', ''), /power that has a unit/);
  // a count of things is a fine power: 13 tests
  assert.equal(c('100 - 100 * pow(1 - p / 100, n)', '%'), null);
  // a switch is a plain 0 or 1
  assert.equal(c('side * step(side)', 'm'), null);
});

test('counted days get a hint', () => {
  const u = { km: 'km/trip', days: 'days/week', trips: 'trips/day' };
  const msg = checkUnit(parse('km * days * 52'), parseUnit('km/yr'), (id) => parseUnit(u[id]), 'X');
  assert.match(msg, /workdays\/week/);
});
