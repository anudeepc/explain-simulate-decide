// The film's people (cast/human.js) build, every action and expression poses without error, pose()
// is pure (the same (action, k, opts, prev, blend) always gives the same joints, whatever came
// before), hands reach their targets, walking feet do not slide, and the meshes stay within budget.
// Saves the character sheet as a picture to look at.
// Usage: node tests/character-check.mjs [outDir] [sheet query, e.g. "only=pickUp,give&k=0,0.25,0.5"]
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { inline } from '../skills/explain-simulate-decide/engine/bundle.js';
import { toHtml, assetsFor } from '../skills/explain-simulate-decide/engine/export.js';

const outDir = process.argv[2] || 'test-results';
const query = process.argv[3] || '';
await mkdir(outDir, { recursive: true });
const srv = serve();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const problems = [];
let stats = {};
try {
  const p = await (await browser.newContext({ viewport: { width: 2000, height: 2200 } })).newPage();
  p.on('pageerror', (e) => problems.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  await p.goto(`${srv.url}/tests/character-sheet.html${query ? `?${query}` : ''}`);
  await p.waitForFunction(() => window.sheetReady, null, { timeout: 30000 });
  problems.push(...(await p.evaluate(() => window.sheetErrors)));
  await p.screenshot({ path: `${outDir}/character-sheet${query ? '-' + query.replace(/[^a-z0-9]+/gi, '_') : ''}.png` });

  const result = await p.evaluate(async () => {
    const out = [];
    const { default: build, loadHumans, STRIDE } = await import('/skills/explain-simulate-decide/engine/cast/human.js');
    const { ACTIONS, EXPRESSIONS } = await import('/skills/explain-simulate-decide/engine/cast/actions.js');
    const THREE = await import('/skills/explain-simulate-decide/engine/vendor/three/three.module.js');
    await loadHumans();
    const stats = {};
    for (const [who, opts] of [['male casual', { tint: '#2a9d8f' }], ['female smart', { body: 'female', outfit: 'smart', hairStyle: 'Long' }], ['male scrubs', { outfit: 'scrubs' }]]) {
      const c = build(opts);
      const snap = () => {
        const s = {};
        for (const [name, j] of Object.entries(c.joints)) s[name] = [...j.position.toArray(), ...j.quaternion.toArray()].map((v) => +v.toFixed(9));
        s.hand = [...c.hand.position.toArray(), ...c.hand.quaternion.toArray()].map((v) => +v.toFixed(9));
        return JSON.stringify(s);
      };
      // every action at many k, standing, seated and walking far, poses to finite numbers
      for (const a of ACTIONS) {
        for (const o of [{}, { sitting: true }, { cycles: 3 }]) {
          for (let i = 0; i <= 20; i++) {
            c.pose(a, i / 20, o);
            if (/null|NaN/.test(snap())) out.push(`${who}: ${a} k=${i / 20} ${JSON.stringify(o)} gave a non-finite joint`);
          }
        }
      }
      for (const e of EXPRESSIONS) c.setExpression(e);
      c.setExpression('neutral');
      // purity: any history gives the same pose, crossfades included
      for (const [a, k, o] of [['walk', 0.3, {}], ['pickUp', 0.7, {}], ['talk', 0.4, { sitting: true }], ['wait', 0.6, {}], ['give', 0.4, { prev: { action: 'walk', k: 1, opts: { cycles: 2 } }, blend: 0.35 }], ['read', 0.2, { sitting: true, prev: { action: 'sit', k: 1 }, blend: 0.5 }]]) {
        c.pose(a, k, o);
        const once = snap();
        c.pose('sit', 0.8);
        c.pose('react', 0.4);
        c.setExpression('worried');
        c.setExpression('neutral');
        c.pose(a, k, o);
        if (snap() !== once) out.push(`${who}: pose('${a}', ${k}) depends on what came before`);
      }
      // stands on the floor at its stated height
      c.pose('idle', 0);
      c.object.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(c.object, true);
      if (Math.abs(bb.min.y) > 0.012) out.push(`${who}: feet at y=${bb.min.y.toFixed(3)}, not on the floor`);
      if (Math.abs(bb.max.y - c.height) > 0.04) out.push(`${who}: height ${bb.max.y.toFixed(3)} != ${c.height}`);
      // seated: hips on the 0.45 seat, thighs near level
      c.pose('sit', 1);
      c.object.updateMatrixWorld(true);
      const W = (j) => c.joints[j].getWorldPosition(new THREE.Vector3());
      const hipY = W('hipR').y;
      const thigh = W('kneeR').sub(W('hipR'));
      const tilt = Math.atan2(thigh.y, Math.hypot(thigh.x, thigh.z));
      if (hipY < c.seat.y + 0.03 || hipY > c.seat.y + 0.16) out.push(`${who}: seated hip joints at y=${hipY.toFixed(3)}, not on a ${c.seat.y} seat`);
      if (Math.abs(tilt) > 0.25) out.push(`${who}: seated thigh tilted ${tilt.toFixed(2)} rad`);
      // pickUp reaches the floor ahead; give reaches the slot; a target is reached
      c.pose('pickUp', 0.5);
      c.object.updateMatrixWorld(true);
      const palmLow = c.hand.getWorldPosition(new THREE.Vector3());
      if (palmLow.y > 0.16 || palmLow.z < 0.3) out.push(`${who}: pickUp low point: palm at y=${palmLow.y.toFixed(3)} z=${palmLow.z.toFixed(3)}`);
      c.pose('give', 0.5);
      c.object.updateMatrixWorld(true);
      const palmGive = c.hand.getWorldPosition(new THREE.Vector3());
      if (palmGive.distanceTo(new THREE.Vector3(-0.1, 1.12, 0.47)) > 0.03) out.push(`${who}: give: palm at ${palmGive.toArray().map((v) => v.toFixed(3))}`);
      for (const [a, t] of [['place', { x: -0.15, y: 0.9, z: 0.42 }], ['pickUp', { x: -0.05, y: 0.06, z: 0.45 }], ['give', { x: 0.0, y: 1.3, z: 0.5 }]]) {
        c.pose(a, 0.5, { target: t });
        c.object.updateMatrixWorld(true);
        const d = c.hand.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(t.x, t.y, t.z));
        if (d > 0.03) out.push(`${who}: ${a} misses its target by ${d.toFixed(3)} m`);
      }
      // walking: the planted foot stays put when the body moves `distance` across k
      const N = 120;
      const rows = [];
      for (let i = 0; i <= N; i++) {
        c.pose('walk', i / N, { distance: c.stride });
        c.object.updateMatrixWorld(true);
        rows.push(['r', 'l'].map((s) => c.joints[`ball_${s}`].getWorldPosition(new THREE.Vector3())));
      }
      let slide = 0;
      for (const s of [0, 1]) {
        const ymin = Math.min(...rows.map((r) => r[s].y));
        let travel = 0, n = 0;
        for (let i = 1; i <= N; i++) if (rows[i][s].y < ymin + 0.012 && rows[i - 1][s].y < ymin + 0.012) (travel += rows[i - 1][s].z - rows[i][s].z), n++;
        slide = Math.max(slide, Math.abs(travel / (n / N) - c.stride));
      }
      if (slide > 0.04) out.push(`${who}: walk stride is off by ${slide.toFixed(3)} m per cycle (feet would slide)`);
      let tris = 0;
      c.object.traverse((o) => {
        if (o.isMesh && o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
      if (tris > 36000) out.push(`${who}: ${tris} triangles (budget 36k)`);
      stats[who] = { tris, height: +bb.max.y.toFixed(3), seatedHipY: +hipY.toFixed(3), palmLow: palmLow.toArray().map((v) => +v.toFixed(3)), palmGive: palmGive.toArray().map((v) => +v.toFixed(3)), strideError: +slide.toFixed(3), stride: STRIDE[opts.body || 'male'] };
    }
    return { out, stats };
  });
  problems.push(...result.out);
  stats = result.stats;

  // offline: one HTML file with the people's assets embedded, strict CSP, no network at all
  const engine = resolve('skills/explain-simulate-decide/engine');
  const entry = `import build, { loadHumans } from './cast/human.js';
export function mount() {
  const ready = loadHumans()
    .then(() => {
      const h = build({ tint: '#2a9d8f', body: 'female', outfit: 'scrubs' });
      h.pose('walk', 0.3, { cycles: 2 });
      window.humanOK = h.height;
    })
    .catch((e) => (window.humanErr = String(e)));
  return { ready };
}`;
  const bundle = await inline('human-entry.js', (path) => (path === 'human-entry.js' ? entry : readFile(join(engine, path), 'utf8')));
  const assets = await assetsFor(bundle, (name) => readFile(join(engine, 'assets', `${name}.glb`)));
  const file = join(resolve(outDir), 'human-offline.html');
  await writeFile(file, toHtml({ question: 'offline people' }, bundle, { assets }));
  const off = await (await browser.newContext()).newPage();
  off.on('pageerror', (e) => problems.push(`offline page: ${e}`));
  off.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`offline page: ${m.text()}`));
  await off.route(/^https?:/, (route) => route.abort());
  await off.goto(pathToFileURL(file).href);
  await off.waitForFunction(() => window.humanOK || window.humanErr, null, { timeout: 30000 });
  const err = await off.evaluate(() => window.humanErr);
  if (err) problems.push(`offline page could not build a person: ${err}`);
  stats.offline = await off.evaluate(() => window.humanOK);
} finally {
  await browser.close();
  srv.close();
}
console.log(JSON.stringify(stats));
if (problems.length) {
  console.error('Character problems:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`character check passed (sheet saved to ${outDir}/character-sheet.png)`);
