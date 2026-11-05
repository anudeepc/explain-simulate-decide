// Records a screen walkthrough of the web tool: landing → Demo generate → film →
// Simulate (sliders move) → Decide. Output: a WebM in the given folder.
// Usage: node tests/walkthrough.mjs <outDir>
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const outDir = process.argv[2] || 'test-results/walkthrough';
const srv = serve();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const scrollTo = async (y, ms = 1200) => {
  await page.evaluate(async ([y, ms]) => {
    const start = scrollY, t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        scrollTo(0, start + (y - start) * e);
        k < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, [y, ms]);
};
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

try {
  await page.goto(`${srv.url}/web/`);
  await wait(2500);                                   // hero
  await scrollTo(520); await wait(4500);              // before / after
  const make = await page.$eval('#make', (el) => el.getBoundingClientRect().top + scrollY - 20);
  await scrollTo(make); await wait(1500);
  await page.fill('#article', 'Paste any article here: a report, a guide, a policy, a study…');
  await wait(800);
  await page.selectOption('#provider', 'demo'); await wait(800);
  await page.click('#generate');
  await page.waitForFunction(() => [...document.querySelectorAll('#log li')].some((li) => /Ready/.test(li.textContent)), null, { timeout: 60000 });
  await wait(1500);
  const stageTop = await page.$eval('#stage', (el) => el.getBoundingClientRect().top + scrollY - 10);
  await scrollTo(stageTop, 900);
  await page.evaluate(() => window.ESDTool.player.play());
  await wait(26000);                                  // first part of the film
  await page.evaluate(() => window.ESDTool.player.seek(38));
  await page.evaluate(() => window.ESDTool.player.play());
  await wait(12000);                                  // turning point → handoff
  await page.evaluate(() => window.ESDTool.player.enterLive());
  await wait(2500);
  await slide('size', 9); await wait(800);
  await slide('selfUse', 80); await wait(800);
  await slide('price', 0.4); await wait(800);
  await slide('exportRate', 0.02); await wait(1500);
  await page.click('text=I’m ready to decide →');
  await wait(6000);
} finally {
  await ctx.close();
  await browser.close();
  srv.close();
}
console.log('saved video in', outDir);
