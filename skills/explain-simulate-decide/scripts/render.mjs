#!/usr/bin/env node
// Usage: node render.mjs screenplay.json [-o out.html] [--cast auto|studio|open|custom] [--voice off|browser]
// Validates the screenplay, then writes one offline HTML file (engine + three.js inlined).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { validate } from '../engine/schema.js';
import { inline } from '../engine/bundle.js';
import { toHtml } from '../engine/export.js';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : def;
};
const out = flag('-o');
const cast = flag('--cast', 'auto');
const voice = flag('--voice', 'off');
const file = args[0];
if (!file) {
  console.error('Usage: node render.mjs <screenplay.json> [-o out.html] [--cast auto|studio|open|custom] [--voice off|browser]');
  process.exit(2);
}

const sp = JSON.parse(readFileSync(file, 'utf8'));
const errors = validate(sp);
if (errors.length) {
  console.error(`Cannot render. ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// open-library models are embedded so the page works offline
for (const c of sp.world.nodes) {
  if (c.url && !c.url.startsWith('data:')) {
    try {
      const bytes = c.url.startsWith('http') ? Buffer.from(await (await fetch(c.url)).arrayBuffer()) : readFileSync(resolve(dirname(file), c.url));
      c.url = `data:model/gltf-binary;base64,${bytes.toString('base64')}`;
    } catch (e) {
      console.warn(`Could not embed model for "${c.id}" (${e.message}); it will fall back to the studio cast.`);
      delete c.url;
    }
  }
}

const engineDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine');
const bundle = await inline('player.js', (p) => readFileSync(join(engineDir, p), 'utf8'));
const html = toHtml(sp, bundle, { options: { cast, voice } });
const target = out || join(dirname(file), basename(file).replace(/\.json$/, '') + '.html');
mkdirSync(dirname(target), { recursive: true }); // the output folder may not exist yet
writeFileSync(target, html);
console.log(`Wrote ${target} (${(html.length / 1e6).toFixed(1)} MB). Open it in a browser; use "Record MP4" for video.`);
