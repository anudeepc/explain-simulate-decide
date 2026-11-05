// Render check: opens a rendered page in headless Chromium, draws film frames at
// fixed times, saves screenshots, and fails on console errors or unstable frames.
// Usage: node tests/render-check.mjs [page.html] [outDir]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const page = process.argv[2] || 'examples/solar/solar.html';
const outDir = resolve(process.argv[3] || 'test-results');
const root = resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root)) throw new Error('outside');
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:${port}/${page}`);
  await p.waitForFunction(() => window.ESD && (window.ESD.errors?.length || window.ESD.duration), null, { timeout: 30000 }).catch(() => {});
  const info = await p.evaluate(async () => {
    await window.ESD.ready;
    return { errors: window.ESD.errors, duration: window.ESD.duration, segments: window.ESD.timeline?.segments.map((s) => [s.act, s.shot, +s.start.toFixed(2)]) };
  });
  if (info.errors?.length) throw new Error('Screenplay errors: ' + info.errors.join('; '));
  console.log(`duration ${info.duration.toFixed(1)}s`);
  const times = info.segments.map(([, , start], i) => {
    const next = info.segments[i + 1]?.[2] ?? info.duration;
    return +(start + (next - start) * 0.7).toFixed(2);
  });
  const shots = [];
  for (const [i, t] of times.entries()) {
    await p.evaluate((t) => window.ESD.renderAt(t), t);
    await p.waitForTimeout(60);
    const file = join(outDir, `frame-${String(i).padStart(2, '0')}-${info.segments[i][1]}.png`);
    await p.screenshot({ path: file });
    shots.push(file);
  }
  // determinism: the same t twice gives the same pixels
  const grab = async (t) => {
    await p.evaluate((t) => window.ESD.renderAt(t), t);
    await p.waitForTimeout(60);
    return (await p.screenshot()).toString('base64');
  };
  const a = await grab(times[2]);
  await grab(times[5]);
  const b = await grab(times[2]);
  if (a !== b) errors.push('Frames are not deterministic');
  // live mode
  await p.evaluate(() => window.ESD.enterAsk());
  await p.waitForTimeout(1800);
  await p.screenshot({ path: join(outDir, 'live-ask.png') });
  await p.evaluate(() => { window.ESD.enterLive(); window.ESD.runClock(); });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: join(outDir, 'live-running.png') });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: join(outDir, 'live-simulate.png') });
  await p.evaluate(() => window.ESD.enterDecide());
  await p.waitForTimeout(1800);
  await p.screenshot({ path: join(outDir, 'live-decide.png') });
  console.log(`saved ${shots.length + 2} screenshots to ${outDir}`);
} finally {
  await browser.close();
  server.close();
}
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('render check passed');
