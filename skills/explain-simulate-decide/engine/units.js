// Units: reads unit text such as "$/kWh", "kWh/yr", "h a night" or "people per 1,000"
// and checks that every formula comes out in the unit its value says it has.
// Works for any topic: known units (time, energy, money, mass…) convert properly, and
// any other word ("cigarettes", "patients", "trees") becomes its own countable thing.
// Pure, no dependencies beyond the formula parser's tree.

const LOG = Math.log10;
const TOL = LOG(1.025); // conversions such as ×30 days a month are close, not exact

// symbol or word → [base dimension(s), size in base units]
const T = 1; // seconds
const DAY = 86400;
const YEAR = 365 * DAY;
const KNOWN = {
  // time
  s: ['time', T], sec: ['time', T], second: ['time', T],
  min: ['time', 60], minute: ['time', 60],
  h: ['time', 3600], hr: ['time', 3600], hour: ['time', 3600],
  d: ['time', DAY], day: ['time', DAY], night: ['time', DAY], daily: ['time', DAY],
  wk: ['time', 7 * DAY], week: ['time', 7 * DAY], weekly: ['time', 7 * DAY],
  mo: ['time', YEAR / 12], month: ['time', YEAR / 12], monthly: ['time', YEAR / 12],
  y: ['time', YEAR], yr: ['time', YEAR], year: ['time', YEAR], annum: ['time', YEAR], annual: ['time', YEAR], yearly: ['time', YEAR],
  decade: ['time', 10 * YEAR], century: ['time', 100 * YEAR],
  // energy and power
  J: ['energy', 1], kJ: ['energy', 1e3], MJ: ['energy', 1e6], GJ: ['energy', 1e9], joule: ['energy', 1],
  Wh: ['energy', 3600], kWh: ['energy', 3.6e6], MWh: ['energy', 3.6e9], GWh: ['energy', 3.6e12], TWh: ['energy', 3.6e15],
  // food calories are kilocalories
  cal: ['energy', 4184], kcal: ['energy', 4184], calorie: ['energy', 4184], kilocalorie: ['energy', 4184],
  BTU: ['energy', 1055], btu: ['energy', 1055], therm: ['energy', 1.055e8],
  W: [{ energy: 1, time: -1 }, 1], kW: [{ energy: 1, time: -1 }, 1e3], MW: [{ energy: 1, time: -1 }, 1e6], GW: [{ energy: 1, time: -1 }, 1e9],
  watt: [{ energy: 1, time: -1 }, 1], kilowatt: [{ energy: 1, time: -1 }, 1e3], megawatt: [{ energy: 1, time: -1 }, 1e6],
  // mass
  mg: ['mass', 1e-6], g: ['mass', 1e-3], gram: ['mass', 1e-3], kg: ['mass', 1], kilogram: ['mass', 1], kilo: ['mass', 1],
  t: ['mass', 1000], tonne: ['mass', 1000], ton: ['mass', 1000], Mt: ['mass', 1e9], Gt: ['mass', 1e12],
  lb: ['mass', 0.4536], pound: ['mass', 0.4536], oz: ['mass', 0.02835], ounce: ['mass', 0.02835],
  // length, area, volume
  mm: ['length', 1e-3], cm: ['length', 1e-2], m: ['length', 1], metre: ['length', 1], meter: ['length', 1],
  km: ['length', 1e3], kilometre: ['length', 1e3], kilometer: ['length', 1e3],
  mi: ['length', 1609.34], mile: ['length', 1609.34], ft: ['length', 0.3048], foot: ['length', 0.3048], feet: ['length', 0.3048], inch: ['length', 0.0254],
  ha: [{ length: 2 }, 1e4], hectare: [{ length: 2 }, 1e4], acre: [{ length: 2 }, 4046.86],
  mL: [{ length: 3 }, 1e-6], ml: [{ length: 3 }, 1e-6], L: [{ length: 3 }, 1e-3], l: [{ length: 3 }, 1e-3],
  litre: [{ length: 3 }, 1e-3], liter: [{ length: 3 }, 1e-3], kL: [{ length: 3 }, 1], ML: [{ length: 3 }, 1e3],
  gal: [{ length: 3 }, 3.785e-3], gallon: [{ length: 3 }, 3.785e-3],
  // temperature differences
  '°C': ['temperature', 1], degC: ['temperature', 1], celsius: ['temperature', 1], K: ['temperature', 1], kelvin: ['temperature', 1],
  '°F': ['temperature', 5 / 9], degF: ['temperature', 5 / 9], fahrenheit: ['temperature', 5 / 9], degree: ['temperature', 1], '°': ['temperature', 1],
  // money: each currency is its own thing, so dollars never mix with euros by accident
  $: ['$', 1], USD: ['$', 1], AUD: ['$', 1], CAD: ['$', 1], NZD: ['$', 1], dollar: ['$', 1], cent: ['$', 0.01], '¢': ['$', 0.01],
  '€': ['€', 1], EUR: ['€', 1], euro: ['€', 1], '£': ['£', 1], GBP: ['£', 1], sterling: ['£', 1], p: ['£', 0.01], pence: ['£', 0.01],
  '¥': ['¥', 1], JPY: ['¥', 1], CNY: ['¥', 1], yuan: ['¥', 1], yen: ['¥', 1], '₹': ['₹', 1], INR: ['₹', 1], rupee: ['₹', 1],
  // plain numbers
  '%': [{}, 0.01], percent: [{}, 0.01], pct: [{}, 0.01], pp: [{}, 0.01], ppm: [{}, 1e-6],
  '×': [{}, 1], x: [{}, 1], times: [{}, 1], fold: [{}, 1], ratio: [{}, 1], share: [{}, 1], fraction: [{}, 1],
  // a few long-form prefixes
  k: [{}, 1e3], thousand: [{}, 1e3], million: [{}, 1e6], billion: [{}, 1e9],
};
const IRREGULAR = { people: 'person', persons: 'person', children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse', lives: 'life' };
const FILLER = new Set(['of', 'the', 'your', 'my', 'in', 'on', 'for', 'to', 'at', 'from', 'used', 'spent', 'worth']);

/** A word with no known unit becomes its own countable thing ("trees", "patients"). */
function thing(word) {
  let w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

function lookup(token) {
  if (Object.hasOwn(KNOWN, token)) return KNOWN[token];
  const low = token.toLowerCase();
  if (Object.hasOwn(KNOWN, low) && !/^[A-Z]/.test(token.slice(1))) return KNOWN[low];
  const one = thing(token);
  if (Object.hasOwn(KNOWN, one)) return KNOWN[one];
  return null;
}

const addDims = (a, b, sign = 1) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] || 0) + sign * v;
    if (Math.abs(out[k]) < 1e-9) delete out[k];
  }
  return out;
};
const scaleDims = (d, p) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v * p]));

