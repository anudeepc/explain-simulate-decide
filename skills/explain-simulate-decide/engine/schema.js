// Checks a screenplay and returns plain-English errors. Empty array = valid.
// The renderer refuses to play anything that fails here.
import { parse, refs, orderFormulas } from './formula.js';
import { PROPS, KINDS } from './cast/names.js';
import { parseUnit, checkUnit, unitsOf, per } from './units.js';
import { createModel, formatValue } from './model.js';
import { TONES } from './look.js';

export const SHOTS = ['establish', 'introduce', 'focus', 'follow', 'cause', 'compare', 'turn', 'timelapse', 'handoff'];
export const CARRIERS = ['energy', 'money', 'water', 'heat', 'light', 'goods', 'people', 'data', 'influence', 'time', 'carbon', 'substance'];
// The story shapes (see references/story-shapes.md). Each one needs a different world.
export const STORY_SHAPES = ['build-up', 'conversion', 'budget', 'cause', 'feedback', 'chances', 'process'];
const MONEY = new Set(['$', '€', '£', '¥', '₹']);
export const TIME_UNITS = ['day', 'week', 'month', 'year'];
export const SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus'];
// Words from references/writing-rules.md, each with what to say instead.
export const BANNED = [
  [/\bgamif\w*/i, 'Call it a guide, a simulation or a model.'],
  [/\bengagement\b/i, 'Say "understanding" instead.'],
  [/\brevolutionary\b/i, 'Describe what it does instead.'],
  [/\bgame[- ]chang\w*/i, 'Describe what it changes instead.'],
  [/\bunlock\w*/i, 'Say what the person can do instead.'],
  [/\bsupercharg\w*/i, 'Say what it does instead.'],
  [/\bdon[’']?t miss out\b/i, 'The page never pushes. Remove the urgency.'],
  [/\bact now\b/i, 'The page never pushes. Remove the urgency.'],
  [/\bbefore it[’']?s too late\b/i, 'The page never pushes. Remove the urgency.'],
];
const DATE = /^\d{4}-\d{2}(-\d{2})?$/;
export const MAX_CAPTION_WORDS = 12;
// Plain unit conversions may appear inside formulas; every other number must be a named constant.
export const ALLOWED_LITERALS = [0, 1, 2, 5, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000];

const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = ['min', 'max', 'round', 'pow', 'step'];
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const arr = (x) => (Array.isArray(x) ? x : []);
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

function literals(ast, out = []) {
  if ('num' in ast) out.push(ast.num);
  else if ('call' in ast) ast.args.forEach((a) => literals(a, out));
  else if ('op' in ast) {
    literals(ast.a, out);
    if (ast.b) literals(ast.b, out);
  }
  return out;
}

/** Text of a quote, whether written as a string or {text, url}. */
export const quoteText = (q) => (typeof q === 'string' ? q : q?.text);

/** @param {any} sp */
export function validate(sp) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!sp || typeof sp !== 'object' || Array.isArray(sp)) return ['Screenplay must be a JSON object'];

  if (sp.version !== 2) err('version must be 2');
  if (!isStr(sp.question)) err('question is required');
  if (!sp.source || typeof sp.source !== 'object') err('source is required (title, url, quotes)');
  if (sp.source?.url !== undefined && !/^https?:\/\//.test(sp.source.url)) err('source.url must be a web address (https://…). For pasted text or a file with no web address, leave url out.');
  const quotes = arr(sp.source?.quotes);
  quotes.forEach((q, n) => {
    const where = `source.quotes[${n}]`;
    if (!isStr(quoteText(q))) return err(`${where}: must be a sentence, or {"text", "url", "publisher", "accessed"}`);
    if (typeof q !== 'object') return;
    // a researched figure: the reader must be able to open the page and see when it was read
    if (!/^https?:\/\//.test(q.url || '')) err(`${where}: a researched quote needs "url", the page you opened`);
    if (!DATE.test(q.accessed || '')) err(`${where}: a researched quote needs "accessed", the date you read the page (YYYY-MM-DD)`);
  });

  // ---- story shape
  const shape = sp.shape;
  if (!STORY_SHAPES.includes(shape)) err(`shape is required: one of ${STORY_SHAPES.join(', ')}. See references/story-shapes.md for which one fits the article.`);
  const isProcess = shape === 'process';
  if (sp.tone !== undefined && !TONES[sp.tone]) err(`tone must be one of ${Object.keys(TONES).join(', ')}: the colour that suits the topic`);
  if (isProcess) return [...errors, ...validateProcess(sp)];

  // ---- model
  const m = sp.model || {};
  if (!sp.model) err('model is required');
  const inputs = arr(m.inputs);
  const constants = arr(m.constants);
  const derived = arr(m.derived);
  const outputs = arr(m.outputs);
  const stores = arr(m.stores);
  const milestones = arr(m.milestones);

  const ids = new Set();
  const addId = (id, where) => {
    if (!ID.test(id || '') || RESERVED.includes(id)) err(`${where}: id "${id}" must be letters, digits or _ and start with a letter`);
    else if (ids.has(id)) err(`${where}: id "${id}" is used twice`);
    ids.add(id);
  };
  const fitted = new Map(); // check index → the assumption tuned to match it
  const checkSource = (x, where) => {
    if (x.note !== undefined && !isStr(x.note)) err(`${where}: note must be a sentence (how the number was worked out)`);
    if (x.fits !== undefined) {
      if (x.source !== 'assumption') err(`${where}: "fits" marks an assumption tuned to match a check, so source must be "assumption"`);
      else if (!Number.isInteger(x.fits) || !arr(sp.checks)[x.fits]?.between) err(`${where}: fits must be the index of a "between" check (the figure this value was tuned to match)`);
      else fitted.set(x.fits, x.id);
    }
    if (x.source === 'article') {
      const qs = [].concat(x.quote);
      if (x.quote === undefined || !qs.length || !qs.every((q) => Number.isInteger(q) && q >= 0 && q < quotes.length)) err(`${where}: source "article" needs "quote": an index into source.quotes (or a list, when the number comes from several sentences)`);
    } else if (x.source !== 'assumption') err(`${where}: source must be "article" or "assumption"`);
  };
  const inputById = Object.fromEntries(inputs.map((i) => [i.id, i]));
  const storeIds = new Set(stores.map((s) => s.id));
  /** Parse a formula, check its numbers and the ids it reads. */
  const checkFormula = (src, where) => {
    let ast;
    try {
      ast = parse(String(src));
    } catch (e) {
      err(`${where}: ${e.message}`);
      return;
    }
    for (const num of literals(ast)) {
      if (!ALLOWED_LITERALS.includes(num)) err(`${where} uses the number ${num}. Put it in "constants" with a label and source.`);
    }
    return ast;
  };

  const needUnit = (x, where) => {
    if (typeof x.unit !== 'string') err(`${where}: unit is required. Write it as text, such as "$/yr", "kWh", "h/night", "%" or "people"; use "" for a plain number.`);
  };

  const levers = inputs.filter((i) => i.kind === 'lever');
  const conditions = inputs.filter((i) => i.kind === 'condition');
  if (levers.length < 1 || levers.length > 4) err(`model.inputs: need 1–4 levers, the choices the person really has (found ${levers.length})`);
  if (conditions.length < 1 || conditions.length > 5) err(`model.inputs: need 1–5 conditions (found ${conditions.length})`);
  inputs.forEach((i, n) => {
    const where = `model.inputs[${n}] "${i.id}"`;
    addId(i.id, where);
    if (!['lever', 'condition'].includes(i.kind)) err(`${where}: kind must be "lever" or "condition"`);
    if (!isStr(i.label)) err(`${where}: label is required`);
    if (![i.min, i.max, i.default].every(isNum)) err(`${where}: min, max and default must be numbers`);
    else if (i.min >= i.max) err(`${where}: min must be less than max`);
    else if (i.default < i.min || i.default > i.max) err(`${where}: default must be between min and max`);
    needUnit(i, where);
    checkSource(i, where);
    if (i.toggle !== undefined && (i.toggle !== true || i.min !== 0 || i.max !== 1)) err(`${where}: a toggle (yes or no) needs "toggle": true, min 0 and max 1`);
  });
  constants.forEach((c, n) => {
    const where = `model.constants[${n}] "${c.id}"`;
    addId(c.id, where);
    if (!isStr(c.label)) err(`${where}: label is required`);
    if (!isNum(c.value)) err(`${where}: value must be a number`);
    needUnit(c, where);
    checkSource(c, where);
  });
  if (outputs.length < 1 || outputs.length > 2) err(`model: need 1–2 outputs (found ${outputs.length})`);
  let formulasOk = true;
  const astOf = {};
  [...derived.map((d) => ['derived', d]), ...outputs.map((o) => ['outputs', o])].forEach(([kind, d]) => {
    const where = `model.${kind} "${d.id}"`;
    addId(d.id, where);
    if (!isStr(d.label)) err(`${where}: label is required`);
    needUnit(d, where);
    const ast = checkFormula(d.formula, `Formula for "${d.id}"`);
    if (!ast) formulasOk = false;
    else astOf[d.id] = ast;
  });
  // derived values may read stores (they change with the clock); outputs are shown as fixed numbers
  const moving = new Set();
  if (formulasOk) {
    try {
      const ordered = orderFormulas([...derived, ...outputs], [...inputs, ...constants, ...stores].map((x) => x.id));
      for (const { id, ast } of ordered) if (refs(ast).some((r) => storeIds.has(r) || moving.has(r))) moving.add(id);
      for (const o of outputs) {
        if (!moving.has(o.id)) continue;
        const via = refs(astOf[o.id]).find((r) => storeIds.has(r) || moving.has(r));
        err(`Output "${o.id}" reads ${storeIds.has(via) ? `the store "${via}"` : `"${via}", which reads a store`}, so it changes over time. Outputs are shown as fixed numbers: show this on a node, or use a milestone.`);
      }
    } catch (e) {
      err(e.message);
    }
  }
  const staticIds = new Set([...ids].filter((id) => !moving.has(id)));

  // stores and milestones
  if (stores.length > 3) err(`model.stores: at most 3 (found ${stores.length})`);
  stores.forEach((s, n) => addId(s.id, `model.stores[${n}] "${s.id}"`));
  const allIds = new Set([...ids, ...stores.map((x) => x.id)]);
  const checkRefs = (ast, where, allowed) => {
    if (!ast) return;
    for (const r of refs(ast)) if (!allowed.has(r)) err(`${where} uses unknown value "${r}"`);
  };
  stores.forEach((s, n) => {
    const where = `model.stores[${n}] "${s.id}"`;
    if (!isStr(s.label)) err(`${where}: label is required`);
    needUnit(s, where);
    if (s.start === undefined) err(`${where}: start is required (a number or formula)`);
    else checkRefs(checkFormula(s.start, `${where} start`), `${where} start`, staticIds);
    if (!isStr(s.change)) err(`${where}: change is required (how much it changes per time unit)`);
    else checkRefs(checkFormula(s.change, `${where} change`), `${where} change`, allIds);
    if (s.floor !== undefined && !isNum(s.floor)) err(`${where}: floor must be a number`);
    if (s.ceiling !== undefined) checkRefs(checkFormula(s.ceiling, `${where} ceiling`), `${where} ceiling`, staticIds);
  });
  if (milestones.length > 2) err(`model.milestones: at most 2 (found ${milestones.length})`);
  milestones.forEach((ms, n) => {
    const where = `model.milestones[${n}] "${ms.id}"`;
    addId(ms.id, where);
    if (!isStr(ms.label)) err(`${where}: label is required`);
    if (!storeIds.has(ms.store)) err(`${where}: store "${ms.store}" is not in model.stores`);
    if (ms.reaches === undefined) err(`${where}: reaches is required (the level to watch for)`);
    else checkRefs(checkFormula(ms.reaches, `${where} reaches`), `${where} reaches`, staticIds);
  });

  // ---- world
  const w = sp.world || {};
  if (!sp.world) err('world is required (time, nodes, flows)');
  if (stores.length && !w.time) err('world.time is required when the model has stores');
  if (w.time) {
    if (!TIME_UNITS.includes(w.time.unit)) err(`world.time.unit must be one of ${TIME_UNITS.join(', ')}`);
    if (!isNum(w.time.span) || w.time.span <= 0 || w.time.span > 100) err('world.time.span must be a number from 1 to 100');
  }
  const nodes = arr(w.nodes);
  const flows = arr(w.flows);
  const { nodeById, flowIds } = checkWorld(nodes, flows, err);
  nodes.forEach((nd, n) => {
    const where = `world.nodes[${n}] "${nd.id}"`;
    if (nd.plays !== undefined && !allIds.has(nd.plays)) err(`${where}: plays "${nd.plays}" is not a model value`);
    if (nd.store !== undefined && !storeIds.has(nd.store)) err(`${where}: store "${nd.store}" is not in model.stores`);
    if (nd.target !== undefined) {
      if (nd.store === undefined) err(`${where}: target only applies to store nodes`);
      checkRefs(checkFormula(nd.target, `${where} target`), `${where} target`, staticIds);
    }
    if (nd.appears !== undefined && !inputById[nd.appears]) err(`${where}: appears "${nd.appears}" must be an input (the node shows when that input is above its minimum)`);
    if (nd.groups !== undefined) {
      const crowd = nd.prop === 'crowd' || nd.kind === 'crowd';
      if (!crowd) err(`${where}: groups only work on a crowd (prop or kind "crowd")`);
      else if (nd.plays !== undefined) err(`${where}: give a crowd either "plays" (one share) or "groups" (several), not both`);
      if (!Array.isArray(nd.groups) || nd.groups.length < 1 || nd.groups.length > 4) err(`${where}: groups needs 1–4 outcomes, each {"value": <id in %>, "label": "…"}`);
      else
        nd.groups.forEach((g, k) => {
          if (!isStr(g.label)) err(`${where}: groups[${k}] needs a label`);
          if (!allIds.has(g.value)) err(`${where}: groups[${k}] value "${g.value}" is not a model value`);
          else if (![...inputs, ...derived, ...outputs].some((x) => x.id === g.value && x.unit === '%')) err(`${where}: groups[${k}] value "${g.value}" must be a share in "%"`);
        });
    }
  });
  for (const st of stores) if (!nodes.some((nd) => nd.store === st.id)) err(`model.stores "${st.id}" isn't shown: give it a node with "store": "${st.id}", or the viewer never sees it build up`);
  flows.forEach((f, n) => {
    const where = `world.flows[${n}] "${f.id}"`;
    if (typeof f.unit !== 'string') err(`${where}: unit is required, for example "kWh/yr", "$/month", "h/night" or "people/yr"`);
    if (!isStr(f.rate)) err(`${where}: rate is required (a formula)`);
    else checkRefs(checkFormula(f.rate, `${where} rate`), `${where} rate`, allIds);
  });

  // ---- ask: questions the page puts to the viewer  // ---- ask: questions the page puts to the viewer
  const ask = arr(sp.ask);
  if (sp.ask !== undefined && (!Array.isArray(sp.ask) || ask.length > 5)) err('ask: at most 5 questions');
  ask.forEach((q, n) => {
    const where = `ask[${n}]`;
    if (!isStr(q.question)) err(`${where}: question is required`);
    if (q.input !== undefined) {
      if (!inputById[q.input]) err(`${where}: input "${q.input}" is not an input`);
      else if (inputById[q.input].toggle) err(`${where}: "${q.input}" is a yes-or-no toggle; ask it with choices ("Yes" sets 1, "No" sets 0) instead of a typed number`);
    } else if (Array.isArray(q.choices)) {
      if (q.choices.length < 2 || q.choices.length > 5) err(`${where}: need 2–5 choices`);
      q.choices.forEach((c, k) => {
        if (!isStr(c.label)) err(`${where}.choices[${k}]: label is required`);
        const set = c.set && typeof c.set === 'object' ? Object.entries(c.set) : [];
        if (!set.length) err(`${where}.choices[${k}]: "set" must give at least one input a value`);
        for (const [id, v] of set) {
          const inp = inputById[id];
          if (!inp) err(`${where}.choices[${k}]: "${id}" is not an input`);
          else if (!isNum(v) || v < inp.min || v > inp.max) err(`${where}.choices[${k}]: ${id} = ${v} must be a number between ${inp.min} and ${inp.max}`);
        }
        if (c.quote !== undefined && ![].concat(c.quote).every((x) => Number.isInteger(x) && x >= 0 && x < quotes.length)) err(`${where}.choices[${k}]: quote must be an index (or list of indexes) into source.quotes`);
        if (c.source !== undefined && c.source !== 'assumption') err(`${where}.choices[${k}]: source can only be "assumption" (use "quote" for numbers from a source)`);
        // a lever set by a choice is the viewer's own choice; a condition is a fact about the world and needs a source
        const facts = set.filter(([id, v]) => inputById[id]?.kind === 'condition' && v !== inputById[id].default);
        if (facts.length && c.quote === undefined && c.source !== 'assumption') err(`${where}.choices[${k}] "${c.label}": say where its numbers for ${facts.map(([id]) => id).join(', ')} come from: "quote" (an index into source.quotes) or "source": "assumption"`);
      });
      // a viewer who doesn't know (and the recorded film) needs an answer that matches the defaults
      const isDefault = (c) => c?.set && typeof c.set === 'object' && Object.entries(c.set).every(([id, v]) => inputById[id] && v === inputById[id].default);
      if (q.choices.length && !q.choices.some(isDefault)) err(`${where}: no choice matches the default values. Add one, such as "Not sure" or "About average", that sets the defaults.`);
    } else err(`${where}: needs "input" (a number to type) or "choices"`);
  });

  // ---- explain
  const shots = arr(sp.explain);
  checkShots(shots, nodeById, flowIds, SHOTS, err);
  shots.forEach((x, n) => {
    const where = `explain[${n}]`;
    if (x.shot === 'cause' && !flowIds.has(x.focus)) err(`${where}: cause shots need focus = a flow id`);
    if (x.shot === 'timelapse') {
      if (!w.time) err(`${where}: timelapse needs world.time`);
      if (!nodeById[x.focus]?.store) err(`${where}: timelapse needs focus = a node that shows a store`);
    }
    if (x.drive !== undefined && !inputById[x.drive]) err(`${where}: drive "${x.drive}" is not an input`);
  });
  if (shots.filter((x) => x.shot === 'turn').length !== 1) err('explain: needs exactly one "turn" shot (the common misconception)');
  if (!shots.some((x) => x.shot === 'follow' || x.shot === 'cause')) err('explain: needs at least one "follow" or "cause" shot, to show the system working');
  checkStory(sp, nodes, flows, shots, err);

  // ---- simulate & decide  // ---- simulate & decide
  const controls = sp.simulate?.controls;
  if (!Array.isArray(controls) || controls.length === 0 || controls.length > 6) err('simulate.controls: list 1–6 input ids the viewer can change');
  else controls.forEach((c) => inputById[c] || err(`simulate: controls "${c}" is not an input`));
  checkDecide(sp, err);
  const compare = sp.decide?.compare;
  if (compare !== undefined) {
    if (!Array.isArray(compare) || compare.length < 2 || compare.length > 3) err('decide.compare: need 2–3 options');
    else
      compare.forEach((o, k) => {
        if (!isStr(o.label)) err(`decide.compare[${k}]: label is required`);
        for (const [id, v] of Object.entries(o.set || {})) {
          const inp = inputById[id];
          if (!inp) err(`decide.compare[${k}]: "${id}" is not an input`);
          else if (!isNum(v) || v < inp.min || v > inp.max) err(`decide.compare[${k}]: ${id} = ${v} must be between ${inp.min} and ${inp.max}`);
        }
      });
  }

  // ---- checks: what the source says the answer should look like
  const checks = sp.checks;
  if (!Array.isArray(checks) || !checks.length) {
    err('checks: list what the source says the answer looks like, so the model can be tested against it. Add at least one "between" check (a number the source gives, with its quote) and one "rises" or "falls" check (which way a value moves when an input goes up).');
  } else {
    const valueIds = new Set([...allIds, ...milestones.map((x) => x.id)]);
    let ranged = 0;
    let directed = 0;
    checks.forEach((c, n) => {
      const where = `checks[${n}]`;
      if (!isStr(c.claim)) err(`${where}: claim is required (the statement being checked, in plain words)`);
      const kinds = ['between', 'rises', 'falls', 'same'].filter((k) => c[k] !== undefined);
      if (kinds.length !== 1) return err(`${where}: give exactly one of "between", "rises", "falls" or "same"`);
      if (c.when !== undefined) {
        for (const [id, v] of Object.entries(c.when || {})) {
          const inp = inputById[id];
          if (!inp) err(`${where}: when "${id}" is not an input`);
          else if (!isNum(v) || v < inp.min || v > inp.max) err(`${where}: when ${id} = ${v} must be between ${inp.min} and ${inp.max}`);
        }
      }
      if (c.same !== undefined) {
        if (!Array.isArray(c.same) || c.same.length !== 2 || !c.same.every(isStr)) return err(`${where}: same needs two formulas that must be equal, for example ["made", "used + stored + sent"]`);
        c.same.forEach((f, k) => checkRefs(checkFormula(f, `${where} same[${k}]`), `${where} same[${k}]`, allIds));
        // a value checked against its own formula can never fail
        const flat = (x) => String(x).replace(/\s+/g, '');
        const formulaOf = Object.fromEntries([...derived, ...outputs].map((d) => [d.id, d.formula]));
        if (flat(c.same[0]) === flat(c.same[1]) || flat(formulaOf[c.same[0]]) === flat(c.same[1]) || flat(formulaOf[c.same[1]]) === flat(c.same[0])) err(`${where}: this "same" compares a value with its own formula, so it can never fail. Compare two different ways of counting the same thing (what goes in with what comes out, or the parts with the whole).`);
        return;
      }
      if (!valueIds.has(c.value)) return err(`${where}: value "${c.value}" is not a model value or milestone`);
      if (c.between !== undefined) {
        ranged++;
        const [lo, hi] = Array.isArray(c.between) ? c.between : [];
        if (!Array.isArray(c.between) || c.between.length !== 2 || ![lo, hi].every((x) => x === null || isNum(x)) || (lo === null && hi === null) || (isNum(lo) && isNum(hi) && lo > hi)) err(`${where}: between must be [low, high]; use null for an open end ("at least 20" is [20, null])`);
        const hasQuote = c.quote !== undefined;
        if (hasQuote && !(Number.isInteger(c.quote) && c.quote >= 0 && c.quote < quotes.length)) err(`${where}: quote must be an index into source.quotes`);
        if (!hasQuote && !isStr(c.reason)) err(`${where}: a between check needs "quote" (where the source says it) or "reason" (why any sensible answer falls in this range)`);
      } else {
        directed++;
        const by = c.rises ?? c.falls;
        if (!inputById[by]) err(`${where}: ${c.rises !== undefined ? 'rises' : 'falls'} "${by}" must be an input`);
        else if (by === c.value) err(`${where}: an input can't be checked against itself`);
      }
    });
    // a check that an assumption was tuned to match can't also test the model
    const tests = checks.filter((c, n) => c.between !== undefined && !fitted.has(n)).length;
    if (!ranged) err('checks: add at least one "between" check: a number or range the source gives for a result');
    else if (!tests) err(`checks: every "between" check has an assumption tuned to match it (${[...fitted.values()].join(', ')}), so none of them tests the model. Add a check on another figure the source gives.`);
    if (!directed) err('checks: add at least one "rises" or "falls" check: which way a result moves when an input goes up');
  }

  // ---- units: every formula must come out in the unit its value says it has
  if (!errors.length) unitErrors(sp).forEach(err);
  // ---- run the model: claims from the source, directions, and every extreme of the inputs
  if (!errors.length) runChecks(sp).forEach(err);
  // ---- the world must fit the story shape
  if (!errors.length) shapeErrors(sp).forEach(err);
  // ---- the best part is no part: nothing that does nothing
  if (!errors.length) deadParts(sp).forEach(err);

  bannedWords(sp, err);
  return errors;
}

/** Words we never use, in every piece of text a viewer reads. */
function bannedWords(sp, err) {
  const shots = arr(sp.explain);
  const inputs = arr(sp.model?.inputs);
  const nodes = arr(sp.world?.nodes);
  const flows = arr(sp.world?.flows);
  const ask = arr(sp.ask);
  const texts = [
    sp.question,
    sp.simulate?.prompt,
    ...shots.map((s) => s.caption),
    ...inputs.map((i) => i.label),
    ...nodes.map((n) => n.label),
    ...flows.map((f) => f.label),
    ...ask.flatMap((q) => [q.question, q.help, ...arr(q.choices).map((c) => c.label)]),
    ...['tradeoffs', 'leftOut', 'questionsToAsk'].flatMap((k) => arr(sp.decide?.[k])),
  ];
  for (const t of texts.filter(isStr)) {
    for (const [re, instead] of BANNED) {
      const hit = t.match(re);
      if (hit) err(`Avoid "${hit[0].toLowerCase()}" ("${t}"). ${instead}`);
    }
  }
}


const quoteUnit = (u) => (u === '' ? 'a plain number' : `"${u}"`);

/** Every formula must come out in the unit its value says it has. */
function unitErrors(sp) {
  const out = [];
  const m = sp.model;
  const w = sp.world;
  const units = {};
  for (const x of [...arr(m.inputs), ...arr(m.constants), ...arr(m.derived), ...arr(m.outputs), ...arr(m.stores)]) units[x.id] = parseUnit(x.unit);
  const clock = w.time ? parseUnit(w.time.unit) : null;
  for (const ms of arr(m.milestones)) units[ms.id] = clock;
  const unitOf = (id) => units[id] || null;
  const check = (src, want, inside) => {
    let ast;
    try {
      ast = parse(String(src));
    } catch {
      return;
    }
    const e = checkUnit(ast, want, unitOf, inside);
    if (e) out.push(e);
  };
  for (const d of [...arr(m.derived), ...arr(m.outputs)]) check(d.formula, units[d.id], `Formula for "${d.id}" (${quoteUnit(d.unit)})`);
  for (const st of arr(m.stores)) {
    check(st.start, units[st.id], `The start of store "${st.id}" (${quoteUnit(st.unit)})`);
    if (clock) check(st.change, per(units[st.id], clock), `The change of store "${st.id}" (${st.unit || 'a plain number'} per ${w.time.unit})`);
  }
  for (const ms of arr(m.milestones)) if (units[ms.store]) check(ms.reaches, units[ms.store], `What milestone "${ms.id}" reaches`);
  for (const nd of arr(w.nodes)) if (nd.target !== undefined && units[nd.store]) check(nd.target, units[nd.store], `The target of node "${nd.id}"`);
  for (const f of arr(w.flows)) check(f.rate, parseUnit(f.unit), `The rate of flow "${f.id}" (${quoteUnit(f.unit)})`);
  arr(sp.checks).forEach((c, n) => {
    if (!Array.isArray(c.same)) return;
    try {
      const a = unitsOf(parse(c.same[0]), unitOf, () => {});
      if (a.length === 1 && !a[0].any) check(c.same[1], a[0], `checks[${n}]: the second side of "same"`);
    } catch {}
  });
  return out;
}

/** Run the model: the source's claims, the directions, and every extreme of the inputs. */
function runChecks(sp) {
  const out = [];
  const m = sp.model;
  const w = sp.world;
  let model;
  try {
    model = createModel(m, w.time || {});
  } catch (e) {
    return [String(e.message || e)];
  }
  const inputs = arr(m.inputs);
  const byId = Object.fromEntries(inputs.map((i) => [i.id, i]));
  const defaults = model.defaults();
  const span = w.time?.span || 1;
  const label = (id) => model.meta(id)?.label || id;
  const valueAt = (id, values) => {
    const sim = model.simulate(values);
    if (Object.hasOwn(sim.reached, id)) return sim.reached[id] === null ? Infinity : sim.reached[id];
    // stores, and values that move with them, are checked at the end of the clock
    if (sim.series[id] || model.moving.includes(id)) return model.levelsAt(sim, span)[id];
    return sim.base[id] ?? NaN;
  };
  const say = (v, id) => {
    if (v === Infinity) return `never, within ${span} ${w.time?.unit || 'time unit'}s`;
    if (!Number.isFinite(v)) return 'no number (a division by zero?)';
    return formatValue(v, model.meta(id)?.unit || '');
  };
  arr(sp.checks).forEach((c, n) => {
    const where = `checks[${n}]`;
    const when = { ...defaults, ...(c.when || {}) };
    const at = c.when ? ` when ${Object.entries(c.when).map(([k, v]) => `${k} = ${v}`).join(', ')}` : ' at the default values';
    if (c.between) {
      const v = valueAt(c.value, when);
      const lo = c.between[0] ?? -Infinity;
      const hi = c.between[1] ?? Infinity;
      const want = c.between[0] === null ? `at most ${hi}` : c.between[1] === null ? `at least ${lo}` : `${lo} to ${hi}`;
      if (!(v >= lo && v <= hi)) out.push(`${where}: "${c.claim}", but the model gives ${label(c.value)} = ${say(v, c.value)}${at} (expected ${want}). Fix the formulas or the default values, not the check. If the source's own figures disagree with each other, see "When the source disagrees with itself" in story-shapes.md.`);
    } else if (c.rises || c.falls) {
      const by = byId[c.rises || c.falls];
      const up = !!c.rises;
      const pts = [0, 0.25, 0.5, 0.75, 1].map((f) => valueAt(c.value, { ...when, [by.id]: by.min + f * (by.max - by.min) }));
      const tol = (a) => (Number.isFinite(a) ? 1e-9 * (1 + Math.abs(a)) : 0);
      const steady = pts.every((v, i) => i === 0 || (up ? v >= pts[i - 1] - tol(v) : v <= pts[i - 1] + tol(v)));
      const moved = up ? pts[4] > pts[0] : pts[4] < pts[0];
      if (!steady || !moved || pts.some(Number.isNaN)) {
        out.push(`${where}: "${c.claim}", but as ${label(by.id)} goes from ${by.min} to ${by.max}, ${label(c.value)} goes ${pts.map((v) => say(v, c.value)).join(' → ')}. It should ${up ? 'rise' : 'fall'}.`);
      }
    } else if (c.same) {
      const asts = c.same.map((f) => parse(f));
      const corners = samplesOf(inputs, defaults);
      for (const values of corners) {
        const sim = model.simulate(values);
        const scope = { ...sim.base, ...model.levelsAt(sim, 0) };
        const [a, b] = asts.map((x) => model.evaluate(x, scope));
        if (Math.abs(a - b) > 0.005 * Math.max(Math.abs(a), Math.abs(b), 1e-9)) {
          out.push(`${where}: "${c.claim}", but ${c.same[0]} = ${formatValue(a)} and ${c.same[1]} = ${formatValue(b)}${values === defaults ? ' at the default values' : ` when ${describe(values, inputs)}`}. Something is counted twice or left out.`);
          break;
        }
      }
    }
  });

  // every extreme of the inputs: values must stay numbers, and flows can't run backwards
  const flows = arr(w.flows).map((f) => ({ f, ast: parse(f.rate) }));
  const values = [...arr(m.derived), ...arr(m.outputs)];
  const reported = new Set();
  for (const sample of samplesOf(inputs, defaults)) {
    const sim = model.simulate(sample);
    for (const d of values) {
      if (reported.has(d.id) || sim.base[d.id] !== null) continue;
      reported.add(d.id);
      out.push(`Formula for "${d.id}" gives no number when ${describe(sample, inputs)} (probably a division by zero). Guard the divisor, for example max(x, 1).`);
    }
    for (const tau of [0, span / 2, span]) {
      const scope = { ...sim.base, ...model.levelsAt(sim, tau) };
      for (const { f, ast } of flows) {
        if (reported.has(f.id)) continue;
        const v = model.evaluate(ast, scope);
        if (v < -1e-9 * (1 + Math.abs(v))) {
          reported.add(f.id);
          out.push(`Flow "${f.id}" runs backwards (${formatValue(v, f.unit)}) when ${describe(sample, inputs)}. A flow can't be negative: wrap the rate in max(0, …), or draw two flows, one each way.`);
        }
      }
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** The defaults, then every corner of the inputs (or each extreme in turn, when there are many). */
function samplesOf(inputs, defaults) {
  const out = [defaults];
  if (inputs.length <= 8) {
    for (let mask = 0; mask < 1 << inputs.length; mask++) out.push(Object.fromEntries(inputs.map((inp, b) => [inp.id, mask & (1 << b) ? inp.max : inp.min])));
  } else for (const inp of inputs) for (const v of [inp.min, inp.max]) out.push({ ...defaults, [inp.id]: v });
  return out;
}
const describe = (values, inputs) => inputs.map((i) => `${i.id} = ${values[i.id]}`).join(', ');

/** The world must show the story's shape. */
function shapeErrors(sp) {
  const out = [];
  const m = sp.model;
  const w = sp.world;
  const nodes = arr(w.nodes);
  const flows = arr(w.flows);
  const stores = arr(m.stores);
  const storeIds = new Set(stores.map((x) => x.id));
  const hostOf = (id) => nodes.find((n) => n.id === id)?.on || id;
  const unitById = Object.fromEntries([...arr(m.inputs), ...arr(m.constants), ...arr(m.derived), ...arr(m.outputs), ...stores].map((x) => [x.id, x.unit]));
  const outsOf = (id) => flows.filter((f) => hostOf(f.from) === id);
  const insOf = (id) => flows.filter((f) => hostOf(f.to) === id);
  const hosts = [...new Set(nodes.map((n) => hostOf(n.id)))];
  switch (sp.shape) {
    case 'build-up':
      if (!stores.length) out.push('shape "build-up": the model needs a store, the thing that piles up or runs down (savings, water in a tank, sleep debt).');
      if (!arr(sp.explain).some((x) => x.shot === 'timelapse')) out.push('shape "build-up": add a "timelapse" shot on the store, so the viewer watches it build up.');
      break;
    case 'feedback':
      // the loop may run through derived values that read the store
      const derivedRefs = Object.fromEntries(arr(m.derived).map((d) => [d.id, refs(parse(d.formula))]));
      const reaches = (ids, seen = new Set()) => ids.some((r) => storeIds.has(r) || (!seen.has(r) && derivedRefs[r] && (seen.add(r), reaches(derivedRefs[r], seen))));
      if (!stores.some((st) => reaches(refs(parse(st.change))))) out.push('shape "feedback": a store\'s change must read a store (for example interest on a balance: "balance * rate / 100"). That is the loop.');
      break;
    case 'conversion':
      if (!hosts.some((h) => insOf(h).length && outsOf(h).length)) out.push('shape "conversion": one node must take something in and send something out (fuel in, power out), so the chain is visible.');
      break;
    case 'budget':
      if (!hosts.some((h) => {
        const units = outsOf(h).map((f) => f.unit);
        return units.some((u, i) => units.indexOf(u) !== i);
      })) out.push('shape "budget": one node must split a fixed amount into two or more flows in the same unit (hours of the day, a household\'s pay).');
      break;
    case 'cause':
      if (!flows.some((f) => f.carrier === 'influence')) out.push('shape "cause": draw each cause as a flow with carrier "influence", from the cause to what it changes, with the size of the effect as its rate.');
      break;
    case 'chances':
      if (!nodes.some((n) => (n.prop === 'crowd' || n.kind === 'crowd') && (n.groups || /^%$|percent/.test(String(unitById[n.plays] ?? ''))))) out.push('shape "chances": show the result as a crowd of 100 people: a node with prop "crowd" that plays a value in "%", or one crowd with "groups" for several outcomes.');
      break;
  }
  for (const nd of nodes) {
    if (!nd.store || nd.prop !== 'jar') continue;
    const u = parseUnit(unitById[nd.store] ?? '');
    if (u && !Object.keys(u.d).some((k) => MONEY.has(k))) out.push(`world node "${nd.id}": a jar of coins only suits money, but store "${nd.store}" is in "${unitById[nd.store]}". Use prop "tank", or leave out prop and the renderer picks one from the unit.`);
  }
  return out;
}

/** A process story: steps with no numbers to run. Explain and Decide only. */
function validateProcess(sp) {
  const errors = [];
  const err = (msg) => errors.push(msg);
  for (const k of ['model', 'ask', 'simulate', 'checks']) {
    if (sp[k] !== undefined) err(`${k}: a process story has no numbers to run, so leave out "${k}". If the article gives numbers a reader could change, pick another shape.`);
  }
  if (sp.decide?.compare !== undefined) err('decide.compare: a process story has no numbers to compare. Describe the options in "tradeoffs" instead.');
  const w = sp.world || {};
  if (!sp.world) err('world is required (nodes, flows)');
  if (w.time !== undefined) err('world.time: a process story has no clock, so leave it out');
  const nodes = arr(w.nodes);
  const flows = arr(w.flows);
  const { nodeById, flowIds } = checkWorld(nodes, flows, err);
  nodes.forEach((nd, n) => {
    for (const k of ['plays', 'store', 'appears', 'target', 'groups']) if (nd[k] !== undefined) err(`world.nodes[${n}] "${nd.id}": "${k}" needs numbers; a process story has none, so leave it out`);
  });
  if (!errors.length) deadParts(sp).forEach(err);
  flows.forEach((f, n) => {
    if (f.rate !== undefined) err(`world.flows[${n}] "${f.id}": a process story has no rates; leave out "rate" (every step flows at the same pace)`);
  });
  const shots = arr(sp.explain);
  checkShots(shots, nodeById, flowIds, SHOTS.filter((x) => !['cause', 'timelapse'].includes(x)), err, ' (a process story has no numbers to sweep or clock to run)');
  shots.forEach((x, n) => {
    if (x.drive !== undefined) err(`explain[${n}]: drive needs an input; a process story has none`);
  });
  if (shots.filter((x) => x.shot === 'turn').length > 1) err('explain: at most one "turn" shot');
  if (!shots.some((x) => x.shot === 'follow')) err('explain: needs at least one "follow" shot, to walk through a step');
  checkStory(sp, nodes, flows, shots, err);
  checkDecide(sp, err);
  bannedWords(sp, err);
  return errors;
}

/** What every story's world needs: unique ids, labels, a look for each node, and flows between real nodes. */
function checkWorld(nodes, flows, err) {
  if (nodes.length < 2 || nodes.length > 10) err(`world.nodes: need 2–10 (found ${nodes.length})`);
  const nodeById = {};
  nodes.forEach((nd, n) => {
    const where = `world.nodes[${n}] "${nd.id}"`;
    if (!ID.test(nd.id || '') || nodeById[nd.id]) err(`${where}: id must be unique letters, digits or _`);
    nodeById[nd.id] = nd;
    if (!isStr(nd.label)) err(`${where}: label is required`);
    if (nd.recipe !== undefined) {
      if (!Array.isArray(nd.recipe) || nd.recipe.length === 0 || nd.recipe.length > 12) err(`${where}: recipe needs 1–12 shapes`);
      else
        nd.recipe.forEach((p, k) => {
          if (!SHAPES.includes(p.shape)) err(`${where}: recipe[${k}] shape "${p.shape}" must be one of ${SHAPES.join(', ')}`);
          if (!Array.isArray(p.size) || p.size.length !== 3 || !p.size.every(isNum)) err(`${where}: recipe[${k}] size must be [x, y, z]`);
        });
    } else if (nd.url !== undefined) {
      if (!isStr(nd.url) || !isStr(nd.credit)) err(`${where}: open-library props need "url" and "credit"`);
    } else if (nd.prop !== undefined) {
      if (!PROPS.includes(nd.prop)) err(`${where}: prop "${nd.prop}" is not in the catalog (${PROPS.join(', ')}). Give a "kind" instead, or a "recipe".`);
    } else if (nd.kind === undefined && nd.store === undefined) err(`${where}: needs a "prop", a "kind" (${KINDS.join(', ')}), or a "recipe"`);
    if (nd.kind !== undefined && !KINDS.includes(nd.kind)) err(`${where}: kind "${nd.kind}" must be one of ${KINDS.join(', ')}`);
    if (nd.sky !== undefined && typeof nd.sky !== 'boolean') err(`${where}: sky must be true or false`);
  });
  nodes.forEach((nd, n) => {
    if (nd.on === undefined) return;
    const host = nodeById[nd.on];
    if (!host || nd.on === nd.id) err(`world.nodes[${n}] "${nd.id}": on "${nd.on}" must be another node`);
    else if (host.on !== undefined) err(`world.nodes[${n}] "${nd.id}": can't sit on "${nd.on}", which already sits on another node`);
  });
  if (flows.length < 1 || flows.length > 12) err(`world.flows: need 1–12 (found ${flows.length})`);
  const flowIds = new Set();
  flows.forEach((f, n) => {
    const where = `world.flows[${n}] "${f.id}"`;
    if (!ID.test(f.id || '') || flowIds.has(f.id) || nodeById[f.id]) err(`${where}: id must be unique (and not a node id)`);
    flowIds.add(f.id);
    if (!nodeById[f.from]) err(`${where}: from "${f.from}" is not a node`);
    if (!nodeById[f.to]) err(`${where}: to "${f.to}" is not a node`);
    if (f.from === f.to) err(`${where}: from and to must be different nodes`);
    if (!CARRIERS.includes(f.carrier)) err(`${where}: carrier must be one of ${CARRIERS.join(', ')}`);
    if (!isStr(f.label)) err(`${where}: label is required`);
  });
  return { nodeById, flowIds };
}

/** What every film's shots need: a known shot type, something to look at, and a short caption. */
function checkShots(shots, nodeById, flowIds, allowed, err, why = '') {
  if (shots.length < 3 || shots.length > 12) err(`explain: need 3–12 shots (found ${shots.length})`);
  shots.forEach((x, n) => {
    const where = `explain[${n}]`;
    if (!allowed.includes(x.shot)) err(`${where}: shot "${x.shot}" must be one of ${allowed.join(', ')}${why}`);
    if (x.focus === undefined) {
      if (!['establish', 'handoff'].includes(x.shot)) err(`${where}: focus is required (a node or flow id)`);
    } else if (!nodeById[x.focus] && !flowIds.has(x.focus)) err(`${where}: focus "${x.focus}" is not a node or flow`);
    if (x.shot === 'follow' && !flowIds.has(x.focus)) err(`${where}: follow shots need focus = a flow id`);
    if (!isStr(x.caption)) err(`${where}: caption is required`);
    else if (words(x.caption) > MAX_CAPTION_WORDS) err(`${where}: caption has ${words(x.caption)} words (max ${MAX_CAPTION_WORDS} words)`);
  });
  if (!shots.some((x) => x.shot === 'establish')) err('explain: needs an "establish" shot');
}

/** Decide always weighs the choice: trade-offs, limits and questions, never a recommendation. */
function checkDecide(sp, err) {
  for (const key of ['tradeoffs', 'leftOut', 'questionsToAsk']) {
    const list = sp.decide?.[key];
    if (!Array.isArray(list) || list.length < 1 || list.length > 6 || !list.every(isStr)) err(`decide.${key}: need 1–6 sentences`);
  }
}

/**
 * The best part is no part. A value no formula reads, or a character no flow touches,
 * costs the viewer attention and explains nothing: the validator asks for it to go.
 */
function deadParts(sp) {
  const out = [];
  const m = sp.model || {};
  const w = sp.world || {};
  const nodes = arr(w.nodes);
  const flows = arr(w.flows);
  // every value something reads: formulas, what nodes show, and what checks test
  const read = new Set();
  const formulas = [
    ...arr(m.derived).map((d) => d.formula),
    ...arr(m.outputs).map((o) => o.formula),
    ...arr(m.stores).flatMap((st) => [st.start, st.change, st.ceiling]),
    ...arr(m.milestones).map((ms) => ms.reaches),
    ...nodes.map((nd) => nd.target),
    ...flows.map((f) => f.rate),
    ...arr(sp.checks).flatMap((c) => c.same || []),
  ].filter((f) => f !== undefined);
  for (const f of formulas) {
    try {
      refs(parse(String(f))).forEach((r) => read.add(r));
    } catch {}
  }
  for (const nd of nodes) {
    if (nd.plays) read.add(nd.plays);
    arr(nd.groups).forEach((g) => read.add(g.value));
  }
  for (const c of arr(sp.checks)) if (c.value) read.add(c.value);
  for (const i of arr(m.inputs)) if (!read.has(i.id)) out.push(`model.inputs "${i.id}" changes nothing: no formula reads it and no node shows it. Remove it (and its slider and questions), or use it.`);
  for (const c of arr(m.constants)) if (!read.has(c.id)) out.push(`model.constants "${c.id}" is never used. Remove it.`);
  for (const d of arr(m.derived)) if (!read.has(d.id)) out.push(`model.derived "${d.id}" is never used by a formula, a node, a flow or a check. Remove it.`);
  // every character takes part in a flow (a store's node may stand alone: it shows the result)
  const touched = new Set(flows.flatMap((f) => [f.from, f.to]));
  for (const nd of nodes) {
    if (touched.has(nd.id) || nd.store) continue;
    if (nodes.some((x) => x.on === nd.id && touched.has(x.id))) continue; // a host whose mounted part has flows
    out.push(`world node "${nd.id}" takes part in no flow. Every character should send, receive or turn something; remove it, or show what moves to or from it.`);
  }
  return out;
}

/**
 * Every film has a hero the viewer stands in for, and is shot like a story: it opens on
 * the hero, goes out into the world, and comes back to the hero before handing over.
 * See references/storytelling.md.
 */
function checkStory(sp, nodes, flows, shots, err) {
  const st = sp.story;
  if (!st || typeof st !== 'object') return err('story is required: {"hero": <node id>, "logline": "…"}. Find the story before the world: see references/storytelling.md.');
  if (!isStr(st.logline)) err('story.logline is required: one sentence with the hero, what they want, what they don\'t know yet, and the discovery');
  else if (words(st.logline) > 35) err(`story.logline has ${words(st.logline)} words (max 35)`);
  const hero = nodes.find((n) => n.id === st.hero);
  if (!hero) return err(`story.hero "${st.hero}" must be a node: the person or home the viewer stands in for`);
  if (hero.sky) err(`story.hero "${st.hero}" can't be in the sky: the hero is someone on the ground the viewer stands in for`);
  const PEOPLE_PROPS = ['person-figure', 'body', 'crowd', 'house'];
  const PEOPLE_KINDS = ['person', 'body', 'crowd', 'home'];
  if (!PEOPLE_PROPS.includes(hero.prop) && !PEOPLE_KINDS.includes(hero.kind)) err(`story.hero "${st.hero}" must be someone the viewer can stand in for: a person, a body, a crowd or a home (prop ${PEOPLE_PROPS.join(', ')}, or kind ${PEOPLE_KINDS.join(', ')})`);
  const hostOf = (id) => nodes.find((n) => n.id === id)?.on || id;
  const isHero = (id) => id === hero.id || hostOf(id) === hero.id || hostOf(hero.id) === id;
  const involves = (x) => {
    if (!x?.focus) return false;
    const f = flows.find((g) => g.id === x.focus);
    return f ? isHero(f.from) || isHero(f.to) : isHero(x.focus);
  };
  const inner = shots.filter((x) => !['establish', 'handoff'].includes(x.shot));
  if (!inner.length) return;
  if (!involves(inner[0])) err(`story: open on the hero. Make the first shot after "establish" about "${hero.id}" (focus on it, or on a flow to or from it), not "${inner[0].focus}".`);
  if (!involves(inner.at(-1))) err(`story: end with the hero. Make the last shot before "handoff" about "${hero.id}" again, so the film comes back to the person it started with (now: "${inner.at(-1).focus}").`);
}
