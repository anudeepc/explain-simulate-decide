// The hero character builds, every action and expression poses without error, pose() is pure
// (the same (action, k, opts) always gives the same joints, whatever came before), and the mesh
// stays within budget. Saves the character sheet as a picture to look at.
// Usage: node tests/character-check.mjs [outDir] [sheet query, e.g. "only=pickUp,give&k=0,0.25,0.5"]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';

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
    const { default: build } = await import('/skills/explain-simulate-decide/engine/cast/character.js');
    const { ACTIONS, EXPRESSIONS } = await import('/skills/explain-simulate-decide/engine/cast/actions.js');
    const THREE = await import('/skills/explain-simulate-decide/engine/vendor/three/three.module.js');
    const c = build();
    const snap = () => {
      const s = {};
      for (const [name, j] of Object.entries(c.joints)) s[name] = [...j.position.toArray(), ...j.quaternion.toArray()].map((v) => +v.toFixed(9));
      s.hand = [...c.hand.position.toArray(), ...c.hand.quaternion.toArray()].map((v) => +v.toFixed(9));
      return JSON.stringify(s);
    };
    // every action at many k, standing and seated, poses to finite numbers
    for (const a of ACTIONS) {
      for (const opts of [{}, { sitting: true }, { cycles: 3 }]) {
        for (let i = 0; i <= 20; i++) {
          c.pose(a, i / 20, opts);
          if (/null|NaN/.test(snap())) out.push(`${a} k=${i / 20} ${JSON.stringify(opts)} gave a non-finite joint`);
        }
      }
    }
    for (const e of EXPRESSIONS) c.setExpression(e);
    // purity: any history gives the same pose
    for (const [a, k, opts] of [['walk', 0.3, {}], ['pickUp', 0.7, {}], ['talk', 0.4, { sitting: true }], ['wait', 0.6, {}]]) {
      c.pose(a, k, opts);
      const once = snap();
      c.pose('sit', 0.8);
      c.pose('react', 0.4);
      c.pose(a, k, opts);
      if (snap() !== once) out.push(`pose('${a}', ${k}) depends on what came before`);
    }
    // stands on the floor and is about 1.75 tall
    c.pose('idle', 0);
    c.object.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(c.object, true);
    if (Math.abs(bb.min.y) > 0.01) out.push(`feet at y=${bb.min.y.toFixed(3)}, not on the floor`);
    if (Math.abs(bb.max.y - c.height) > 0.04) out.push(`height ${bb.max.y.toFixed(3)} != ${c.height}`);
    // seated hips on a 0.45 seat
    c.pose('sit', 1);
    c.object.updateMatrixWorld(true);
    const hipY = c.joints.hipR.getWorldPosition(new THREE.Vector3()).y;
    const thigh = c.joints.kneeR.getWorldPosition(new THREE.Vector3()).sub(c.joints.hipR.getWorldPosition(new THREE.Vector3()));
    if (Math.abs(Math.atan2(thigh.y, Math.hypot(thigh.x, thigh.z))) > 0.08) out.push(`seated thigh not horizontal (${thigh.y.toFixed(3)})`);
    // pickUp reaches the floor ahead, give reaches the slot
    c.pose('pickUp', 0.5);
    c.object.updateMatrixWorld(true);
    const palmLow = c.hand.getWorldPosition(new THREE.Vector3());
    if (palmLow.y > 0.16 || palmLow.z < 0.3) out.push(`pickUp low point: palm at y=${palmLow.y.toFixed(3)} z=${palmLow.z.toFixed(3)}`);
    c.pose('give', 0.5);
    c.object.updateMatrixWorld(true);
    const palmGive = c.hand.getWorldPosition(new THREE.Vector3());
    if (palmGive.distanceTo(new THREE.Vector3(-0.1, 1.12, 0.47)) > 0.03) out.push(`give: palm at ${palmGive.toArray().map((v) => v.toFixed(3))}`);
    let tris = 0;
    c.object.traverse((o) => {
      if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    if (tris > 15000) out.push(`${tris} triangles (budget 15k)`);
    return { out, stats: { tris, height: +bb.max.y.toFixed(3), seatedHipY: +hipY.toFixed(3), palmLow: palmLow.toArray().map((v) => +v.toFixed(3)), palmGive: palmGive.toArray().map((v) => +v.toFixed(3)) } };
  });
  problems.push(...result.out);
  stats = result.stats;
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
