// The skill speaks ASD-STE100: its own instructions (SKILL.md and the references) and the
// text every example film shows. Same checker as scripts/ste-check.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { steProblems, markdownText, screenplayText } from '../skills/explain-simulate-decide/engine/ste.js';

const skill = new URL('../skills/explain-simulate-decide/', import.meta.url);
const docs = ['SKILL.md', ...readdirSync(new URL('references/', skill)).filter((f) => f.endsWith('.md')).map((f) => `references/${f}`)];

for (const doc of docs) {
  test(`${doc} is written in ASD-STE100`, () => {
    const problems = markdownText(readFileSync(new URL(doc, skill), 'utf8')).flatMap((x) => steProblems(x.text, { maxWords: x.maxWords }).map((p) => `line ${x.line}: ${p}`));
    assert.deepEqual(problems, [], `${problems.length} problem(s) — run: node skills/explain-simulate-decide/scripts/ste-check.mjs skills/explain-simulate-decide/${doc}`);
  });
}

test('every example film shows ASD-STE100 text', () => {
  for (const name of ['bowel-screening', 'heat-pump', 'solar']) {
    const sp = JSON.parse(readFileSync(new URL(`../examples/${name}/screenplay.json`, import.meta.url), 'utf8'));
    const problems = screenplayText(sp).flatMap((x) => steProblems(x.text).map((p) => `${x.where}: ${p}`));
    assert.deepEqual(problems, [], `${name}: ${problems.join('\n')}`);
  }
});

test('the checker leaves code, links and quotes alone, and knows a step from a description', () => {
  const md = '---\nname: x\ndescription: Turn an article into a film.\n---\n# Title\n\nUse `a_field_that_is_used` here.\n\n```json\n{"caption": "The kit is sent by us and then it is checked and returned."}\n```\n- A list item is a step.\n';
  const items = markdownText(md);
  assert.deepEqual(items.map((x) => x.text), ['Turn an article into a film.', 'Title', 'Use X here.', 'A list item is a step.']);
  assert.deepEqual(items.map((x) => x.maxWords), [25, 25, 25, 20]);
  const sp = { question: 'Should I?', source: { quotes: ['It is sent by post.'] }, explain: [{ shot: 'scene', caption: 'You post it.' }] };
  assert.deepEqual(screenplayText(sp).map((x) => x.text), ['Should I?', 'You post it.']);
});
