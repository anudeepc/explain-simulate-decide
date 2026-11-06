// The screenplay's model: inputs → derived values → outputs, plus stores that
// fill and drain over a simulated clock. Pure functions only, so the same maths
// runs in Node tests and in the browser.
import { parse, evaluate, orderFormulas, refs } from './formula.js';

export const STEPS = 240; // clock steps across the span: smooth to draw, cheap to rerun every frame

/**
 * @param {{inputs: any[], constants?: any[], derived?: any[], outputs: any[], stores?: any[], milestones?: any[]}} model
 * @param {{span?: number, unit?: string}} [time] world clock
 */
export function createModel(model, time = {}) {
  const inputs = model.inputs || [];
  const constants = model.constants || [];
  const derived = model.derived || [];
  const outputs = model.outputs || [];
  const stores = (model.stores || []).map((s) => ({
    ...s,
    startAst: parse(String(s.start)),
    changeAst: parse(s.change),
    ceilingAst: s.ceiling !== undefined ? parse(String(s.ceiling)) : null,
  }));
  const milestones = (model.milestones || []).map((m) => ({ ...m, reachesAst: parse(String(m.reaches)) }));
  const span = time.span || 1;
  const inputIds = [...inputs.map((i) => i.id), ...constants.map((c) => c.id)];
  const storeIds = new Set(stores.map((s) => s.id));
  // derived values that read a store (directly or through another) change over time:
  // they are worked out again at every step of the clock
  const ordered = orderFormulas([...derived, ...outputs], [...inputIds, ...storeIds]);
  const moving = new Set();
  for (const { id, ast } of ordered) if (refs(ast).some((r) => storeIds.has(r) || moving.has(r))) moving.add(id);
  const steps = ordered.filter((x) => !moving.has(x.id));
  const timeSteps = ordered.filter((x) => moving.has(x.id));

  const metaById = new Map();
  for (const i of inputs) metaById.set(i.id, { id: i.id, label: i.label, unit: i.unit, kind: i.kind || 'lever' });
  for (const c of constants) metaById.set(c.id, { id: c.id, label: c.label, unit: c.unit, kind: 'constant' });
  for (const d of derived) metaById.set(d.id, { id: d.id, label: d.label, unit: d.unit, kind: 'derived' });
  for (const o of outputs) metaById.set(o.id, { id: o.id, label: o.label, unit: o.unit, kind: 'output' });
  for (const s of stores) metaById.set(s.id, { id: s.id, label: s.label, unit: s.unit, kind: 'store' });
  for (const m of milestones) metaById.set(m.id, { id: m.id, label: m.label, unit: time.unit ? `${time.unit}s` : '', kind: 'milestone' });

  const defaults = () => Object.fromEntries(inputs.map((i) => [i.id, i.default]));

  /** Static values: inputs, constants, derived, outputs (values that move with the clock: at its start). */
  const run = (values) => {
    const scope = { ...defaults(), ...values };
    for (const c of constants) scope[c.id] = c.value;
    for (const { id, ast } of steps) scope[id] = evaluate(ast, scope);
    if (timeSteps.length) {
      const at = { ...scope };
      for (const s of stores) at[s.id] = safeAt(s.startAst, scope);
      for (const { id, ast } of timeSteps) scope[id] = at[id] = safeAt(ast, at);
    }
    for (const k of Object.keys(scope)) if (!Number.isFinite(scope[k])) scope[k] = null;
    return scope;
  };
  const safeAt = (ast, scope) => {
    try {
      return evaluate(ast, scope);
    } catch {
      return NaN;
    }
  };
  /** Values that move with the clock, for a scope that holds store levels. */
  const moveWith = (scope) => {
    for (const { id, ast } of timeSteps) scope[id] = safe(ast, scope);
    return scope;
  };

  /** Evaluate a parsed formula; errors and non-finite results give 0. */
  const safe = (ast, scope) => {
    try {
      const v = evaluate(ast, scope);
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  };

  /**
   * Run the clock from 0 to span. Stores integrate their change per time unit
   * in fixed steps, so the same inputs always give the same run.
   */
  const simulate = (values) => {
    const base = run(values);
    const dt = span / STEPS;
    const scope = { ...base };
    const series = {};
    // where each step would have landed before a floor or ceiling stopped it: milestones
    // interpolate with these, so "runs dry on day 10" is day 10, not the end of that step
    const raw = {};
    const ceilings = stores.map((s) => (s.ceilingAst ? safe(s.ceilingAst, base) : Infinity));
    for (const s of stores) {
      scope[s.id] = safe(s.startAst, base);
      series[s.id] = new Float64Array(STEPS + 1);
      raw[s.id] = new Float64Array(STEPS + 1);
      raw[s.id][0] = scope[s.id];
    }
    for (let k = 0; k <= STEPS; k++) {
      for (const s of stores) series[s.id][k] = scope[s.id];
      if (k === STEPS) break;
      moveWith(scope);
      const change = stores.map((s) => safe(s.changeAst, scope));
      stores.forEach((s, n) => {
        let v = scope[s.id] + change[n] * dt;
        raw[s.id][k + 1] = v;
        if (typeof s.floor === 'number') v = Math.max(s.floor, v);
        v = Math.min(ceilings[n], v);
        scope[s.id] = v;
      });
    }
    const reached = {};
    const targets = {};
    for (const m of milestones) {
      const target = safe(m.reachesAst, base);
      const line = series[m.store];
      const landed = raw[m.store];
      targets[m.id] = target;
      reached[m.id] = null;
      if (!line) continue;
      const side = Math.sign(line[0] - target);
      if (side === 0) {
        reached[m.id] = 0;
        continue;
      }
      for (let k = 1; k <= STEPS; k++) {
        if (Math.sign(landed[k] - target) !== side) {
          const f = (target - line[k - 1]) / (landed[k] - line[k - 1]);
          reached[m.id] = (k - 1 + f) * dt;
          break;
        }
      }
    }
    return { base, series, reached, targets, span, dt };
  };

  /** Store levels at clock time tau (linear between steps), and the values that move with them. */
  const levelsAt = (sim, tau) => {
    const x = Math.min(Math.max(tau / sim.dt, 0), STEPS);
    const k = Math.min(STEPS - 1, Math.floor(x));
    const f = x - k;
    const out = {};
    for (const [id, line] of Object.entries(sim.series)) out[id] = line[k] + (line[k + 1] - line[k]) * f;
    if (!timeSteps.length) return out;
    const scope = moveWith({ ...sim.base, ...out });
    for (const { id } of timeSteps) out[id] = scope[id];
    return out;
  };

  /**
   * Ranges for every value (and extra formulas such as flow rates), sampled at the
   * corners of the input space and at the start, middle and end of the clock.
   * @param {Record<string, any>} [extra] id → parsed formula
   */
  const ranges = (extra = {}) => {
    const samples = [defaults()];
    if (inputs.length <= 8) {
      for (let mask = 0; mask < 1 << inputs.length; mask++) {
        samples.push(Object.fromEntries(inputs.map((inp, b) => [inp.id, mask & (1 << b) ? inp.max : inp.min])));
      }
    } else {
      for (const inp of inputs) for (const v of [inp.min, inp.max]) samples.push({ ...defaults(), [inp.id]: v });
    }
    const out = {};
    const add = (id, v) => {
      if (v === null || !Number.isFinite(v)) return;
      const r = out[id] || (out[id] = [v, v]);
      r[0] = Math.min(r[0], v);
      r[1] = Math.max(r[1], v);
    };
    for (const s of samples) {
      const sim = simulate(s);
      for (const tau of stores.length ? [0, span / 2, span] : [0]) {
        const scope = { ...sim.base, ...levelsAt(sim, tau) };
        for (const [id, v] of Object.entries(scope)) add(id, v);
        for (const [id, ast] of Object.entries(extra)) add(id, safe(ast, scope));
      }
    }
    for (const i of inputs) out[i.id] = [i.min, i.max];
    for (const id of Object.keys(out)) if (out[id][0] === out[id][1]) out[id] = [out[id][0] - 1, out[id][1] + 1];
    return out;
  };

  return {
    ids: [...metaById.keys()],
    defaults,
    run,
    simulate,
    levelsAt,
    ranges,
    span,
    stores: stores.map((s) => s.id),
    /** Derived values that read a store, so they change with the clock. */
    moving: [...moving],
    milestones: milestones.map((m) => m.id),
    meta: (id) => metaById.get(id),
    evaluate: safe,
  };
}

/** Map a value into 0..1 within its range (clamped). */
export function normalise(value, [lo, hi]) {
  if (value === null || value === undefined) return 0;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** Human-friendly number formatting with unit. */
export function formatValue(value, unit = '') {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const sign = value < 0 ? '-' : '';
  if (unit === '$') return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: abs >= 10 ? 0 : 2 })}`;
  if (unit.startsWith('$/')) {
    if (abs >= 10) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}/${unit.slice(2)}`;
    return `${sign}$${abs.toFixed(abs !== 0 && abs < 0.1 ? 3 : 2)}/${unit.slice(2)}`;
  }
  const num = value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (unit === '%' || unit.startsWith('%/') || unit.startsWith('% ')) return `${num}${unit}`;
  return unit ? `${num} ${unit}` : num;
}

/** An input's value as a viewer reads it: "Yes"/"No" for a toggle, else number and unit. */
export function formatInput(inp, value) {
  if (inp?.toggle) return value >= 0.5 ? 'Yes' : 'No';
  return formatValue(value, inp?.unit || '');
}
