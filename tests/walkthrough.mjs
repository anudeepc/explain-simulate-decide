// Records a screen walkthrough of an explainer page: parts of the film, then
// "Make it yours" (answers typed and picked), the clock running, a slider, and Decide.
// Usage: node tests/walkthrough.mjs <outDir> [page]   (default page: examples/solar/solar.html)
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const outDir = process.argv[2] || 'test-results/walkthrough';
const pagePath = process.argv[3] || 'examples/solar/solar.html';
const srv = serve();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const slide = async (id, to, ms = 1800) => {
  await page.evaluate(async ([id, to, ms]) => {
    const s = document.getElementById(`esd-${id}`);
    const from = Number(s.value), t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        s.value = String(from + (to - from) * e);
        s.dispatchEvent(new Event('input'));
        k < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, [id, to, ms]);
};
const playFrom = async (shot, seconds) => {
  await page.evaluate((shot) => {
    const seg = window.ESD.timeline.segments.find((s) => s.shot === shot);
    window.ESD.seek(seg.start);
    window.ESD.play();
  }, shot);
  await wait(seconds * 1000);
};

try {
  await page.goto(`${srv.url}/${pagePath}`);
  await page.waitForFunction(() => window.ESD?.duration, null, { timeout: 30000 });
  await page.evaluate(() => window.ESD.ready);
  await wait(800);
  await playFrom('establish', 21); // establish, sunlight, used as it's made, savings
  await playFrom('turn', 12); // the turning point, the battery
  await playFrom('timelapse', 9); // savings over the years
  await page.evaluate(() => window.ESD.enterAsk());
  await wait(2000);
  await page.click('#esd-ask-0');
  await page.keyboard.type('220', { delay: 160 });
  await wait(600);
  for (const label of ['California', 'Home most days', 'Store it in a home battery']) {
    await page.click(`.esd-ask button:has-text("${label}")`);
    await wait(900);
  }
  await wait(800);
  await page.click('text=Show me my numbers →');
  await wait(7500); // the clock runs 25 years with their numbers
  await slide('battery', 0, 2200);
  await wait(1200);
  await page.click('.esd-sim button:has-text("Run 25 years")');
  await wait(7000);
  await page.click('text=I’m ready to decide →');
  await wait(7000);
} finally {
  await ctx.close();
  await browser.close();
  srv.close();
}
console.log('saved video in', outDir);
