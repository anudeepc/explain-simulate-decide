# Rules for the text

The goal is more understanding, not persuasion. A smart 12-year-old must be able to follow each caption.

## Captions

- **12 words or fewer.** One idea. Present tense. Speak to the viewer ("your roof", "you pay").
- **Plain words.** Use the plain, approved words of ASD-STE100 (see rule 3 in "All viewer text is ASD-STE100").
- **Explain a term in its own shot before a later shot uses it.** Example: "Payback is the years until savings cover the cost."
- **Numbers go on the nodes and the readouts,** not in the captions. Captions explain relationships ("more sun means more power").
- **Captions read as one story.** Use "But…" only on the `turn` shot. Use "So…" for the consequence.

## Questions the page asks (`ask`)

- **Plain and easy to answer.** "What is your average monthly power bill?", not "Enter household consumption".
- **Say where to find the answer** in `help`: "It's on the front of your bill."
- **Choices for categories** (state, habits, which option). Use 2–5 short labels that a person would say ("Home most days").
- **Always give a "don't know" choice.** One choice sets exactly the default values: "Not sure", "About average", "Somewhere else". The recorded film also shows that answer.
- **Never ask the viewer to do arithmetic.** If a bill uses a different unit, ask a category question ("Is gas cheap or pricey where you live?").
- **Never ask for anything that tells who the viewer is.** Ask for a state or region, not an address. Ask for a bill amount, not an account number.

## Labels

Input and output labels are short nouns that a person would say: "Price you pay for power", not "Retail tariff (c/kWh)".

## Decide

- **tradeoffs:** real tensions. Each one has both sides ("needs little upfront, but you don't own it").
- **leftOut:** the honest limits of the model. Also anything that changes often (incentives, prices, rules), with "check what applies to you".
- **questionsToAsk:** questions that the viewer can take to a professional, a utility, a doctor or a seller.
- **Never recommend.** Do not write "you should", "the best option" or "we recommend". The page shows. The viewer decides.

## Words we don't use

- "Gamified" or "gamification". Call it a guide, a simulation or a model.
- "Engagement". Say "understanding".
- Hype: "revolutionary", "game-changing", "unlock", "supercharge".
- Fear or urgency: "don't miss out", "act now", "before it's too late".

## Honesty

- **Article numbers:** quote them exactly in `source.quotes`.
- **Assumptions:** label them. The page shows them with an asterisk.
- **Ranges:** cover realistic cases. Include cases that make the option look bad.

## All viewer text is ASD-STE100

All text that the viewer reads in the film follows the main rules of ASD-STE100, Simplified Technical English (Issue 9). This includes:

- the captions of shots and beats
- the labels of nodes, flows, inputs, outputs, stores, milestones and choices
- the `question` and the `story.logline`
- each `note`
- the `ask` questions, their `help` and their `choices`
- the `simulate.prompt`
- all Decide text: `compare`, `tradeoffs`, `leftOut` and `questionsToAsk`.

The `source.quotes` stay word for word. They are the source's own words, so the checker does not read them.

The validator checks the text of every screenplay against these rules. To see each problem with its fix, run:

```bash
node scripts/ste-check.mjs screenplay.json
```

Fix each problem. Then run the command again until it prints "No problems". Write real ASD-STE100. Do not change the text only to hide a problem from the checker.

The checker is `steProblems(text)` in `engine/ste.js`. It checks five rules:

1. **Short sentences.** Each sentence has 20 words or fewer (`STE_MAX_WORDS`). STE allows 25 words in descriptive text. Film text is shorter. A caption also has the limit of 12 words.
2. **Active voice.** A form of "be" or "get" before a past participle makes a passive: `is sent`, `are found`, `got paid`, `has been checked`. The passive hides who does the action. Say who does it. A state is correct: "is ready", "is free", "is closed", "is open", "are tired", "is gone", "is unexplained". A form of "be" before an -ing word is also correct ("is coming").
3. **Plain, approved words.** The list `STE_WORDS` has about 250 long or formal words. It also has phrases. Each one has a plain word to use instead. The checker finds each form of a word (`requires`, `required`). It does not flag names (`Individual Savings Account`). Some examples:

   | Instead of | Write |
   |---|---|
   | `approximately` | about |
   | `prior to` | before |
   | `require` | need |
   | `utilise` | use |
   | `generation` | power made |
   | `exported` | sent to the grid |
   | `remuneration` | payment |

4. **One idea per sentence.** Do not put a semicolon between two ideas. A sentence can have one `and`, `but` or `or`. A sentence with two or more of these words has too many ideas. A `But` or `So` at the start of a sentence links it to the line before. It does not count.
5. **No -ing word to open a sentence.** STE does not use the -ing form as a noun. `Screening finds...` becomes "The test finds...". Plain nouns are correct: "Nothing", "Something", "Everything", "Morning", "Evening", "During", "Heating".

The checker does not flag contractions ("don't", "it's"), numbers, units or names.

| Before | After |
|---|---|
| `The sample is sent to the lab.` | You send the sample to the lab. |
| `Fewer cancers are found early.` | Tests find fewer cancers early. |
| `When will it be cleared?` | When will you clear it? |
| `Approximately 2 in 100 have cancer.` | About 2 in 100 have cancer. |
| `Utilize the kit prior to the deadline.` | Use the kit before the deadline. |
| `New purchases add to the debt.` | Things you buy add to the debt. |
| `What does a vaccine actually do?` | What does a vaccine do? |
| `Screening identifies cancers early; treatment is easier.` | The test finds cancers early. Then treatment is easier. |
| `Working from home cuts the commute.` | At home, you have no commute. |
| `You can wait, or you can test, but you must decide.` | You can wait. You can do the test. You decide. |
