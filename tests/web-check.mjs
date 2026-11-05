// Web tool check with a fake AI provider: upload text → first reply has a problem →
// the tool sends the errors back → second reply is valid → film plays → HTML downloads.
import { chromium } from 'playwright';
import { readFileSync, statSync } from 'node:fs';
import { serve } from './serve.mjs';

const solar = JSON.parse(readFileSync('examples/solar/screenplay.json', 'utf8'));
const broken = structuredClone(solar);
broken.explain[0].caption = 'This caption is far too long for the rules because it has more than twelve words';

const srv = serve();
const browser = await chromium.launch();
const errors = [];
let calls = 0;
const bodies = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.route('https://api.anthropic.com/v1/messages', async (route) => {
    calls++;
    bodies.push(JSON.parse(route.request().postData()));
    const sp = calls === 1 ? broken : solar;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(sp) }] }) });
  });
  await page.goto(`${srv.url}/web/`);
  await page.selectOption('#provider', 'anthropic');
  await page.fill('#key', 'sk-ant-test');
  await page.fill('#article', 'Solar article text. '.repeat(40));
  await page.click('#generate');
  await page.waitForFunction(() => ['done', 'error'].includes(document.querySelector('#progress')?.dataset.state), null, { timeout: 60000 });
  const logText = await page.$$eval('#progress .pg-status, #progress .pg-steps li', (els) => els.map((l) => l.textContent));
  console.log(logText.join('\n'));
  if (!/^Ready/.test(logText[0])) throw new Error('progress did not finish with Ready');
  if (!logText.some((t) => /Fix 1 problem/.test(t))) throw new Error('repair round not shown as a step');
  const bar = await page.$eval('#progress .pg-track', (t) => t.getAttribute('aria-valuenow'));
  if (bar !== '100') throw new Error(`progress bar ended at ${bar}%`);
  if (calls !== 2) throw new Error(`expected 2 provider calls (1 repair), got ${calls}`);
  if (!/12 words/.test(bodies[1].messages.at(-1).content)) throw new Error('repair message did not include validator errors');
  if (!bodies[0].system.includes('explain-simulate-decide') || !bodies[0].system.includes('Shot types')) throw new Error('system prompt missing skill files');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/web-tool.png', fullPage: false });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#dlHtml')]).catch(async (e) => {
    console.log(await page.$$eval('#exportProgress li, #exportProgress .pg-status', (lis) => lis.map((l) => l.textContent).join('\n')));
    console.log(errors.join('\n'));
    throw e;
  });
  const path = 'test-results/web-download.html';
  await dl.saveAs(path);
  const size = statSync(path).size;
  if (size < 500_000) throw new Error(`downloaded HTML too small: ${size}`);
  console.log(`downloaded ${path} (${(size / 1e6).toFixed(1)} MB)`);
} finally {
  await browser.close();
  srv.close();
}
if (errors.length) {
  console.error('Errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('web check passed');
