// Checks a screenplay and returns plain-English errors. Empty array = valid.
// The renderer refuses to play anything that fails here.
import { parse, orderFormulas } from './formula.js';

export const SHOTS = ['establish', 'introduce', 'focus', 'cause', 'compare', 'turn', 'handoff'];
export const SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus'];
export const CAST_SOURCES = ['studio', 'open', 'custom'];
export const BANNED = [/\bgamif\w*/i, /\bengagement\b/i];
export const MAX_CAPTION_WORDS = 12;
// Plain unit conversions may appear inside formulas; every other number must be a named constant.
export const ALLOWED_LITERALS = [0, 1, 2, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000];

const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = ['min', 'max', 'round'];
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
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

/** @param {any} sp */
export function validate(sp) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!sp || typeof sp !== 'object' || Array.isArray(sp)) return ['Screenplay must be a JSON object'];

  if (sp.version !== 1) err('version must be 1');
  if (!isStr(sp.question)) err('question is required');
  const quotes = Array.isArray(sp.source?.quotes) ? sp.source.quotes : [];
  if (!sp.source || typeof sp.source !== 'object') err('source is required (title, url, quotes)');

  // ---- model
  const m = sp.model || {};
  const inputs = Array.isArray(m.inputs) ? m.inputs : [];
  const constants = Array.isArray(m.constants) ? m.constants : [];
  const derived = Array.isArray(m.derived) ? m.derived : [];
  const outputs = Array.isArray(m.outputs) ? m.outputs : [];
  if (!sp.model) err('model is required');

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

  const levers = inputs.filter((i) => i.kind === 'lever');
  const conditions = inputs.filter((i) => i.kind === 'condition');
  if (levers.length < 2 || levers.length > 4) err(`model.inputs: need 2–4 levers (found ${levers.length})`);
  if (conditions.length < 1 || conditions.length > 3) err(`model.inputs: need 1–3 conditions (found ${conditions.length})`);
  inputs.forEach((i, n) => {
    const where = `model.inputs[${n}] "${i.id}"`;
    addId(i.id, where);
    if (!['lever', 'condition'].includes(i.kind)) err(`${where}: kind must be "lever" or "condition"`);
    if (!isStr(i.label)) err(`${where}: label is required`);
    if (![i.min, i.max, i.default].every(isNum)) err(`${where}: min, max and default must be numbers`);
    else {
      if (i.min >= i.max) err(`${where}: min must be less than max`);
      else if (i.default < i.min || i.default > i.max) err(`${where}: default must be between min and max`);
    }
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
  [...derived.map((d) => ['derived', d]), ...outputs.map((o) => ['outputs', o])].forEach(([kind, d], n) => {
    const where = `model.${kind} "${d.id}"`;
    addId(d.id, where);
    if (!isStr(d.label)) err(`${where}: label is required`);
    try {
      for (const num of literals(parse(d.formula))) {
        if (!ALLOWED_LITERALS.includes(num)) err(`Formula for "${d.id}" uses the number ${num}. Put it in "constants" with a label and source.`);
      }
    } catch (e) {
      err(`Formula for "${d.id}": ${e.message}`);
    }
  });
  if (!errors.some((e) => e.startsWith('Formula'))) {
    try {
      orderFormulas([...derived, ...outputs], [...inputs, ...constants].map((x) => x.id));
    } catch (e) {
      err(e.message);
    }
  }

  // ---- cast
  const cast = Array.isArray(sp.cast) ? sp.cast : [];
  if (cast.length < 2 || cast.length > 10) err(`cast: need 2–10 actors (found ${cast.length})`);
  const castIds = new Set();
  cast.forEach((c, n) => {
    const where = `cast[${n}] "${c.id}"`;
    if (!ID.test(c.id || '') || castIds.has(c.id)) err(`${where}: id must be unique letters, digits or _`);
    castIds.add(c.id);
    if (c.plays !== undefined && !ids.has(c.plays)) err(`${where}: plays "${c.plays}" is not a model value`);
    if (!CAST_SOURCES.includes(c.source)) err(`${where}: source must be studio, open or custom`);
    if (c.source === 'studio' && !isStr(c.actor)) err(`${where}: studio actors need "actor"`);
    if (c.source === 'open' && (!isStr(c.url) || !isStr(c.credit))) err(`${where}: open-library actors need "url" and "credit"`);
    if (c.source === 'custom') {
      if (!Array.isArray(c.recipe) || c.recipe.length === 0 || c.recipe.length > 12) err(`${where}: custom actors need a "recipe" of 1–12 shapes`);
      else
        c.recipe.forEach((p, k) => {
          if (!SHAPES.includes(p.shape)) err(`${where}: recipe[${k}] shape "${p.shape}" must be one of ${SHAPES.join(', ')}`);
          if (!Array.isArray(p.size) || p.size.length !== 3 || !p.size.every(isNum)) err(`${where}: recipe[${k}] size must be [x, y, z]`);
        });
    }
  });

  // ---- explain
  const shots = Array.isArray(sp.explain) ? sp.explain : [];
  if (shots.length < 3 || shots.length > 12) err(`explain: need 3–12 shots (found ${shots.length})`);
  shots.forEach((s, n) => {
    const where = `explain[${n}]`;
    if (!SHOTS.includes(s.shot)) err(`${where}: shot "${s.shot}" must be one of ${SHOTS.join(', ')}`);
    if (!castIds.has(s.focus)) err(`${where}: focus "${s.focus}" is not in cast`);
    if (s.shot === 'cause' && !castIds.has(s.affects)) err(`${where}: cause shots need "affects" = a cast id`);
    if (!isStr(s.caption)) err(`${where}: caption is required`);
    else if (words(s.caption) > MAX_CAPTION_WORDS) err(`${where}: caption has ${words(s.caption)} words (max ${MAX_CAPTION_WORDS} words)`);
  });
  if (shots.filter((s) => s.shot === 'turn').length !== 1) err('explain: needs exactly one "turn" shot (the common misconception)');
  if (!shots.some((s) => s.shot === 'establish')) err('explain: needs an "establish" shot');

  // ---- simulate & decide
  const controls = sp.simulate?.controls;
  if (!Array.isArray(controls) || controls.length === 0) err('simulate.controls: list the input ids the viewer can change');
  else controls.forEach((c) => inputs.some((i) => i.id === c) || err(`simulate: controls "${c}" is not an input`));
  for (const key of ['tradeoffs', 'leftOut', 'questionsToAsk']) {
    const list = sp.decide?.[key];
    if (!Array.isArray(list) || list.length < 1 || list.length > 6 || !list.every(isStr)) err(`decide.${key}: need 1–6 sentences`);
  }

  // ---- words we never use
  const texts = [sp.question, sp.simulate?.prompt, ...shots.map((s) => s.caption), ...inputs.map((i) => i.label), ...['tradeoffs', 'leftOut', 'questionsToAsk'].flatMap((k) => (Array.isArray(sp.decide?.[k]) ? sp.decide[k] : []))];
  for (const t of texts.filter(isStr)) {
    for (const re of BANNED) {
      const hit = t.match(re);
      if (hit) err(`Avoid the word "${hit[0].toLowerCase()}" ("${t}"). Say "understanding" instead.`);
    }
  }
  return errors;
}
