import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inline, KEY } from '../skills/explain-simulate-decide/engine/bundle.js';
import { toHtml } from '../skills/explain-simulate-decide/engine/export.js';

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
