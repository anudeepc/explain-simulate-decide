#!/usr/bin/env node
// Usage: node validate.mjs screenplay.json
// Prints every problem in plain English. Exit code 0 = valid, 1 = needs fixing.
import { readFileSync } from 'node:fs';
import { validate } from '../engine/schema.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate.mjs <screenplay.json>');
  process.exit(2);
}
let sp;
try {
  sp = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Not valid JSON: ${e.message}`);
  process.exit(1);
}
const errors = validate(sp);
if (errors.length) {
  console.error(`${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`OK: "${sp.question}" — ${sp.explain.length} shots, ${sp.world.nodes.length} nodes, ${sp.world.flows.length} flows, ${sp.model.inputs.length} inputs.`);
