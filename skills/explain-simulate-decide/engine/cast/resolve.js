// Who plays each part. Fallback order: chosen source → studio → custom → stand-in.
// Every screenplay renders, whatever the cast setting or network state.
import { STUDIO } from './index.js';
import buildRecipe from './recipe.js';
import buildOpen from './open.js';
import { parseUnit } from '../units.js';

const COLORS = ['#86b6dd', '#8fae8b', '#d4835d', '#e2b04b', '#9a8fc4', '#c9837f'];

// A look for every kind of character, so any article's cast can stand on the set.
const PILLS = [
  { shape: 'cylinder', size: [0.9, 1.2, 0.9], color: '#eeeaf4' },
  { shape: 'cylinder', size: [0.96, 0.32, 0.96], color: '#9a8fc4' },
  { shape: 'box', size: [0.62, 0.5, 0.05], color: '#ffffff', at: [0, 0.28, 0.44] },
];
// a living cell: a soft membrane with a darker nucleus
const CELL = [
  { shape: 'sphere', size: [1.5, 1.3, 1.5], color: '#f2b8b5' },
  { shape: 'sphere', size: [0.55, 0.55, 0.55], color: '#b5527a', at: [0.15, 0.55, 0.45] },
];
// a germ: a round body covered in short spikes
const GERM = [
  { shape: 'sphere', size: [1.2, 1.2, 1.2], color: '#8fbf6a' },
  ...[0, 60, 120, 180, 240, 300].map((a) => {
    const r = (a * Math.PI) / 180;
    return { shape: 'cone', size: [0.22, 0.4, 0.22], color: '#5f8f45', at: [0.68 * Math.cos(r), 0.4 + 0.68 * Math.sin(r), 0], rotate: [0, 0, a - 90] };
  }),
  { shape: 'cone', size: [0.22, 0.4, 0.22], color: '#5f8f45', at: [0, 0.4, 0.7], rotate: [90, 0, 0] },
  { shape: 'cone', size: [0.22, 0.4, 0.22], color: '#5f8f45', at: [0, 0.4, -0.7], rotate: [-90, 0, 0] },
];
export const KIND_LOOK = {
  person: { prop: 'person-figure' },
  crowd: { prop: 'crowd' },
  body: { prop: 'body' },
  home: { prop: 'house' },
  building: { prop: 'building' },
  institution: { prop: 'bank' },
  business: { prop: 'building', tint: '#c9d6e3' },
  factory: { prop: 'factory' },
  farm: { prop: 'hill', tint: '#8fae6b' },
  nature: { prop: 'tree' },
  land: { prop: 'hill' },
  water: { prop: 'water-drop' },
  weather: { prop: 'cloud' },
  sun: { prop: 'sun' },
  vehicle: { prop: 'car' },
  machine: { prop: 'gauge' },
  device: { prop: 'plug' },
  screen: { prop: 'phone' },
  document: { prop: 'document' },
  money: { prop: 'coin-stack' },
  store: { prop: 'tank' },
  food: { prop: 'shopping-bag' },
  medicine: { recipe: PILLS },
  time: { prop: 'clock' },
  cell: { recipe: CELL },
  germ: { recipe: GERM },
  other: { prop: 'stand-in' },
};

/** What a store looks like when the screenplay leaves it to us: coins only for money. */
export function storeLook(unit) {
  const u = parseUnit(unit ?? '');
  const dims = Object.keys(u?.d || {});
  if (dims.some((k) => ['$', '€', '£', '¥', '₹'].includes(k))) return { prop: 'jar' };
  if (dims.includes('energy') && !dims.some((k) => !['energy', 'time'].includes(k))) return { prop: 'battery' };
  if (dims.some((k) => /co2|carbon|emission|pollut|smoke/.test(k))) return { prop: 'tank', tint: '#7d8189' };
  if (dims.includes('time')) return { prop: 'tank', tint: '#8e7cc3' };
  if (dims.includes('length')) return { prop: 'tank', tint: '#4f9fc4' };
  return { prop: 'tank', tint: '#5fae9a' };
}

/**
 * @param {any} entry world node from the screenplay
 * @param {'auto'|'studio'|'open'|'custom'} mode viewer's Cast setting ('auto' = as written)
 * @param {number} n position in cast (for stand-in colour)
 */
export async function resolveActor(entry, mode = 'auto', n = 0, { storeUnit = null } = {}) {
  const label = entry.label || entry.id;
  // no prop named: take the look of its kind, or for a store, the look of its unit
  const fallback = !entry.prop && !entry.actor ? (entry.kind ? KIND_LOOK[entry.kind] : entry.store ? storeLook(storeUnit) : null) : null;
  if (fallback?.recipe && !entry.recipe) {
    // two characters of the same kind (B cells, memory cells) get different colours
    const tints = ['#f2b8b5', '#b8d8f2', '#c9e8b8', '#f2dcb0'];
    const recipe = entry.kind === 'cell' ? fallback.recipe.map((p, i) => (i === 0 ? { ...p, color: tints[n % tints.length] } : p)) : fallback.recipe;
    entry = { ...entry, recipe };
  }
  const own = entry.url ? 'open' : entry.recipe ? 'custom' : 'studio';
  const want = mode === 'auto' ? own : mode;
  const prop = entry.prop || entry.actor || fallback?.prop;
  const ctx = { label, mounted: !!entry.on, ...(fallback?.tint ? { tint: fallback.tint } : {}) };
  const attempts = [];
  if (want === 'open' && entry.url) attempts.push(() => buildOpen({ url: entry.url, credit: entry.credit }));
  if (want === 'custom' && entry.recipe) attempts.push(() => buildRecipe({ recipe: entry.recipe }));
  if (STUDIO[prop]) attempts.push(() => STUDIO[prop](ctx));
  if (entry.recipe) attempts.push(() => buildRecipe({ recipe: entry.recipe }));
  attempts.push(() => STUDIO['stand-in']({ label, color: COLORS[n % COLORS.length] }));
  for (const make of attempts) {
    try {
      const actor = await make();
      if (actor?.object) return actor;
    } catch (e) {
      console.warn(`[esd] actor "${entry.id}" fell back:`, e.message);
    }
  }
  throw new Error('unreachable');
}
