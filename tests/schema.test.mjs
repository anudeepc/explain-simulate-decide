import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from '../skills/explain-simulate-decide/engine/schema.js';

const solar = () => JSON.parse(readFileSync(new URL('../examples/solar/screenplay.json', import.meta.url)));

function expectError(mutate, pattern) {
  const sp = solar();
  mutate(sp);
  const errors = validate(sp);
  assert.ok(errors.some((e) => pattern.test(e)), `expected ${pattern} in:\n${errors.join('\n')}`);
}

test('solar screenplay is valid', () => {
  assert.deepEqual(validate(solar()), []);
});

test('rejects non-objects', () => {
  assert.ok(validate(null).length > 0);
  assert.ok(validate('x').length > 0);
});

test('model shape rules', () => {
  expectError((s) => delete s.question, /question/);
  expectError((s) => (s.model.inputs = s.model.inputs.filter((i) => i.id !== 'size')), /2–4 levers/);
  expectError((s) => s.model.inputs.push(...['a', 'b', 'c'].map((id) => ({ id, label: id, unit: '', kind: 'lever', min: 0, max: 1, default: 0, source: 'assumption' }))), /2–4 levers/);
  expectError((s) => (s.model.inputs = s.model.inputs.filter((i) => i.kind !== 'condition')), /1–3 conditions/);
  expectError((s) => s.model.outputs.push({ id: 'z', label: 'z', unit: '', formula: 'cost' }), /1–2 outputs/);
  expectError((s) => (s.model.inputs[0].default = 99), /default .* between min and max/);
  expectError((s) => (s.model.inputs[0].min = 10), /min must be less than max/);
  expectError((s) => (s.model.inputs[0].id = 'bad id'), /id "bad id"/);
  expectError((s) => (s.model.derived[0].id = 'size'), /used twice/);
});

test('formula rules', () => {
  expectError((s) => (s.model.derived[0].formula = 'size *'), /yearlyKwh/);
  expectError((s) => (s.model.derived[0].formula = 'saving * 2'), /Circular/);
  expectError((s) => (s.model.derived[0].formula = 'size * sunHours * 365 * 0.8'), /number 0.8.*constants/);
});

test('sources', () => {
  expectError((s) => delete s.model.inputs[2].quote, /quote/);
  expectError((s) => (s.model.inputs[2].quote = 42), /quote/);
  expectError((s) => (s.model.inputs[0].source = 'vibes'), /source/);
  expectError((s) => delete s.model.constants[0].source, /source/);
});

test('shots and captions', () => {
  expectError((s) => (s.explain[0].caption = 'one two three four five six seven eight nine ten eleven twelve thirteen'), /12 words/);
  expectError((s) => (s.explain = s.explain.filter((x) => x.shot !== 'turn')), /exactly one "turn"/);
  expectError((s) => s.explain.push({ shot: 'turn', focus: 'grid', caption: 'Again.' }), /exactly one "turn"/);
  expectError((s) => (s.explain = s.explain.filter((x) => x.shot !== 'establish')), /"establish"/);
  expectError((s) => (s.explain[1].shot = 'dolly'), /shot "dolly"/);
  expectError((s) => (s.explain[1].focus = 'ghost'), /focus "ghost"/);
  expectError((s) => delete s.explain[2].affects, /affects/);
  expectError((s) => (s.explain[6].drive = 'cost'), /drive "cost"/);
});

test('cast rules', () => {
  expectError((s) => (s.cast[1].plays = 'nothing'), /plays "nothing"/);
  expectError((s) => (s.cast[1] = { id: 'x', source: 'custom' }), /recipe/);
  expectError((s) => (s.cast[1] = { id: 'x', source: 'custom', recipe: [{ shape: 'pyramid', size: [1, 1, 1], color: '#fff' }] }), /pyramid/);
  expectError((s) => (s.cast[1] = { id: 'x', source: 'open', actor: 'house' }), /url/);
  expectError((s) => (s.cast[1].source = 'magic'), /source/);
});

test('simulate and decide', () => {
  expectError((s) => (s.simulate.controls = ['nope']), /controls "nope"/);
  expectError((s) => (s.decide.tradeoffs = []), /tradeoffs/);
  expectError((s) => (s.decide.questionsToAsk = 'x'), /questionsToAsk/);
});

test('banned words', () => {
  expectError((s) => (s.explain[0].caption = 'Boost engagement with solar.'), /"engagement"/);
  expectError((s) => (s.decide.leftOut[0] = 'A gamified view.'), /"gamified"/);
});
