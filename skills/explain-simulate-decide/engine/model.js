// The screenplay's cause-and-effect model: inputs → derived values → outputs.
// Pure functions only, so the same maths runs in Node tests and in the browser.
import { orderFormulas, evaluate } from './formula.js';

/**
 * @param {{inputs: any[], constants?: any[], derived?: any[], outputs: any[]}} model
 */
export function createModel(model) {
  const inputs = model.inputs || [];
  const constants = model.constants || [];
  const derived = model.derived || [];
  const outputs = model.outputs || [];
  const inputIds = [...inputs.map((i) => i.id), ...constants.map((c) => c.id)];
  const steps = orderFormulas([...derived, ...outputs], inputIds);

  const metaById = new Map();
  for (const i of inputs) metaById.set(i.id, { id: i.id, label: i.label, unit: i.unit, kind: i.kind || 'lever' });
  for (const c of constants) metaById.set(c.id, { id: c.id, label: c.label, unit: c.unit, kind: 'constant' });
  for (const d of derived) metaById.set(d.id, { id: d.id, label: d.label, unit: d.unit, kind: 'derived' });
  for (const o of outputs) metaById.set(o.id, { id: o.id, label: o.label, unit: o.unit, kind: 'output' });

  const defaults = () => Object.fromEntries(inputs.map((i) => [i.id, i.default]));

  /** @param {Record<string, number>} values */
  const run = (values) => {
    const scope = { ...defaults(), ...values };
    for (const c of constants) scope[c.id] = c.value;
    for (const { id, ast } of steps) scope[id] = evaluate(ast, scope);
    for (const k of Object.keys(scope)) if (!Number.isFinite(scope[k])) scope[k] = null;
    return scope;
  };

  const ranges = () => {
    const samples = [defaults()];
    if (inputs.length <= 8) {
      for (let mask = 0; mask < 1 << inputs.length; mask++) {
        samples.push(Object.fromEntries(inputs.map((inp, b) => [inp.id, mask & (1 << b) ? inp.max : inp.min])));
      }
    } else {
      for (const inp of inputs) for (const v of [inp.min, inp.max]) samples.push({ ...defaults(), [inp.id]: v });
    }
    const out = {};
    for (const i of inputs) out[i.id] = [i.min, i.max];
    for (const s of samples) {
      const v = run(s);
      for (const id of Object.keys(v)) {
        if (out[id] && inputs.some((i) => i.id === id)) continue;
        if (v[id] === null) continue;
        const r = out[id] || (out[id] = [v[id], v[id]]);
        r[0] = Math.min(r[0], v[id]);
        r[1] = Math.max(r[1], v[id]);
      }
    }
    for (const id of Object.keys(out)) if (out[id][0] === out[id][1]) out[id] = [out[id][0] - 1, out[id][1] + 1];
    return out;
  };

  return {
    ids: [...metaById.keys()],
    defaults,
    run,
    ranges,
    meta: (id) => metaById.get(id),
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
  const num = value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  const sign = value < 0 ? '-' : '';
  const abs2 = Math.abs(value);
  if (unit === '$') return `${sign}$${abs2.toLocaleString('en-US', { maximumFractionDigits: digits })}`;
  if (unit.startsWith('$/')) return `${sign}$${abs2.toFixed(abs2 !== 0 && abs2 < 0.1 ? 3 : 2)}/${unit.slice(2)}`;
  if (unit === '%') return `${num}%`;
  return unit ? `${num} ${unit}` : num;
}