/**
 * Read unit text into dimensions and a size: { d: {time: -1, energy: 1}, k: log10(size) }.
 * "" means a plain number. Returns null for anything that isn't text.
 * @param {string} text
 */
export function parseUnit(text) {
  if (typeof text !== 'string') return null;
  let s = text
    .replace(/\(.*?\)/g, ' ')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/\b(per|a|an|each|every)\b/gi, ' / ')
    .replace(/[·*]/g, ' ')
    .replace(/(^|\s)×(\s|$)/g, ' × ')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
  // "kilowatt-hour", "person-days", "100km"
  s = s.replace(/([A-Za-z])-([A-Za-z])/g, '$1 $2').replace(/\b(\d+(?:\.\d+)?)([A-Za-z$€£])/g, '$1 $2');
  const parts = s.split('/');
  let d = {};
  let k = 0;
  parts.forEach((part, i) => {
    const sign = i === 0 ? 1 : -1;
    // after a "/", everything up to the next "/" divides ("$/kWh a year" → $ / kWh / year)
    for (let tok of part.trim().split(/\s+/).filter(Boolean)) {
      tok = tok.replace(/^[,.;:]+|[,.;:]+$/g, '');
      if (!tok || FILLER.has(tok.toLowerCase())) continue;
      if (/^\d+(\.\d+)?$/.test(tok)) {
        k += sign * LOG(Number(tok));
        continue;
      }
      let pow = 1;
      const m = tok.match(/^(.+?)\^?([23])$/);
      if (m && lookup(m[1])) {
        tok = m[1];
        pow = Number(m[2]);
      }
      // "$145" style: a currency sign stuck to a word or number
      const cur = tok.match(/^([$€£¥₹])(.+)$/);
      if (cur) {
        const [cd, cs] = KNOWN[cur[1]];
        d = addDims(d, { [cd]: sign }, 1);
        k += sign * LOG(cs);
        tok = cur[2];
        if (/^\d+(\.\d+)?$/.test(tok)) {
          k += sign * LOG(Number(tok));
          continue;
        }
      }
      const known = lookup(tok);
      if (known) {
        const [dim, size] = known;
        const dd = typeof dim === 'string' ? { [dim]: 1 } : dim;
        d = addDims(d, scaleDims(dd, pow * sign));
        k += pow * sign * LOG(size);
      } else d = addDims(d, { [thing(tok)]: pow * sign });
    }
  });
  return { d, k };
}

