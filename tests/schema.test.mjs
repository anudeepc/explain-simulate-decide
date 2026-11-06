import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

test('the shape fixtures are valid', () => {
  for (const f of ['process-bill', 'chances-screening']) assert.deepEqual(validate(load(`fixtures/shapes/${f}.json`)), [], f);
});

test('every screenplay in the cross-topic test set is valid', () => {
  // written by the skill from tests/fixtures/articles, one per field; see tests/fixtures/eval/README.md
  const dir = new URL('fixtures/eval/', import.meta.url);
  const names = existsSync(dir) ? readdirSync(dir).filter((n) => existsSync(new URL(`${n}/screenplay.json`, dir))) : [];
  assert.ok(names.length >= 8, 'the test set is present');
  for (const n of names) assert.deepEqual(validate(load(`fixtures/eval/${n}/screenplay.json`)), [], n);
});

test('needs a story shape, and units on every value', () => {
  expectError((s) => delete s.shape, /shape is required/);
  expectError((s) => (s.shape = 'story'), /shape is required/);
  expectError((s) => delete s.model.derived[0].unit, /unit is required/);
  expectError((s) => delete flow(s, 'avoided').unit, /unit is required/);
});

test('formulas must match their units', () => {
  const d = (s, id) => s.model.derived.find((x) => x.id === id);
  expectError((s) => (d(s, 'yearlyKwh').formula = 'size * sunHours * efficiency'), /"yearlyKwh".*365 times too small/);
  expectError((s) => (d(s, 'billSaving').formula = 'direct + shifted * price'), /adds energy per time and \$ per time/);
  expectError((s) => (flow(s, 'avoided').unit = 'kWh/yr'), /rate of flow "avoided"/);
  expectError((s) => (s.model.stores[0].change = 'cost'), /change of store "savings"/);
});

test('the model is run against the source', () => {
  const d = (s, id) => s.model.derived.find((x) => x.id === id);
  expectError((s) => (s.checks = []), /checks: list what the source says/);
  expectError((s) => (s.checks = s.checks.filter((c) => !c.between)), /at least one "between"/);
  expectError((s) => (s.checks = s.checks.filter((c) => !c.rises && !c.falls)), /at least one "rises" or "falls"/);
  expectError((s) => delete s.checks[1].reason, /needs "quote".*or "reason"/);
  expectError((s) => (s.checks[0].between = [1, 2]), /checks\[0\].*expected 1 to 2/);
  expectError((s) => {
    delete s.checks[3].rises;
    s.checks[3].falls = 'size';
  }, /checks\[3\].*should fall/);
  expectError((s) => (d(s, 'exportedKwh').formula = 'surplus'), /counted twice or left out/);
});

test('every extreme of the inputs is tried', () => {
  const d = (s, id) => s.model.derived.find((x) => x.id === id);
  expectError((s) => (d(s, 'boughtKwh').formula = 'useKwh - yearlyKwh'), /Flow "import" runs backwards/);
  expectError((s) => (s.model.outputs[1].formula = 'max(boughtKwh * price - exportCredit, 0) / 12 * battery / battery'), /"newBill" gives no number/);
});

