// Records a rendered page to MP4 in headless Chromium using the page's own
// in-browser recorder (WebCodecs), then saves it.
// Usage: node tests/record-mp4.mjs examples/solar/solar.html examples/solar/solar.mp4 [--channel chrome] [--size 1280x720] [--fps 30]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { serve } from './serve.mjs';

const [page = 'examples/solar/solar.html', out = 'examples/solar/solar.mp4'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const channel = flag('--channel');
const [width, height] = (flag('--size') || '1920x1080').split('x').map(Number);
const fps = Number(flag('--fps') || 60);
const srv = serve();
const browser = await chromium.launch({ channel, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu'] });
try {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true })).newPage();
  p.on('pageerror', (e) => console.error('page error:', e));
  await p.goto(`${srv.url}/${page}`);
  await p.waitForFunction(() => window.ESD?.duration, null, { timeout: 30000 });
  const codecs = await p.evaluate(async () => {
    const r = {};
    for (const c of ['avc1.640033', 'avc1.42003e', 'vp09.00.40.08']) r[c] = (await VideoEncoder.isConfigSupported({ codec: c, width: 1920, height: 1080, bitrate: 12e6, framerate: 60 })).supported;
    r.aac = 'AudioEncoder' in window && (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 })).supported;
    return r;
  });
  console.log('codecs', JSON.stringify(codecs));
  const t0 = Date.now();
  const timer = setInterval(async () => console.log('progress', await p.evaluate(() => Math.round((window.__p || 0) * 100)).catch(() => '?')), 15000);
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 20 * 60_000 }),
    p.evaluate(async ({ width, height, fps }) => {
      const blob = await window.ESD.record({ width, height, fps, onProgress: (x) => (window.__p = x) });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'film.mp4';
      document.body.append(a);
      a.click();
    }, { width, height, fps }),
  ]);
  clearInterval(timer);
  await dl.saveAs(out);
  console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally {
  await browser.close();
  srv.close();
}
