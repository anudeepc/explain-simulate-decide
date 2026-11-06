import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inline, KEY } from '../skills/explain-simulate-decide/engine/bundle.js';
import { toHtml, assetsFor, needsHumans, HUMAN_ASSETS } from '../skills/explain-simulate-decide/engine/export.js';
import { existsSync, statSync } from 'node:fs';

const files = {
  'player.js': "import { a } from './lib/a.js';\nexport * from './lib/b.js';\n/* import { x } from 'three/addons/x.js' */\nimport './side.js';\nexport const p = a;",
  'lib/a.js': "import {\n  b,\n  c\n} from './b.js';\nexport const a = b + c;",
  'lib/b.js': "import { three } from '../vendor/t.js';\nexport const b = 1, c = 2;",
  'side.js': 'globalThis.side = 1;',
  'vendor/t.js': 'export const three = 3;',
};
const read = async (p) => {
  if (!(p in files)) throw new Error('missing ' + p);
  return files[p];
};

test('inline walks the import graph and rewrites relative specifiers', async () => {
  const { modules, entryKey } = await inline('player.js', read);
  assert.equal(entryKey, KEY + 'player.js');
  assert.deepEqual(Object.keys(modules).sort(), ['lib/a.js', 'lib/b.js', 'player.js', 'side.js', 'vendor/t.js'].map((p) => KEY + p).sort());
  for (const src of Object.values(modules)) assert.ok(!/from\s*['"]\.{1,2}\//.test(src) && !/import\s*['"]\.{1,2}\//.test(src), src);
  assert.match(modules[KEY + 'lib/b.js'], /from '@esd\/vendor\/t.js'/);
  assert.match(modules[KEY + 'player.js'], /three\/addons\/x.js/, 'comments are untouched');
});

test('toHtml builds a self-contained page', async () => {
  const bundle = await inline('player.js', read);
  const sp = { question: 'Is </script> safe?', explain: [] };
  const html = toHtml(sp, bundle, { title: 'Test <page>' });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /"importmap"/);
  assert.ok(!html.includes('Is </script> safe'), 'screenplay is escaped');
  assert.match(html, /<title>Test &lt;page&gt;<\/title>/);
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  const decoded = Buffer.from(map.imports[KEY + 'side.js'].split(',')[1], 'base64').toString();
  assert.equal(decoded, files['side.js']);
});

test('pages carry the rigged people only when the bundle uses them', async () => {
  const plain = await inline('player.js', read);
  assert.equal(needsHumans(plain), false);
  assert.deepEqual(await assetsFor(plain, () => assert.fail('no assets should be read')), {});
  const withHumans = { modules: { ...plain.modules, [KEY + 'cast/human.js']: 'export default 1;' }, entryKey: plain.entryKey };
  assert.equal(needsHumans(withHumans), true);
  const assets = await assetsFor(withHumans, (name) => new TextEncoder().encode(`bytes of ${name} <script>`));
  assert.deepEqual(Object.keys(assets), HUMAN_ASSETS);
  const html = toHtml({ question: 'q', explain: [] }, withHumans, { assets });
  for (const name of HUMAN_ASSETS) {
    const m = html.match(new RegExp(`<script type="application/octet-stream" id="esd-asset-${name}">([A-Za-z0-9+/=]*)</script>`));
    assert.ok(m, `asset ${name} is embedded`);
    assert.equal(Buffer.from(m[1], 'base64').toString(), `bytes of ${name} <script>`);
  }
});

test('the people\'s asset files exist and fit the budget', () => {
  let total = 0;
  for (const name of HUMAN_ASSETS) {
    const p = new URL(`../skills/explain-simulate-decide/engine/assets/${name}.glb`, import.meta.url);
    assert.ok(existsSync(p), `${name}.glb is built (node scripts/build-humans.mjs)`);
    total += statSync(p).size;
  }
  assert.ok(total < 3.2e6, `human assets are ${(total / 1e6).toFixed(2)} MB (budget about 3 MB)`);
});
