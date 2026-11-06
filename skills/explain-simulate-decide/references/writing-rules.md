# Writing rules

The goal is more understanding, not persuasion. A smart 12-year-old should follow every caption.

## Captions

- **12 words or fewer.** One idea. Present tense. Speak to the viewer ("your roof", "you pay").
- **Plain words.**

  | Instead of | Write |
  |---|---|
  | utilise | use |
  | approximately | about |
  | generation | power made |
  | exported | sent to the grid |
  | remuneration | payment |

- **Explain a term in its own shot before any later shot uses it.** Example: "Payback is the years until savings cover the cost."
- **Numbers belong to the actors and readouts,** not the captions. Captions explain relationships ("more sun means more power").
- **Captions read as one story.** Use "But…" only on the `turn` shot, and "So…" for the consequence.

## Questions the page asks (`ask`)

- **Plain and answerable.** "What is your average monthly power bill?", not "Enter household consumption".
- **Say where to find the answer** in `help`: "It's on the front of your bill."
- **Choices for categories** (state, habits, which option). Use 2–5 short labels a person would say ("Home most days").
- **Always offer "don't know".** One choice sets exactly the default values: "Not sure", "About average", "Somewhere else". The recorded film shows that answer too.
- **Never ask the viewer to do arithmetic.** If a bill uses another unit, ask a category question instead ("Is gas cheap or pricey where you live?").
- **Never ask for anything identifying.** Ask for a state or region, not an address. Ask for a bill amount, not an account number.

## Labels

Input and output labels are short nouns a person would say: "Price you pay for power", not "Retail tariff (c/kWh)".

## Decide

- **tradeoffs:** real tensions, each with both sides ("needs little upfront, but you don't own it").
- **leftOut:** honest limits of the model, and anything that changes often (incentives, prices, rules), with "check what applies to you".
- **questionsToAsk:** questions the person can take to a professional, a utility, a doctor or a seller.
- **Never recommend.** No "you should", "the best option", "we recommend". The page shows; the person decides.

## Words we don't use

- "Gamified" or "gamification". Call it a guide, a simulation or a model.
- "Engagement". Say "understanding".
- Hype: "revolutionary", "game-changing", "unlock", "supercharge".
- Fear or urgency: "don't miss out", "act now", "before it's too late".

## Honesty

- **Article numbers** are quoted exactly in `source.quotes`.
- **Assumptions** are labelled; the page shows them with an asterisk.
- **Ranges** cover realistic cases, including ones that make the option look bad.

## Subtitles in ASD-STE100 style

Subtitles follow the main rules of ASD-STE100, Simplified Technical English (Issue 9). The checker in `engine/ste.js` (`steProblems(text)`) reads each subtitle and says exactly what to change. It checks five things:

1. **Short sentences.** 20 words or fewer in each sentence (`STE_MAX_WORDS`). STE allows 25 in descriptive text; subtitles are shorter.
2. **Active voice.** A form of "be" or "get" followed by a past participle ("is sent", "are found", "got paid", "has been checked") hides who acts. Say who does it. States are fine: "is ready", "is free", "is closed", "is open", "are tired", "is gone", "is unexplained". So is "is" + an -ing word ("is coming").
3. **Plain, approved words.** About 250 long or formal words and phrases have a plain word to use instead (`STE_WORDS`): "approximately" becomes "about", "prior to" becomes "before", "require" becomes "need". The checker finds every form ("requires", "required") and leaves names alone ("Individual Savings Account").
4. **One idea per sentence.** No ";" between two ideas. No sentence that chains ideas with two or more "and", "but" or "or". A "But" or "So" at the start links to the line before and does not count.
5. **No -ing word to open a sentence.** STE does not use the -ing form as a noun. "Screening finds..." becomes "The test finds...". Plain nouns are fine: "Nothing", "Something", "Everything", "Morning", "Evening", "During", "Heating".

It does not flag contractions ("don't", "it's"), numbers, units or names.

| Before | After |
|---|---|
| The sample is sent to the lab. | You send the sample to the lab. |
| Fewer cancers are found early. | Tests find fewer cancers early. |
| When will it be cleared? | When will you clear it? |
| Approximately 2 in 100 have cancer. | About 2 in 100 have cancer. |
| Utilize the kit prior to the deadline. | Use the kit before the deadline. |
| New purchases add to the debt. | Things you buy add to the debt. |
| What does a vaccine actually do? | What does a vaccine do? |
| Screening identifies cancers early; treatment is easier. | The test finds cancers early. Then treatment is easier. |
| Working from home cuts the commute. | At home, you have no commute. |
| You can wait, or you can test, but you must decide. | You can wait. You can do the test. You decide. |
