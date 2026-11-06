// Nothing the skill offers goes untested: every story shape, carrier and shot type is
// used by at least one screenplay in the repo, and every character kind has a look.
// (tests/cast-check.mjs then builds every prop and kind in a browser.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { STORY_SHAPES, CARRIERS, SHOTS, validate } from '../skills/explain-simulate-decide/engine/schema.js';
import { KINDS, PROPS } from '../skills/explain-simulate-decide/engine/cast/names.js';
import { KIND_LOOK } from '../skills/explain-simulate-decide/engine/cast/resolve.js';

const files = [
  ...readdirSync('examples').map((d) => `examples/${d}/screenplay.json`),
  ...readdirSync('tests/fixtures/shapes').map((f) => `tests/fixtures/shapes/${f}`),
  ...readdirSync('tests/fixtures/eval').map((d) => `tests/fixtures/eval/${d}/screenplay.json`),
].filter((f) => f.endsWith('.json') && existsSync(f));
const screenplays = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
const used = (pick) => new Set(screenplays.flatMap(pick));
const missing = (all, set) => all.filter((x) => !set.has(x));

test('every screenplay in the repo is valid', () => {
  for (const [i, sp] of screenplays.entries()) assert.deepEqual(validate(sp), [], files[i]);
});

test('every story shape is used', () => {
  assert.deepEqual(missing(STORY_SHAPES, used((s) => [s.shape])), []);
});

test('every carrier is used', () => {
  assert.deepEqual(missing(CARRIERS, used((s) => s.world.flows.map((f) => f.carrier))), []);
});

test('every shot type is used', () => {
  assert.deepEqual(missing(SHOTS, used((s) => s.explain.map((x) => x.shot))), []);
});

test('every kind has a look made of real props or shapes', () => {
  for (const k of KINDS) {
    const look = KIND_LOOK[k];
    assert.ok(look, `kind "${k}" has no look`);
    assert.ok(look.recipe || PROPS.includes(look.prop), `kind "${k}" points at unknown prop "${look.prop}"`);
  }
});
