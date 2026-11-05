import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from '../skills/explain-simulate-decide/engine/schema.js';
import { PROPS } from '../skills/explain-simulate-decide/engine/cast/names.js';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const solar = () => load('../examples/solar/screenplay.json');
const node = (s, id) => s.world.nodes.find((n) => n.id === id);
const flow = (s, id) => s.world.flows.find((f) => f.id === id);
const shot = (s, type) => s.explain.find((x) => x.shot === type);

function expectError(mutate, pattern) {
  const sp = solar();
  mutate(sp);
  const errors = validate(sp);
  assert.ok(errors.some((e) => pattern.test(e)), `expected ${pattern} in:\n${errors.join('\n')}`);
}

test('the examples are valid', () => {
  assert.deepEqual(validate(solar()), []);
  assert.deepEqual(validate(load('../examples/heat-pump/screenplay.json')), []);
});

test('rejects non-objects and old versions', () => {
  assert.ok(validate(null).length > 0);
  assert.ok(validate('x').length > 0);
  expectError((s) => (s.version = 1), /version must be 2/);
});

test('model shape rules', () => {
  expectError((s) => delete s.question, /question/);
  expectError((s) => (s.model.inputs = s.model.inputs.filter((i) => !['size', 'battery'].includes(i.id))), /2–4 levers/);
  expectError((s) => (s.model.inputs = s.model.inputs.filter((i) => i.kind !== 'condition')), /1–5 conditions/);
  expectError((s) => s.model.outputs.push({ id: 'z', label: 'z', unit: '', formula: 'cost' }), /1–2 outputs/);
  expectError((s) => (s.model.inputs[0].default = 99), /default .* between min and max/);
  expectError((s) => (s.model.inputs[0].min = 100), /min must be less than max/);
  expectError((s) => (s.model.inputs[0].id = 'bad id'), /id "bad id"/);
  expectError((s) => (s.model.derived[0].id = 'size'), /used twice/);
});

test('formula rules', () => {
  expectError((s) => (s.model.derived[1].formula = 'size *'), /yearlyKwh/);
  expectError((s) => (s.model.derived[1].formula = 'saving * 2'), /Circular/);
  expectError((s) => (s.model.derived[1].formula = 'size * sunHours * 365 * 0.8'), /number 0.8.*constants/);
});

test('stores and milestones', () => {
  expectError((s) => (s.model.outputs[0].formula = 'savings / 2'), /reads the store "savings"/);
  expectError((s) => (s.model.stores[0].change = 'nothing * 2'), /unknown value "nothing"/);
  expectError((s) => (s.model.stores[0].change = 'saving * 1.5'), /number 1.5/);
  expectError((s) => (s.model.milestones[0].store = 'jar'), /store "jar" is not in model.stores/);
  expectError((s) => (s.model.milestones[0].reaches = 'savings'), /unknown value "savings"/);
  expectError((s) => delete s.world.time, /world.time is required/);
  expectError((s) => (s.world.time.span = 500), /span/);
});

test('sources', () => {
  expectError((s) => delete s.model.inputs.find((i) => i.source === 'article').quote, /quote/);
  expectError((s) => (s.model.inputs.find((i) => i.source === 'article').quote = 99), /quote/);
  expectError((s) => (s.model.inputs[0].source = 'vibes'), /source/);
  expectError((s) => delete s.model.constants[0].source, /source/);
  expectError((s) => s.source.quotes.push({ url: 'https://x' }), /must be a sentence/);
});

test('world: nodes', () => {
  expectError((s) => (node(s, 'home').prop = 'castle'), /prop "castle" is not in the catalog/);
  expectError((s) => (node(s, 'home').plays = 'nothing'), /plays "nothing"/);
  expectError((s) => (node(s, 'panels').on = 'ghost'), /on "ghost" must be another node/);
  expectError((s) => (node(s, 'home').on = 'panels'), /already sits on another node/);
  expectError((s) => (node(s, 'jar').store = 'pot'), /store "pot"/);
  expectError((s) => (node(s, 'home').target = 'cost'), /target only applies to store nodes/);
  expectError((s) => (node(s, 'bat').appears = 'saving'), /appears "saving" must be an input/);
  expectError((s) => (node(s, 'home').recipe = [{ shape: 'pyramid', size: [1, 1, 1] }]), /pyramid/);
  expectError((s) => Object.assign(node(s, 'home'), { url: 'https://x/model.glb' }), /url" and "credit/);
});

