// Who plays each part. Fallback order: chosen source → studio → custom → stand-in.
// Every screenplay renders, whatever the cast setting or network state.
import { STUDIO } from './index.js';
import buildRecipe from './recipe.js';
import buildOpen from './open.js';

const COLORS = ['#86b6dd', '#8fae8b', '#d4835d', '#e2b04b', '#9a8fc4', '#c9837f'];

/**
 * @param {any} entry world node from the screenplay
 * @param {'auto'|'studio'|'open'|'custom'} mode viewer's Cast setting ('auto' = as written)
 * @param {number} n position in cast (for stand-in colour)
 */
export async function resolveActor(entry, mode = 'auto', n = 0) {
  const label = entry.label || entry.id;
  const own = entry.url ? 'open' : entry.recipe ? 'custom' : 'studio';
  const want = mode === 'auto' ? own : mode;
  const prop = entry.prop || entry.actor;
  const ctx = { label, mounted: !!entry.on };
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