const dimKey = (d) => Object.keys(d).sort().map((x) => `${x}^${d[x]}`).join(' ');
const sameDims = (a, b) => dimKey(a) === dimKey(b);

/** Dimensions in words, for error messages: "$ per time", "energy". */
export function describeDims(d) {
  const top = Object.keys(d).filter((x) => d[x] > 0).sort();
  const bottom = Object.keys(d).filter((x) => d[x] < 0).sort();
  const name = (x, p) => (Math.abs(p) === 1 ? x : `${x}^${Math.abs(p)}`);
  const up = top.map((x) => name(x, d[x])).join(' × ') || (bottom.length ? '1' : 'a plain number');
  return bottom.length ? `${up} per ${bottom.map((x) => name(x, d[x])).join(' × ')}` : up;
}

/** Formula tree back to text, for error messages. */
export function show(ast) {
  if ('num' in ast) return String(ast.num);
  if ('ref' in ast) return ast.ref;
  if ('call' in ast) return `${ast.call}(${ast.args.map(show).join(', ')})`;
  if (ast.op === 'neg') return `-${show(ast.a)}`;
  const wrap = (x) => ('op' in x && x.op !== 'neg' ? `(${show(x)})` : show(x));
  return `${wrap(ast.a)} ${ast.op} ${wrap(ast.b)}`;
}

const MAX_CANDIDATES = 48;
const ANY = { any: true };
const isLit = (ast) => 'num' in ast;
const key = (c) => (c.any ? '*' : `${dimKey(c.d)}|${c.k.toFixed(3)}`);
const dedupe = (list) => {
  const seen = new Map();
  for (const c of list) if (!seen.has(key(c))) seen.set(key(c), c);
  return [...seen.values()].slice(0, MAX_CANDIDATES);
};
const near = (a, b) => Math.abs(a - b) <= TOL;

/**
 * Work out what unit a formula comes out in.
 * A bare number such as 365 or 100 may be a plain number or a conversion (days a year,
 * percent), so each one is tried both ways. Adding or subtracting needs the same unit
 * on both sides; a bare number beside + or − takes the other side's unit.
 * @param {any} ast parsed formula
 * @param {(id: string) => {d: object, k: number}|null} unitOf
 * @param {(msg: string) => void} report problems found inside the formula
 * @returns {{d: object, k: number}[] | [{any: true}]}
 */
export function unitsOf(ast, unitOf, report) {
  if ('num' in ast) {
    if (ast.num === 0) return [ANY];
    const plain = { d: {}, k: 0 };
    return ast.num === 1 ? [plain] : [plain, { d: {}, k: -LOG(Math.abs(ast.num)) }];
  }
  if ('ref' in ast) {
    const u = unitOf(ast.ref);
    return u ? [u] : [ANY];
  }
  if (ast.op === 'neg') return unitsOf(ast.a, unitOf, report);
  if ('call' in ast) {
    if (ast.call === 'round') return unitsOf(ast.args[0], unitOf, report);
    if (ast.call === 'step') {
      unitsOf(ast.args[0], unitOf, report);
      return [{ d: {}, k: 0 }]; // a switch: a plain 0 or 1
    }
    if (ast.call === 'pow') {
      const [base, power] = ast.args;
      const exp = unitsOf(power, unitOf, report);
      // a count of things (13 tests) is fine as a power; a length of time or money is not
      const PHYSICAL = /^(time|energy|mass|length|temperature|[$€£¥₹])$/;
      if (!exp.some((c) => c.any || (Object.keys(c.d).every((k) => !PHYSICAL.test(k)) && near(c.k, 0)))) {
        report(`raises to a power that has a unit: "${show(ast)}". The power must be a plain number.`);
        return [ANY];
      }
      const b = unitsOf(base, unitOf, report);
      if (b.some((c) => c.any)) return [ANY];
      if ('num' in power) return dedupe(b.map((c) => ({ d: scaleDims(c.d, power.num), k: c.k * power.num })));
      const plain = b.filter((c) => Object.keys(c.d).length === 0 && near(c.k, 0));
      if (!plain.length) {
        report(`raises a value with a unit to a changing power: "${show(ast)}". Use a plain number or share (for example 1 - p / 100) as the base.`);
        return [ANY];
      }
      return [{ d: {}, k: 0 }];
    }
    // min/max: every argument in one unit; a bare number (a cap or a guard) takes that unit
    const real = ast.args.filter((a) => !isLit(a));
    if (!real.length) return [{ d: {}, k: 0 }];
    return agree(real, unitOf, report, `${ast.call}(…)`, ast);
  }
  if (ast.op === '+' || ast.op === '-') {
    if (isLit(ast.a) && isLit(ast.b)) return [{ d: {}, k: 0 }];
    if (isLit(ast.a)) return unitsOf(ast.b, unitOf, report);
    if (isLit(ast.b)) return unitsOf(ast.a, unitOf, report);
    return agree([ast.a, ast.b], unitOf, report, ast.op === '+' ? 'adds' : 'subtracts', ast);
  }
  const a = unitsOf(ast.a, unitOf, report);
  const b = unitsOf(ast.b, unitOf, report);
  if (a.some((c) => c.any) || b.some((c) => c.any)) return [ANY];
  const out = [];
  const sign = ast.op === '*' ? 1 : -1;
  for (const x of a) for (const y of b) out.push({ d: addDims(x.d, y.d, sign), k: x.k + sign * y.k });
  return dedupe(out);
}