test('world: flows', () => {
  expectError((s) => (flow(s, 'direct').from = 'moon'), /from "moon" is not a node/);
  expectError((s) => (flow(s, 'direct').to = 'panels'), /from and to must be different/);
  expectError((s) => (flow(s, 'direct').carrier = 'vibes'), /carrier must be one of/);
  expectError((s) => (flow(s, 'direct').rate = 'direct * 0.5'), /number 0.5/);
  expectError((s) => (flow(s, 'direct').id = 'home'), /unique \(and not a node id\)/);
});

test('ask', () => {
  expectError((s) => (s.ask[0].input = 'cost'), /input "cost" is not an input/);
  expectError((s) => (s.ask[1].choices[0].set = { sunHours: 40 }), /sunHours = 40 must be a number between/);
  expectError((s) => (s.ask[1].choices = s.ask[1].choices.slice(0, 1)), /2–5 choices/);
  expectError((s) => delete s.ask[0].input, /needs "input"/);
  expectError((s) => (s.ask[1].choices[0].quote = [99]), /quote must be an index/);
});

test('shots and captions', () => {
  expectError((s) => (s.explain[0].caption = 'one two three four five six seven eight nine ten eleven twelve thirteen'), /12 words/);
  expectError((s) => (s.explain = s.explain.filter((x) => x.shot !== 'turn')), /exactly one "turn"/);
  expectError((s) => s.explain.push({ shot: 'turn', focus: 'grid', caption: 'Again.' }), /exactly one "turn"/);
  expectError((s) => (s.explain = s.explain.filter((x) => x.shot !== 'establish')), /"establish"/);
  expectError((s) => (s.explain = s.explain.filter((x) => !['follow', 'cause'].includes(x.shot))), /"follow" or "cause"/);
  expectError((s) => (s.explain[1].shot = 'dolly'), /shot "dolly"/);
  expectError((s) => (s.explain[1].focus = 'ghost'), /focus "ghost"/);
  expectError((s) => (shot(s, 'follow').focus = 'home'), /follow shots need focus = a flow/);
  expectError((s) => (shot(s, 'timelapse').focus = 'home'), /timelapse needs focus = a node that shows a store/);
  expectError((s) => (shot(s, 'cause').drive = 'cost'), /drive "cost"/);
});

test('simulate and decide', () => {
  expectError((s) => (s.simulate.controls = ['nope']), /controls "nope"/);
  expectError((s) => (s.decide.tradeoffs = []), /tradeoffs/);
  expectError((s) => (s.decide.questionsToAsk = 'x'), /questionsToAsk/);
  expectError((s) => (s.decide.compare = [s.decide.compare[0]]), /2–3 options/);
  expectError((s) => (s.decide.compare[1].set = { battery: 99 }), /battery = 99 must be between/);
});

test('banned words', () => {
  expectError((s) => (s.explain[0].caption = 'Boost engagement with solar.'), /"engagement"/);
  expectError((s) => (s.decide.leftOut[0] = 'A gamified view.'), /"gamified"/);
  expectError((s) => (flow(s, 'direct').label = 'Gamified power'), /"gamified"/);
});

test('prop names match the studio registry', async () => {
  const src = readFileSync(new URL('../skills/explain-simulate-decide/engine/cast/index.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export const STUDIO'));
  const keys = [...block.matchAll(/^\s+(?:'([a-z-]+)'|([a-zA-Z]+))(?::|,)/gm)].map((m) => m[1] || m[2]);
  assert.deepEqual([...keys].sort(), [...PROPS].sort());
});
