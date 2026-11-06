import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steProblems, sentences, STE_MAX_WORDS, STE_WORDS } from '../skills/explain-simulate-decide/engine/ste.js';

const clean = (t) => assert.deepEqual(steProblems(t), [], `expected no problems for: ${t}`);
const flags = (t, pattern) => {
  const p = steProblems(t);
  assert.ok(p.some((m) => pattern.test(m)), `expected ${pattern} for "${t}" in:\n${p.join('\n')}`);
};

test('natural narration passes', () => {
  [
    'A letter arrives. It is your turn for the test.',
    'It takes two minutes. You post it back.',
    'The lab looks for blood you cannot see.',
    'Most kits find nothing. That is the usual result.',
    'Some people get a letter that asks them to come in.',
    'A camera looks inside the bowel.',
    'Most people who come in do not have cancer.',
    'In two years, the next kit arrives. You decide.',
    'Morning. Sunlight lands on your panels.',
    "Your home runs on it. That's power you don't buy.",
    'Rain, heavy loads and long trips may still send you by car.',
  ].forEach(clean);
});

test('exports the limit and the word list', () => {
  assert.equal(STE_MAX_WORDS, 20);
  assert.ok(Object.keys(STE_WORDS).length >= 150);
  assert.equal(STE_WORDS.utilize, 'use');
  assert.equal(STE_WORDS['prior to'], 'before');
  assert.deepEqual(steProblems(''), []);
  assert.deepEqual(steProblems(undefined), []);
});

test('sentences split at full stops, not inside numbers', () => {
  assert.deepEqual(sentences('It costs 2.5 dollars. Is it worth it? Yes!'), ['It costs 2.5 dollars.', 'Is it worth it?', 'Yes!']);
});

test('sentence length: at most 20 words', () => {
  const twenty = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.';
  clean(twenty);
  flags(`${twenty.slice(0, -1)} more.`, /has 21 words.*20 words or fewer/);
  clean(`${twenty} ${twenty}`); // two sentences of 20 are fine
});

test('active voice: flags be/get + past participle', () => {
  flags('The sample is sent to the lab.', /"is sent" is passive/);
  flags('Fewer cancers are found early.', /"are found" is passive/);
  flags('The results are often checked twice.', /"are often checked" is passive/);
  flags('It was given to you.', /"was given" is passive/);
  flags('The kit has been lost.', /"been lost" is passive/);
  flags('Your kit is being tested.', /"is being tested" is passive/);
  flags('When will it be cleared?', /"be cleared" is passive/);
  flags('You get paid each month.', /"get paid" is passive/);
  flags("They're tested twice.", /"They're tested" is passive/);
  flags('It is not shown on the bill.', /"is not shown" is passive/);
});

test('active voice: states, -ing and adjectives are not passive', () => {
  [
    'The kit is ready.',
    'The test is free.',
    'Most people are well.',
    'That is the usual result.',
    'The shop is open. The road is closed.',
    'Summer is coming.',
    'You are tired. You get tired.',
    'The pain is gone. Nothing is left.',
    'The blood is unexplained.',
    'The house is red. A hundred people came.',
    'You get used to the cold.',
    'You are born with it.',
    'The results are mixed.',
    'Ted is here. It is Fred.',
  ].forEach(clean);
});

test('approved words: flags the word and gives the replacement', () => {
  flags('Approximately 2 in 100 have cancer.', /Use "about" instead of "Approximately"/);
  flags('Utilize the kit prior to the deadline.', /Use "use" instead of "Utilize"/);
  flags('Utilize the kit prior to the deadline.', /Use "before" instead of "prior to"/);
  flags('The kit requires a sample.', /Use "need" instead of "requires" \(in the matching form\)/);
  flags('Individuals over 50 get a kit.', /Use "person" or "people" instead of "Individuals"/);
  flags('Make sure you ensure it is dry.', /Use "make sure" instead of "ensure"/);
  flags('What does a vaccine actually do?', /Delete "actually"/);
  flags('You must terminate the plan in order to save.', /"in order to"/);
  flags('The majority of kits find nothing.', /Use "most" instead of "majority"/);
  // Whole words only, and a name in the middle of a sentence is left alone.
  clean('The user has a usable kit.');
  clean('Pay with your Individual Savings Account.');
  clean('Approx 2 in 100.');
});

test('one idea per sentence: semicolons and chains of and/but/or', () => {
  flags('Screening identifies cancers early; treatment is easier.', /Split "cancers early; treatment is" into two sentences/);
  flags('You can wait, or you can test, but you must decide.', /joins ideas with "or", "but"/);
  clean('More tests catch more cases, and cause more false alarms.');
  clean('But nearly all of the minimum goes on interest.');
  clean('But you wait and see.'); // the opening "But" links to the previous line
});

test('-ing words: a sentence does not open with one', () => {
  flags('Screening finds some cases early.', /"Screening" opens the sentence as an -ing word/);
  flags('But dimming the screen barely helps.', /"dimming" opens the sentence/);
  flags('It takes a minute. Putting it away helps.', /"Putting" opens the sentence/);
  ['Nothing changes.', 'Something stays.', 'Everything adds up.', 'Morning.', 'Evening falls.', 'During the night, the tank fills.', 'Spring is here.', 'Bring the kit.', 'Heating costs rise.'].forEach(clean);
  clean('You keep screening every two years.'); // only the start of a sentence is checked
});

test('the must-fail lines all fail', () => {
  ['The sample is sent to the lab.', 'Approximately 2 in 100 have cancer.', 'Utilize the kit prior to the deadline.', 'Screening identifies cancers early; treatment is easier.'].forEach((t) =>
    assert.ok(steProblems(t).length > 0, t),
  );
  assert.equal(steProblems('Screening identifies cancers early; treatment is easier.').length, 3);
});

test('numbers, units and contractions are never flagged', () => {
  clean('It costs $1,200 a year: 4.5 kWh a day, 10% less.');
  clean("You don't pay. It's yours. We'll see.");
});
