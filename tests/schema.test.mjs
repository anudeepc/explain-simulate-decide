import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { validate } from '../skills/explain-simulate-decide/engine/schema.js';
import { screenplayText } from '../skills/explain-simulate-decide/engine/ste.js';
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

test('the best part is no part: nothing that does nothing', () => {
  expectError((s) => s.model.constants.push({ id: 'spare', label: 'Spare', unit: '', value: 1, source: 'assumption' }), /"spare" is never used/);
  expectError((s) => s.model.derived.push({ id: 'unused', label: 'Unused', unit: 'kWh/yr', formula: 'direct' }), /"unused" is never used/);
  expectError((s) => s.model.inputs.push({ id: 'idle', label: 'Idle', unit: '', kind: 'lever', min: 0, max: 1, default: 0, source: 'assumption' }), /"idle" changes nothing/);
  expectError((s) => s.world.nodes.push({ id: 'tree', prop: 'tree', label: 'A tree' }), /node "tree" takes part in no flow/);
});

test('one crowd can show several outcomes', () => {
  const sp = () => load('fixtures/shapes/chances-screening.json');
  const ok = sp();
  ok.world.nodes = ok.world.nodes.filter((n) => n.id !== 'alarm');
  ok.world.nodes.find((n) => n.id === 'early').groups = [
    { value: 'caughtEarly', label: 'caught early' },
    { value: 'falseAlarm', label: 'false alarm' },
  ];
  delete ok.world.nodes.find((n) => n.id === 'early').plays;
  ok.world.flows = ok.world.flows.map((f) => ({ ...f, to: 'early' }));
  ok.explain = ok.explain.map((x) => (x.focus === 'alarm' ? { ...x, focus: 'toAlarm' } : x));
  assert.deepEqual(validate(ok), []);
  const bad = structuredClone(ok);
  bad.world.nodes.find((n) => n.id === 'clinic').groups = [{ value: 'caughtEarly', label: 'x' }];
  assert.ok(validate(bad).some((e) => /groups only work on a crowd/.test(e)));
  const notShare = structuredClone(ok);
  notShare.world.nodes.find((n) => n.id === 'early').groups[0].value = 'tests';
  assert.ok(validate(notShare).some((e) => /must be a share in "%"/.test(e)));
});

test('every film has a story: a hero it opens and ends on', () => {
  const p = () => load('fixtures/shapes/process-bill.json');
  const bad = (mutate, pattern) => {
    const sp = p();
    mutate(sp);
    assert.ok(validate(sp).some((e) => pattern.test(e)), `expected ${pattern} in:\n${validate(sp).join('\n')}`);
  };
  assert.deepEqual(validate(p()), []);
  bad((s) => delete s.story, /story is required/);
  bad((s) => (s.story.hero = 'nobody'), /must be a node/);
  bad((s) => (s.story.hero = 'lower'), /someone the viewer can stand in for/);
  bad((s) => (s.story.logline = 'word '.repeat(40)), /max 35/);
  bad((s) => s.explain.splice(1, 1), /open on the hero/);
  bad((s) => s.explain.splice(s.explain.length - 2, 1), /end with the hero/);
  bad((s) => (s.tone = 'beige'), /tone must be one of/);
});

test('scenes: the hero acting in a set, with subtitles in ASD-STE100 style', () => {
  const b = () => load('../examples/bowel-screening/screenplay.json');
  const bad = (mutate, pattern) => {
    const sp = b();
    mutate(sp);
    assert.ok(validate(sp).some((e) => pattern.test(e)), `expected ${pattern} in:\n${validate(sp).join('\n')}`);
  };
  assert.deepEqual(validate(b()), []);
  const scene = (s) => s.explain.find((x) => x.shot === 'scene');
  bad((s) => (scene(s).set = 'castle'), /set "castle" must be one of/);
  bad((s) => (scene(s).beats = []), /a scene needs 1–8 beats/);
  bad((s) => (scene(s).beats = Array.from({ length: 9 }, () => ({ do: 'wait' }))), /a scene needs 1–8 beats/);
  // each step can carry its own subtitle and framing; "use" works with the thing in hand
  bad((s) => (scene(s).beats = [{ do: 'use', caption: 'Open the bottle.' }]), /use needs "object"/);
  bad((s) => (scene(s).beats = [{ do: 'use', object: 'kit', camera: 'macro' }]), /camera must be close, medium, wide or detail/);
  bad((s) => (scene(s).beats = [{ do: 'use', object: 'kit', caption: 'The bottle is opened by you.' }]), /beats\[0\]\.caption: "is opened" is passive/);
  assert.deepEqual(validate((() => { const s = b(); scene(s).beats = [{ do: 'use', object: 'kit', camera: 'detail', caption: 'Open the bottle.' }]; return s; })()), []);
  bad((s) => (scene(s).beats[0].do = 'dance'), /do "dance" must be one of/);
  bad((s) => (scene(s).beats[0] = { do: 'walk' }), /walk needs "to"/);
  bad((s) => (scene(s).camera = 'drone'), /camera must be close, medium or wide/);
  bad((s) => (scene(s).beats[1].object = 'parcel'), /object "parcel"/);
  bad((s) => (scene(s).caption = 'The sample is sent to the lab.'), /"is sent" is passive/);
  bad((s) => (scene(s).caption = 'Utilize the kit prior to the deadline.'), /instead of "Utilize"/);
  bad((s) => (s.world.nodes.find((n) => n.id === 'crowd').you = 9), /you must be the index of the group/);
  // marks and spots must exist in the place
  bad((s) => (scene(s).at = 'roof'), /at "roof" is not a mark in "doorway"/);
  bad((s) => (scene(s).beats[0].to = 'garage'), /walks to "garage" is not a mark/);
  bad((s) => (scene(s).beats[1].from = 'floor'), /picks up from "floor" is not a spot/);
});