test('the world must fit the shape', () => {
  expectError((s) => (s.shape = 'feedback'), /a store's change must read a store/);
  expectError((s) => (s.shape = 'cause'), /carrier "influence"/);
  expectError((s) => (s.shape = 'chances'), /crowd of 100/);
  expectError((s) => (s.explain = s.explain.filter((x) => x.shot !== 'timelapse')), /add a "timelapse" shot/);
  const hp = load('../examples/heat-pump/screenplay.json');
  hp.shape = 'budget';
  assert.ok(validate(hp).some((e) => /split a fixed amount/.test(e)), validate(hp).join('\n'));
});

test('characters can be given by kind; coins only for money', () => {
  const sp = solar();
  delete node(sp, 'grid').prop;
  node(sp, 'grid').kind = 'institution';
  assert.deepEqual(validate(sp), []);
  expectError((s) => delete node(s, 'grid').prop, /needs a "prop", a "kind"/);
  expectError((s) => {
    delete node(s, 'grid').prop;
    node(s, 'grid').kind = 'castle';
  }, /kind "castle"/);
  const hp = load('../examples/heat-pump/screenplay.json');
  hp.model.constants.push({ id: 'tankSize', label: 'Heat to store', unit: 'kWh', value: 50000, source: 'assumption' });
  hp.model.stores[0].unit = 'kWh';
  hp.model.stores[0].change = 'heat';
  hp.model.milestones[0].reaches = 'tankSize';
  node(hp, 'jar').target = 'tankSize';
  assert.ok(validate(hp).some((e) => /a jar of coins only suits money/.test(e)), validate(hp).join('\n'));
});

test('honest labels for tuned and worked-out numbers', () => {
  // an assumption tuned to match a check makes that check circular
  expectError((s) => {
    s.model.inputs.find((i) => i.id === 'costPerKw').fits = 0;
  }, /source must be "assumption"/);
  const sp = solar();
  sp.model.constants.find((c) => c.id === 'efficiency').fits = 0;
  sp.checks = sp.checks.filter((c, n) => n === 0 || !c.between);
  assert.ok(validate(sp).some((e) => /none of them tests the model/.test(e)));
  expectError((s) => (s.model.inputs[0].note = 5), /note must be a sentence/);
  // a choice that sets a fact about the world must say where its numbers come from
  expectError((s) => delete s.ask[1].choices[0].quote, /"Arizona": say where its numbers for/);
  // circular and open checks
  expectError((s) => s.checks.push({ claim: 'x', same: ['saving', 'billSaving + exportCredit'] }), /can never fail/);
  const open = solar();
  open.checks[1].between = [5, null];
  assert.deepEqual(validate(open), []);
  expectError((s) => (s.checks[1].between = [null, null]), /open end/);
  expectError((s) => (s.source.url = 'tests/article.md'), /web address/);
  expectError((s) => (s.model.inputs[0].toggle = true), /toggle/);
  expectError((s) => s.model.stores.push({ id: 'spare', label: 'x', unit: '$', start: 0, change: 'saving' }), /isn't shown/);
});

test('a process story has no numbers', () => {
  const p = () => load('fixtures/shapes/process-bill.json');
  const bad = (mutate, pattern) => {
    const sp = p();
    mutate(sp);
    assert.ok(validate(sp).some((e) => pattern.test(e)), `expected ${pattern} in:\n${validate(sp).join('\n')}`);
  };
  bad((s) => (s.model = { inputs: [] }), /model: a process story has no numbers/);
  bad((s) => (s.world.flows[0].rate = '1'), /leave out "rate"/);
  bad((s) => (s.world.nodes[0].plays = 'x'), /"plays" needs numbers/);
  bad((s) => (s.explain[1].shot = 'timelapse'), /no numbers to sweep or clock/);
  bad((s) => (s.decide.compare = []), /no numbers to compare/);
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
  expectError((s) => delete s.source.quotes.find((q) => typeof q === 'object').url, /needs "url"/);
  expectError((s) => delete s.source.quotes.find((q) => typeof q === 'object').accessed, /needs "accessed"/);
  expectError((s) => (s.source.quotes.find((q) => typeof q === 'object').accessed = 'last week'), /needs "accessed"/);
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
  expectError((s) => (s.ask[2].choices = s.ask[2].choices.filter((c) => c.set.selfUse !== 40)), /ask\[2\]: no choice matches the default values/);
  expectError((s) => (s.model.inputs.find((i) => i.id === 'battery').default = 5), /ask\[3\]: no choice matches the default values/);
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
  expectError((s) => (s.explain[0].caption = 'Act now, before prices rise.'), /"act now".*urgency/);
  expectError((s) => (s.decide.tradeoffs[0] = 'A game-changing system.'), /"game-changing"/);
  expectError((s) => (s.ask[0].help = 'Unlock your savings.'), /"unlock"/);
});

test('prop names match the studio registry', async () => {
  const src = readFileSync(new URL('../skills/explain-simulate-decide/engine/cast/index.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export const STUDIO'));
  const keys = [...block.matchAll(/^\s+(?:'([a-z-]+)'|([a-zA-Z]+))(?::|,)/gm)].map((m) => m[1] || m[2]);
  assert.deepEqual([...keys].sort(), [...PROPS].sort());
});
