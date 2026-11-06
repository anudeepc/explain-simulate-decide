// Every studio prop and every character kind builds and renders, with no silent
// fallback to a labelled block. Saves the cast sheet as a picture to look at.
// Usage: node tests/cast-check.mjs [outDir]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';

const outDir = process.argv[2] || 'test-results';
await mkdir(outDir, { recursive: true });
const srv = serve();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const problems = [];
try {
  const p = await (await browser.newContext({ viewport: { width: 1600, height: 1400 } })).newPage();
  p.on('pageerror', (e) => problems.push(String(e)));
  p.on('console', (m) => (m.type() === 'error' || /fell back/.test(m.text())) && problems.push(m.text()));
  await p.goto(`${srv.url}/tests/cast-sheet.html?v=0.9&cols=7`);
  await p.waitForFunction(() => window.sheetReady, null, { timeout: 30000 });
  problems.push(...(await p.evaluate(() => window.sheetErrors)));
  await p.screenshot({ path: `${outDir}/cast-sheet.png` });

  // every kind resolves to its own look, not the stand-in block (except "other")
  const kinds = await p.evaluate(async () => {
    const { KINDS } = await import('/skills/explain-simulate-decide/engine/cast/names.js');
    const { resolveActor, KIND_LOOK } = await import('/skills/explain-simulate-decide/engine/cast/resolve.js');
    const out = [];
    for (const kind of KINDS) {
      if (!KIND_LOOK[kind]) {
        out.push(`kind "${kind}" has no look`);
        continue;
      }
      const actor = await resolveActor({ id: kind, label: kind, kind });
      actor.setValue(0.5);
      if (!actor.object.children.length) out.push(`kind "${kind}" built an empty object`);
    }
    // stores pick their look from their unit
    for (const unit of ['$', 'kWh', 'L', 'h', 't CO2e', 'patients']) {
      const actor = await resolveActor({ id: 's', label: 's', store: 's' }, 'auto', 0, { storeUnit: unit });
      actor.setValue(0.5);
      actor.setTarget?.(0.7);
    }
    return out;
  });
  problems.push(...kinds);
} finally {
  await browser.close();
  srv.close();
}
if (problems.length) {
  console.error('Cast problems:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`cast check passed (sheet saved to ${outDir}/cast-sheet.png)`);
