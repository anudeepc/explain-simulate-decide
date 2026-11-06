// The example pages embed the engine, so they go stale whenever the engine or a
// screenplay changes. This fails until `npm run render:examples` has been run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'esd-'));
for (const name of readdirSync('examples').filter((n) => existsSync(`examples/${n}/screenplay.json`))) {
  test(`examples/${name}/${name}.html is built from the current engine and screenplay`, () => {
    const out = join(dir, `${name}.html`);
    execFileSync('node', ['skills/explain-simulate-decide/scripts/render.mjs', `examples/${name}/screenplay.json`, '-o', out], { stdio: 'ignore' });
    const fresh = readFileSync(out, 'utf8');
    const committed = readFileSync(`examples/${name}/${name}.html`, 'utf8');
    assert.ok(fresh === committed, `examples/${name}/${name}.html is stale: run npm run render:examples`);
  });
}
