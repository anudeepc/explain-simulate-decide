import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, evaluate, refs, orderFormulas } from '../skills/explain-simulate-decide/engine/formula.js';

const ev = (src, scope = {}) => evaluate(parse(src), scope);

test('arithmetic precedence and parentheses', () => {
  assert.equal(ev('2 + 3 * 4'), 14);
  assert.equal(ev('(2 + 3) * 4'), 20);
  assert.equal(ev('10 / 4 - 1'), 1.5);
  assert.equal(ev('2 * 3 / 4 * 2'), 3);
});

test('unary minus and decimals', () => {
  assert.equal(ev('-3 + 5'), 2);
  assert.equal(ev('-(2 * .5)'), -1);
  assert.equal(ev('1.25e2'), 125);
});

test('min, max, round', () => {
  assert.equal(ev('min(4, 2, 9)'), 2);
  assert.equal(ev('max(4, 2, 9)'), 9);
  assert.equal(ev('round(2.567, 2)'), 2.57);
  assert.equal(ev('round(2.5)'), 3);
});

test('references resolve from scope', () => {
  assert.equal(ev('panels * 400 * price', { panels: 10, price: 0.3 }), 1200);
  assert.deepEqual(refs(parse('a * (b + min(a, c_2))')).sort(), ['a', 'b', 'c_2']);
});

test('unknown reference throws at evaluation', () => {
  assert.throws(() => ev('x + 1'), /Unknown value "x"/);
});

test('rejects anything that is not arithmetic', () => {
  for (const bad of ['constructor', 'a.b', 'x[0]', '"s"', 'alert(1)', 'a = 1', '2 +', '', '1 2', 'min()', 'this', '__proto__', 'a ** 2', 'a; b']) {
    assert.throws(() => ev(bad, { a: 1, b: 2, x: 1, constructor: 1 }), Error, `should reject: ${bad}`);
  }
});

test('orderFormulas sorts by dependency', () => {
  const order = orderFormulas(
    [{ id: 'c', formula: 'b * 2' }, { id: 'b', formula: 'a + 1' }],
    ['a'],
  ).map((d) => d.id);
  assert.deepEqual(order, ['b', 'c']);
});

test('orderFormulas rejects cycles and unknown ids', () => {
  assert.throws(() => orderFormulas([{ id: 'a', formula: 'b' }, { id: 'b', formula: 'a' }], []), /circular/i);
  assert.throws(() => orderFormulas([{ id: 'a', formula: 'zz + 1' }], []), /unknown value "zz"/i);
});