function agree(parts, unitOf, report, verb, ast) {
  const sets = parts.map((p) => unitsOf(p, unitOf, report));
  const known = sets.filter((s) => !s.some((c) => c.any));
  if (known.length < 2) return known[0] || [ANY];
  let common = known[0];
  for (const s of known.slice(1)) {
    common = common.filter((c) => s.some((o) => sameDims(c.d, o.d) && near(c.k, o.k)));
  }
  if (common.length) return dedupe(common);
  const [x, y] = known;
  const sameKind = x.some((c) => y.some((o) => sameDims(c.d, o.d)));
  if (verb === 'adds' || verb === 'subtracts') {
    report(
      sameKind
        ? `${verb} values in different sizes of the same unit: "${show(ast)}". Convert one side first (for example ÷ 100 for a percent, × 12 for months a year).`
        : `${verb} ${describeDims(x[0].d)} and ${describeDims(y[0].d)}: "${show(ast)}". Add or subtract only values in the same unit.`,
    );
  } else
    report(
      sameKind
        ? `compares values in different sizes of the same unit inside "${show(ast)}". Convert first (for example ÷ 100 for a percent, × 12 for months a year).`
        : `compares ${describeDims(x[0].d)} with ${describeDims(y[0].d)} inside "${show(ast)}". Every value inside ${verb} needs the same unit.`,
    );
  return [ANY];
}

/**
 * Check a formula against the unit it should have.
 * @returns {string|null} a plain-English problem, or null when it fits
 */
export function checkUnit(ast, want, unitOf, inside) {
  const found = [];
  const got = unitsOf(ast, unitOf, (m) => found.push(m));
  if (found.length) return `${inside} ${found[0]}`;
  if (!want || got.some((c) => c.any)) return null;
  if (got.some((c) => sameDims(c.d, want.d) && near(c.k, want.k))) return null;
  const sameKind = got.find((c) => sameDims(c.d, want.d));
  if (sameKind) {
    const factor = 10 ** Math.abs(sameKind.k - want.k);
    const f = factor >= 10 ? Math.round(factor).toLocaleString('en-US') : factor.toFixed(2);
    // a formula whose units are bigger than declared gives a number that is too small, and the reverse
    return `${inside} gives a number ${f} times too ${sameKind.k > want.k ? 'small' : 'big'} for its unit. Check the conversions (× 365 days a year, × 12 months a year, ÷ 100 for a percent, × 1000 for kilo).`;
  }
  // "5 days a week" reads as a length of time over a length of time, so the per-time vanishes
  const lostTime = (want.d.time || 0) !== 0 && !(got[0].d.time || 0);
  const hint = lostTime ? ' If the formula counts days, nights or trips (say 5 days a week), write that unit as a thing, such as "workdays/week" or "trips/day", so it isn\'t read as a length of time.' : '';
  return `${inside} comes out in ${describeDims(got[0].d)}, but its unit says ${describeDims(want.d)}.${hint}`;
}

/** A unit divided by another (a store's unit per clock unit). */
export function per(a, b) {
  if (!a || !b) return null;
  return { d: addDims(a.d, b.d, -1), k: a.k - b.k };
}