test('places: built-in sets, hunted models and picture facades', () => {
  const b = () => load('../examples/bowel-screening/screenplay.json');
  const withPlaces = () => {
    const sp = b();
    sp.places = [
      { id: 'home', kind: 'set', set: 'doorway' },
      { id: 'regulator', kind: 'facade', label: 'Test Office', image: 'https://example.org/office.jpg', credit: 'Photo: A. Person, CC BY-SA 4.0' },
      { id: 'clinic', kind: 'model', url: 'clinic.glb', credit: 'Model: B. Person, CC0' },
    ];
    sp.explain[1].set = 'home';
    sp.explain[6].set = 'home';
    sp.explain[7] = { ...sp.explain[7], set: 'clinic', at: 'entrance', beats: [{ do: 'walk', to: 'front' }, { do: 'listen', feel: 'worried' }] };
    sp.explain[9] = { shot: 'scene', set: 'regulator', camera: 'medium', at: 'desk', beats: [{ do: 'give', object: 'letter', to: 'desk' }, { do: 'talk' }], caption: 'You ask the office about your results.' };
    return sp;
  };
  assert.deepEqual(validate(withPlaces()), []);
  const bad = (mutate, pattern) => {
    const sp = withPlaces();
    mutate(sp);
    assert.ok(validate(sp).some((e) => pattern.test(e)), `expected ${pattern} in:\n${validate(sp).join('\n')}`);
  };
  bad((s) => (s.places[1].kind = 'castle'), /kind must be one of set, model, facade/);
  bad((s) => delete s.places[2].credit, /model place needs "url".*"credit"/);
  bad((s) => delete s.places[1].credit, /facade with a picture needs "image".*"credit"/);
  bad((s) => (s.places[0].set = 'garage'), /set must be one of/);
  bad((s) => s.places.push({ id: 'kitchen', kind: 'facade' }), /name of a built-in set/);
  bad((s) => s.places.push({ id: 'shop', kind: 'facade' }), /no scene happens here/);
  bad((s) => s.places.push({ ...s.places[1] }), /used twice/);
  bad((s) => (s.explain[9].at = 'mat'), /at "mat" is not a mark in "regulator"/);
  bad((s) => (s.places[1].width = 80), /width is the building's frontage/);
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
  // the same world rules as every other story
  bad((s) => (s.world.nodes[0] = { id: 'idea', label: 'A bill', recipe: [{ shape: 'blob', size: [1, 1, 1] }] }), /shape "blob"/);
  bad((s) => (s.world.nodes[0] = { id: 'idea', label: 'A bill', url: 'https://x/a.glb' }), /need "url" and "credit"/);
  bad((s) => {
    s.world.nodes[1].on = 'upper';
    s.world.nodes[0].on = 'lower';
  }, /already sits on another node/);
});

test('rejects non-objects and old versions', () => {
  assert.ok(validate(null).length > 0);
  assert.ok(validate('x').length > 0);
  expectError((s) => (s.version = 1), /version must be 2/);
});

test('model shape rules', () => {
  expectError((s) => delete s.question, /question/);
  expectError((s) => (s.model.inputs = s.model.inputs.filter((i) => i.kind !== 'lever')), /1–4 levers/);
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

test("all viewer text is in ASD-STE100, except the source's quotes", () => {
  expectError((s) => (s.decide.tradeoffs[1] = 'The panels can be removed later.'), /^decide\.tradeoffs\[1\]: "be removed" is passive\. Use the active voice/);
  expectError((s) => (node(s, 'home').label = 'Home with a very large roof that faces the sun for most of the long summer day and some of the winter'), /^world\.nodes\[\d+\]\.label: ".*" has \d+ words\. Keep each sentence to 20 words/);
  expectError((s) => (s.model.inputs[0].note = 'Panels make power by day; the grid fills the gap at night.'), /^model\.inputs\[0\]\.note: Split ".*" into two sentences/);
  // a caption problem shows once, at its own path
  const sp = solar();
  sp.explain[0].caption = 'The sun is used by the panels.';
  assert.deepEqual(validate(sp).filter((e) => /passive/.test(e)), ['explain[0].caption: "is used" is passive. Use the active voice: say who does it (for example "you send the kit", not "the kit is sent").']);
  // a logline can be several short sentences, 35 words or fewer in total
  expectError((s) => (s.story.logline = 'Your roof catches sun all day; power you use yourself saves more than power you sell.'), /^story\.logline: Split/);
  // fields the engine reads as ids or formulas are names, not prose
  const ids = { model: { stores: [{ id: 'saved', label: 'Money saved', start: 'opening', change: 'saving', ceiling: 'limiting' }], milestones: [{ store: 'saved', reaches: 'reaching' }] }, world: { nodes: [{ id: 'jar', prop: 'jar', store: 'saved', target: 'missing', groups: [{ value: 'waiting', label: 'Waiting list' }] }] }, simulate: { controls: ['heating'] }, ask: [{ input: 'heating', question: 'How warm?' }] };
  assert.deepEqual(screenplayText(ids).map((x) => x.text), ['Money saved', 'Waiting list', 'How warm?']);
  // quotes are the source's own words: they stay as written
  const q = solar();
  q.source.quotes[0] = 'Further savings are achieved by the battery; this is determined by use.';
  assert.deepEqual(validate(q), []);
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
