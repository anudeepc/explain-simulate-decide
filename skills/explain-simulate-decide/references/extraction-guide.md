# Extraction guide: finding the story in an article

A director starts with the one question the film answers, not with the camera. Read the whole article first. Then work through these steps, writing short notes before any JSON.

## 0. The person and their place

An answer that ignores where someone lives and what they pay is a guess. Before extracting anything, note what would make this answer personal:

- **What they can read off a bill or statement:** monthly power bill, loan balance, rent, current rate. These become `ask` questions with `input`.
- **What they know as a category:** their state or region, their habits ("home most days"), the option they lean toward. These become `ask` questions with `choices`, and each choice sets several inputs at once.
- **What depends on place and changes often:** install costs, prices, export credits, interest rates, incentives. Research these (web search), quote them with their URL and date, and offer a few regions as choices. If you can talk to the person, ask where they live first and research their area.

Don't ask the viewer for anything they can't answer in under a minute. Fill gaps with typical values labelled as assumptions.

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

## 1b. The options

Most decisions have 2–3 real alternatives: solar with or without a battery, fixed or variable rate, repair or replace. Name them. Each becomes:
- an input that switches it on (for example `battery` from 0 to 20 kWh), usually a lever;
- a node with `appears` if it adds a thing to the world (the battery);
- an entry in `decide.compare`, so the viewer sees every option side by side with their own numbers.

When an option rarely pays for itself but has other value (backup power, peace of mind), say so in `tradeoffs`. Don't hide it, and don't sell it.

## 2. Levers (2–4): what the person controls

Good levers are things the reader can actually change: system size, hours of use, the amount they borrow, how often they do something. A lever that nobody can move is a condition.

## 3. Conditions (1–5): what the person does not control

Prices, the weather, policy, interest rates, local install costs, their current bill. People really do face different values, so these are what the `ask` questions fill in.

## 4. Outcomes (1–2) and milestones (0–2): what the person cares about

Money per year, the bill after, hours of sleep, emissions. Pick at most two outputs. Anything measured in time ("years to pay back", "months until debt-free") is better as a **store + milestone**: the viewer watches the jar fill and the year it crosses the line.

## 5. The turning point

This is the thing most people get wrong, and the article's real insight. Look for sentences that start with "but", "however", "actually" or "it depends on", or for numbers the article says surprise people.

- Solar: "Every solar kWh saves the full price." In fact, exported power usually earns much less.
- Heat pump: "Heat pumps don't work in the cold." In fact, efficiency drops but stays well above 1.
- Mortgage: "A 1% rise means 1% more repayment." In fact, repayments rise far more than 1%.

The turning point becomes the single `turn` shot. Make it **visible in the world**: two money streams side by side (bill avoided vs export credit), a stream people forget (power bought at night), or a jar that never reaches its line. Add `drive` only if the surprise needs a sweep to show.

## 6. The limits

What does your small model leave out that could change the answer? Examples: incentives that change often, maintenance, the person's health or tax situation, behaviour changes, rare events. These go in `decide.leftOut`. Be honest. This list is what makes the page trustworthy.

## From notes to model

- **Use the article's numbers first.** Quote them exactly in `source.quotes` and point to them with `"quote": <index>`.
- **Fill the gaps with assumptions,** labelled `"source": "assumption"`. Pick ordinary middle values and sensible ranges. The viewer sees an asterisk and can change them.
- **Put meaningful numbers in `constants`** with a label and source. Only plain unit conversions (100, 365, 12, 24, 60, 1000…) may appear directly inside formulas.
- **Check the defaults give a believable answer** (for example, solar payback of 5–20 years, not 0.3 or 400).
- **Guard against outcomes that break.** If a value can reach zero or go negative, protect divisions with `max(x, 1)` and cap open-ended results with `min(…, 100)`. Then "never pays back" shows as 100 years instead of 8,000 or an error.
- **Keep formulas short.** A derived value per idea is easier to cast and to explain.

## Building the world

Next, map the system: what flows from where to where, and what builds up. Follow `system-guide.md`. Props come from `prop-catalog.md`. The viewer should be able to guess every node and stream with the sound off.
