// Checks a screenplay and returns plain-English errors. Empty array = valid.
// The renderer refuses to play anything that fails here.
import { parse, refs, orderFormulas } from './formula.js';
import { PROPS } from './cast/names.js';

export const SHOTS = ['establish', 'introduce', 'focus', 'follow', 'cause', 'compare', 'turn', 'timelapse', 'handoff'];
export const CARRIERS = ['energy', 'money', 'water', 'heat', 'light', 'goods', 'people', 'data'];
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
export const ALLOWED_LITERALS = [0, 1, 2, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000];

const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = ['min', 'max', 'round'];
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
  const quotes = arr(sp.source?.quotes);
  quotes.forEach((q, n) => {
    const where = `source.quotes[${n}]`;
    if (!isStr(quoteText(q))) return err(`${where}: must be a sentence, or {"text", "url", "publisher", "accessed"}`);
    if (typeof q !== 'object') return;
    // a researched figure: the reader must be able to open the page and see when it was read
    if (!/^https?:\/\//.test(q.url || '')) err(`${where}: a researched quote needs "url", the page you opened`);
    if (!DATE.test(q.accessed || '')) err(`${where}: a researched quote needs "accessed", the date you read the page (YYYY-MM-DD)`);
  });

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
  const checkSource = (x, where) => {
    if (x.source === 'article') {
      if (!Number.isInteger(x.quote) || x.quote < 0 || x.quote >= quotes.length) err(`${where}: source "article" needs "quote" = index into source.quotes`);
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

  const levers = inputs.filter((i) => i.kind === 'lever');
  const conditions = inputs.filter((i) => i.kind === 'condition');
  if (levers.length < 2 || levers.length > 4) err(`model.inputs: need 2–4 levers (found ${levers.length})`);
  if (conditions.length < 1 || conditions.length > 5) err(`model.inputs: need 1–5 conditions (found ${conditions.length})`);
  inputs.forEach((i, n) => {
    const where = `model.inputs[${n}] "${i.id}"`;
    addId(i.id, where);
    if (!['lever', 'condition'].includes(i.kind)) err(`${where}: kind must be "lever" or "condition"`);
    if (!isStr(i.label)) err(`${where}: label is required`);
    if (![i.min, i.max, i.default].every(isNum)) err(`${where}: min, max and default must be numbers`);
    else if (i.min >= i.max) err(`${where}: min must be less than max`);
    else if (i.default < i.min || i.default > i.max) err(`${where}: default must be between min and max`);
    checkSource(i, where);
  });
  constants.forEach((c, n) => {
    const where = `model.constants[${n}] "${c.id}"`;
    addId(c.id, where);
    if (!isStr(c.label)) err(`${where}: label is required`);
    if (!isNum(c.value)) err(`${where}: value must be a number`);
    checkSource(c, where);
  });
  if (outputs.length < 1 || outputs.length > 2) err(`model: need 1–2 outputs (found ${outputs.length})`);
  let formulasOk = true;
  [...derived.map((d) => ['derived', d]), ...outputs.map((o) => ['outputs', o])].forEach(([kind, d]) => {
    const where = `model.${kind} "${d.id}"`;
    addId(d.id, where);
    if (!isStr(d.label)) err(`${where}: label is required`);
    const ast = checkFormula(d.formula, `Formula for "${d.id}"`);
    if (!ast) formulasOk = false;
    else
      for (const r of refs(ast))
        if (storeIds.has(r)) {
          err(`Formula for "${d.id}" reads the store "${r}". Derived values and outputs can't change over time: read stores in flows, store changes or milestones.`);
          formulasOk = false;
        }
  });
  if (formulasOk) {
    try {
      orderFormulas([...derived, ...outputs], [...inputs, ...constants].map((x) => x.id));
    } catch (e) {
      err(e.message);
    }
  }
  const staticIds = new Set(ids);

  // stores and milestones
  if (stores.length > 3) err(`model.stores: at most 3 (found ${stores.length})`);
  stores.forEach((s, n) => addId(s.id, `model.stores[${n}] "${s.id}"`));
  const allIds = new Set(ids);
  const checkRefs = (ast, where, allowed) => {
    if (!ast) return;
    for (const r of refs(ast)) if (!allowed.has(r)) err(`${where} uses unknown value "${r}"`);
  };
  stores.forEach((s, n) => {
    const where = `model.stores[${n}] "${s.id}"`;
    if (!isStr(s.label)) err(`${where}: label is required`);
    if (s.start === undefined) err(`${where}: start is required (a number or formula)`);
    else checkRefs(checkFormula(s.start, `${where} start`), `${where} start`, staticIds);
    if (!isStr(s.change)) err(`${where}: change is required (how much it changes per time unit)`);
    else checkRefs(checkFormula(s.change, `${where} change`), `${where} change`, allIds);
    if (s.floor !== undefined && !isNum(s.floor)) err(`${where}: floor must be a number`);
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
    } else if (!PROPS.includes(nd.prop)) err(`${where}: prop "${nd.prop}" is not in the catalog (${PROPS.join(', ')}). Use a "recipe" for anything else.`);
    if (nd.plays !== undefined && !allIds.has(nd.plays)) err(`${where}: plays "${nd.plays}" is not a model value`);
    if (nd.store !== undefined && !storeIds.has(nd.store)) err(`${where}: store "${nd.store}" is not in model.stores`);
    if (nd.target !== undefined) {
      if (nd.store === undefined) err(`${where}: target only applies to store nodes`);
      checkRefs(checkFormula(nd.target, `${where} target`), `${where} target`, staticIds);
    }
    if (nd.appears !== undefined && !inputById[nd.appears]) err(`${where}: appears "${nd.appears}" must be an input (the node shows when that input is above its minimum)`);
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
    if (!isStr(f.rate)) err(`${where}: rate is required (a formula)`);
    else checkRefs(checkFormula(f.rate, `${where} rate`), `${where} rate`, allIds);
  });

  // ---- ask: questions the page puts to the viewer
  const ask = arr(sp.ask);
  if (sp.ask !== undefined && (!Array.isArray(sp.ask) || ask.length > 5)) err('ask: at most 5 questions');
  ask.forEach((q, n) => {
    const where = `ask[${n}]`;
    if (!isStr(q.question)) err(`${where}: question is required`);
    if (q.input !== undefined) {
      if (!inputById[q.input]) err(`${where}: input "${q.input}" is not an input`);
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
      });
      // a viewer who doesn't know (and the recorded film) needs an answer that matches the defaults
      const isDefault = (c) => c?.set && typeof c.set === 'object' && Object.entries(c.set).every(([id, v]) => inputById[id] && v === inputById[id].default);
      if (q.choices.length && !q.choices.some(isDefault)) err(`${where}: no choice matches the default values. Add one, such as "Not sure" or "About average", that sets the defaults.`);
    } else err(`${where}: needs "input" (a number to type) or "choices"`);
  });

  // ---- explain
  const shots = arr(sp.explain);
  if (shots.length < 3 || shots.length > 12) err(`explain: need 3–12 shots (found ${shots.length})`);
  shots.forEach((s, n) => {
    const where = `explain[${n}]`;
    if (!SHOTS.includes(s.shot)) err(`${where}: shot "${s.shot}" must be one of ${SHOTS.join(', ')}`);
    const wide = ['establish', 'handoff'].includes(s.shot);
    if (s.focus === undefined) {
      if (!wide) err(`${where}: focus is required (a node or flow id)`);
    } else if (!nodeById[s.focus] && !flowIds.has(s.focus)) err(`${where}: focus "${s.focus}" is not a node or flow`);
    if (['follow', 'cause'].includes(s.shot) && !flowIds.has(s.focus)) err(`${where}: ${s.shot} shots need focus = a flow id`);
    if (s.shot === 'timelapse') {
      if (!w.time) err(`${where}: timelapse needs world.time`);
      if (!nodeById[s.focus]?.store) err(`${where}: timelapse needs focus = a node that shows a store`);
    }
    if (s.drive !== undefined && !inputById[s.drive]) err(`${where}: drive "${s.drive}" is not an input`);
    if (!isStr(s.caption)) err(`${where}: caption is required`);
    else if (words(s.caption) > MAX_CAPTION_WORDS) err(`${where}: caption has ${words(s.caption)} words (max ${MAX_CAPTION_WORDS} words)`);
  });
  if (shots.filter((s) => s.shot === 'turn').length !== 1) err('explain: needs exactly one "turn" shot (the common misconception)');
  if (!shots.some((s) => s.shot === 'establish')) err('explain: needs an "establish" shot');
  if (!shots.some((s) => s.shot === 'follow' || s.shot === 'cause')) err('explain: needs at least one "follow" or "cause" shot, to show the system working');

  // ---- simulate & decide
  const controls = sp.simulate?.controls;
  if (!Array.isArray(controls) || controls.length === 0 || controls.length > 6) err('simulate.controls: list 1–6 input ids the viewer can change');
  else controls.forEach((c) => inputById[c] || err(`simulate: controls "${c}" is not an input`));
  for (const key of ['tradeoffs', 'leftOut', 'questionsToAsk']) {
    const list = sp.decide?.[key];
    if (!Array.isArray(list) || list.length < 1 || list.length > 6 || !list.every(isStr)) err(`decide.${key}: need 1–6 sentences`);
  }
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

  // ---- words we never use
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
  return errors;
}
