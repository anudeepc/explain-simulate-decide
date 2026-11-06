// The picture keeps time with the music, even when frames are slow. Runs a page in a
// browser with no graphics chip (slow frames), plays for a while, and compares the
// film's clock with real time, which is what the music follows.
// Usage: node tests/audio-sync-check.mjs [page.html]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const page = process.argv[2] || 'examples/heat-pump/heat-pump.html';
const PLAY = 12; // seconds of real time
const srv = serve();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let drift = 0;
try {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto(`${srv.url}/${page}`);
  await p.waitForFunction(() => window.ESD?.duration);
  await p.evaluate(async () => {
    await window.ESD.ready;
    window.ESD.play();
  });
  const t0 = Date.now();
  await p.waitForTimeout(PLAY * 1000);
  const wall = (Date.now() - t0) / 1000;
  const [m, s] = (await p.$eval('.esd-time', (e) => e.textContent.split('/')[0].trim())).split(':').map(Number);
  const film = m * 60 + s;
  drift = wall - film;
  console.log(`after ${wall.toFixed(1)} s of real time, the film is at ${film} s (drift ${drift.toFixed(1)} s)`);
} finally {
  await browser.close();
  srv.close();
}
if (Math.abs(drift) > 1.5) {
  console.error('The picture fell behind the music.');
  process.exit(1);
}
console.log('audio sync check passed');
