#!/usr/bin/env node
// Usage: node ste-check.mjs <file.md | screenplay.json> ...
// Checks the text in Markdown files and screenplays against ASD-STE100 Simplified Technical
// English: sentence length (20 words for a step, 25 for description), active voice, approved
// words, one idea per sentence. Prints each problem with its place; exits 1 if there are any.
import { readFileSync } from 'node:fs';
import { steProblems, markdownText, screenplayText, STE_MAX_WORDS } from '../engine/ste.js';

let count = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8');
  const items = file.endsWith('.json')
    ? screenplayText(JSON.parse(src)).map((x) => ({ at: x.where, text: x.text, maxWords: STE_MAX_WORDS }))
    : markdownText(src).map((x) => ({ at: `line ${x.line}`, text: x.text, maxWords: x.maxWords }));
  for (const it of items) {
    for (const p of steProblems(it.text, { maxWords: it.maxWords })) {
      count++;
      console.log(`${file} ${it.at}: ${p}`);
    }
  }
}
console.log(count ? `${count} problem(s).` : 'No problems: the text reads as ASD-STE100.');
process.exit(count ? 1 : 0);
