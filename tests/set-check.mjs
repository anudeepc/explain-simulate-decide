// Every film set and hand-held object builds and renders, within its triangle budget,
// and the sets join up into one story world. Saves the set sheet (each set from its medium
// camera), the close and wide framings, and the world sheets (the street from above, and
// each place as the story camera frames it).
// Usage: node tests/set-check.mjs [outDir]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';

const outDir = process.argv[2] || 'test-results';
await mkdir(outDir, { recursive: true });
const srv = serve();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const problems = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  for (const cam of ['medium', 'close', 'wide']) {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => problems.push(`[${cam}] ${e}`));
    p.on('console', (m) => m.type() === 'error' && problems.push(`[${cam}] ${m.text()}`));
    await p.goto(`${srv.url}/tests/set-sheet.html?cam=${cam}`);
    await p.waitForFunction(() => window.sheetReady || window.sheetErrors?.length, null, { timeout: 30000 });
    await p.waitForFunction(() => window.sheetReady, null, { timeout: 30000 });
    if (cam === 'medium') problems.push(...(await p.evaluate(() => window.sheetErrors)));
    await p.screenshot({ path: `${outDir}/set-sheet${cam === 'medium' ? '' : '-' + cam}.png` });
    await p.close();
  }

  // the set contract: every name builds, marks/spots/cameras are well formed and on the floor patch
  const p = await ctx.newPage();
  await p.goto(`${srv.url}/tests/set-sheet.html?only=lab`);
  await p.waitForFunction(() => window.sheetReady, null, { timeout: 30000 });
  problems.push(...(await p.evaluate(async () => {
    const out = [];
    const { SETS, OBJECTS } = await import('/skills/explain-simulate-decide/engine/sets/names.js');
    const { SET_BUILDERS } = await import('/skills/explain-simulate-decide/engine/sets/index.js');
    const { buildObject } = await import('/skills/explain-simulate-decide/engine/sets/objects.js');
    const vec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    for (const name of SETS) {
      if (!SET_BUILDERS[name]) { out.push(`set "${name}" has no builder`); continue; }
      const s = SET_BUILDERS[name]();
      if (!s.object?.isObject3D) out.push(`${name}: object is not an Object3D`);
      for (const [m, v] of Object.entries(s.marks || {})) {
        if (!vec(v.position) || !Number.isFinite(v.facing)) out.push(`${name}: bad mark ${m}`);
        else if (Math.abs(v.position[0]) > 3.2 || Math.abs(v.position[2]) > 3.2) out.push(`${name}: mark ${m} is off the set`);
      }
      for (const [k, v] of Object.entries(s.spots || {})) if (!vec(v)) out.push(`${name}: bad spot ${k}`);
      for (const c of ['close', 'medium', 'wide']) if (!vec(s.cameras?.[c]?.position) || !vec(s.cameras?.[c]?.target)) out.push(`${name}: bad ${c} camera`);
    }
    for (const name of Object.keys(SET_BUILDERS)) if (!SETS.includes(name)) out.push(`builder "${name}" not in SETS`);
    for (const name of OBJECTS) {
      const o = buildObject(name);
      if (!o?.isObject3D || !o.children.length && !o.isMesh) out.push(`object ${name} is empty`);
    }
    return out;
  })));

  // the story world: every set joined up as one street (plus a facade), and the bowel-screening film's world
  for (const [name, q] of [['world-sheet', ''], ['world-bowel', '?sp=examples/bowel-screening/screenplay.json']]) {
    const w = await ctx.newPage();
    w.on('pageerror', (e) => problems.push(`[${name}] ${e}`));
    w.on('console', (m) => m.type() === 'error' && problems.push(`[${name}] ${m.text()}`));
    await w.goto(`${srv.url}/tests/world-sheet.html${q}`);
    await w.waitForFunction(() => window.sheetReady, null, { timeout: 60000 });
    problems.push(...(await w.evaluate(() => window.sheetErrors)));
    await w.screenshot({ path: `${outDir}/${name}.png` });
    await w.close();
  }
} finally {
  await browser.close();
  srv.close();
}
if (problems.length) {
  console.error('Set problems:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`set check passed (sheets saved to ${outDir}/set-sheet.png and ${outDir}/world-sheet.png)`);
