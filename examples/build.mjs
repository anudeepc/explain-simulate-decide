// Rebuild every example page from its screenplay. Each page carries its own copy of
// the engine, so run this after any change to the engine or a screenplay:
//   npm run render:examples
// tests/examples.test.mjs fails if a committed page is out of date.
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const render = 'skills/explain-simulate-decide/scripts/render.mjs';
for (const name of readdirSync('examples')) {
  const sp = `examples/${name}/screenplay.json`;
  if (!existsSync(sp)) continue;
  execFileSync('node', [render, sp, '-o', `examples/${name}/${name}.html`], { stdio: 'inherit' });
}
