# Extraction guide: finding the story in an article

A director starts with the one question the film answers, not with the camera. Read the whole article first. Then work through these six steps, writing short notes before any JSON.

## 1. The decision

Find the choice a reader of this article actually faces.

| Article | Weak framing | Strong framing |
|---|---|---|
| Home solar guide | "Solar energy explained" | "Should I put solar on my roof?" |
| Report on heat pumps | "Heat pump efficiency trends" | "Should I replace my gas heater with a heat pump?" |
| News: central bank raises rates | "Rates went up" | "What would change for my mortgage if rates rise again?" |
| Study on sleep and screens | "Screens affect sleep" | "What happens if I stop screens an hour before bed?" |

Rules:
- Write it from the reader's point of view ("I", "my").
- One decision only. If you find two, pick the one the article spends the most words on.
- News with no personal decision: "What would change if…?"

## 2. Levers (2–4): what the person controls

Good levers are things the reader can actually change: system size, hours of use, the amount they borrow, how often they do something. A lever that nobody can move is a condition.

## 3. Conditions (1–3): what the person does not control

Prices, the weather, policy, interest rates, where they live. These also become sliders, labelled "Depends on where you live" or similar, because people really do face different values.

## 4. Outcomes (1–2): what the person cares about

Money per year, years to pay back, hours of sleep, emissions. Pick at most two. If you have three, one is probably a derived value that the outcomes depend on.

## 5. The turning point

This is the thing most people get wrong, and the article's real insight. Look for sentences that start with "but", "however", "actually" or "it depends on", or for numbers the article says surprise people.

- Solar: "Every solar kWh saves the full price." In fact, exported power usually earns much less.
- Heat pump: "Heat pumps don't work in the cold." In fact, efficiency drops but stays well above 1.
- Mortgage: "A 1% rise means 1% more repayment." In fact, repayments rise far more than 1%.

The turning point becomes the single `turn` shot. Its `drive` should be the input that shows the surprise.

## 6. The limits

What does your small model leave out that could change the answer? Examples: incentives that change often, maintenance, the person's health or tax situation, behaviour changes, rare events. These go in `decide.leftOut`. Be honest. This list is what makes the page trustworthy.

## From notes to model

- **Use the article's numbers first.** Quote them exactly in `source.quotes` and point to them with `"quote": <index>`.
- **Fill the gaps with assumptions,** labelled `"source": "assumption"`. Pick ordinary middle values and sensible ranges. The viewer sees an asterisk and can change them.
- **Put meaningful numbers in `constants`** with a label and source. Only plain unit conversions (100, 365, 12, 24, 60, 1000…) may appear directly inside formulas.
- **Check the defaults give a believable answer** (for example, solar payback of 5–20 years, not 0.3 or 400).
- **Guard against outcomes that break.** If a value can reach zero or go negative, protect divisions with `max(x, 1)` and cap open-ended results with `min(…, 100)`. Then "never pays back" shows as 100 years instead of 8,000 or an error.
- **Keep formulas short.** A derived value per idea is easier to cast and to explain.

## Casting

Each actor plays one value. The viewer should be able to guess what the actor means without its label: a sun for sunshine, a bill for price, coins for savings, a clock for time. Put actors in the order the story meets them. That order also becomes their left-to-right order on stage. Six to eight actors is the sweet spot.
