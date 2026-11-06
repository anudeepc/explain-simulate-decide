# Extraction guide: how to find the story in an article

A director starts with the one question that the film answers, not with the camera. Read the whole article first. Then do the steps below. Write short notes before you write any JSON.

## 0. The person and their place

An answer that ignores where someone lives and what they pay is a guess. Before you extract anything, note what would make this answer personal:

- **What their bills and statements show:** the monthly power bill, the loan balance, the rent, the current rate. These become `ask` questions with `input`.
- **What they know as a category:** their state or region, their habits ("home most days"), the option that they prefer. These become `ask` questions with `choices`. Each choice sets several inputs at the same time.
- **What depends on place and changes often:** install costs, prices, export credits, interest rates, incentives. Do a web search to find these values. Quote them word for word. Give the URL and the date that you read them. Offer a few regions as choices. If you can talk to the person, ask where they live first. Then research their area.

Do not ask the viewer for anything that they cannot answer in less than a minute. Fill the gaps with typical values, and label them as assumptions.

## 1. The decision

Find the choice that a reader of this article really has.

| Article | Weak framing | Strong framing |
|---|---|---|
| Home solar guide | "Solar energy explained" | "Should I put solar on my roof?" |
| Report on heat pumps | "Heat pump efficiency trends" | "Should I replace my gas heater with a heat pump?" |
| News: central bank raises rates | "Rates went up" | "What would change for my mortgage if rates rise again?" |
| Study on sleep and screens | "Screens affect sleep" | "What happens if I stop screens an hour before bed?" |

Rules:
- Write the decision from the reader's point of view ("I", "my").
- Use one decision only. If you find two, choose the one that the article gives the most words to.
- If the news has no personal decision, use "What would change if…?"

## 1b. The options

Most decisions have 2–3 real alternatives. For example:
- solar with a battery or without one
- a fixed rate or a variable rate
- repair or replace.

Name the options. Each option becomes:
- an input that switches it on (for example `battery` from 0 to 20 kWh). Usually this input is a lever.
- a node with `appears`, if the option adds a thing to the world (the battery).
- an entry in `decide.compare`. Then the viewer sees every option side by side, with their own numbers.

Sometimes an option rarely pays for itself, but it has other value (backup power, peace of mind). Then say this in `tradeoffs`. Do not hide it. Do not sell it.

## 2. Levers (1–4): what the person controls

Use only the choices that the person really has. Do not add a lever only to fill a slot. A decision that is only "take part or not" has one lever.

Good levers are things that the reader can change: system size, hours of use, the amount they borrow, how often they do something. If nobody can move a lever, it is a condition.

## 3. Conditions (1–5): what the person does not control

Prices, the weather, policy, interest rates, local install costs, the person's current bill. Different people have different values for these. That is why the `ask` questions set them.

## 4. Outcomes (1–2) and milestones (0–2): what the person cares about

Money per year, the bill after, hours of sleep, emissions. Choose two outputs at most.

Some outcomes are a time, for example "years to pay back" or "months until debt-free". Make each of these a **store + milestone**. Then the viewer watches the jar fill, and sees the year that it crosses the line.

## 5. The turning point

This is the thing that most people get wrong. It is the real insight of the article. Look for sentences that start with one of these words: `but`, `however`, `actually`, `it depends on`. Also look for numbers that the article says surprise people.

- Solar: "Every solar kWh saves the full price." In fact, the power that you export usually earns much less.
- Heat pump: "Heat pumps don't work in the cold." In fact, efficiency drops but stays well above 1.
- Mortgage: "A 1% rise means 1% more repayment." In fact, repayments rise by much more than 1%.

The turning point becomes the single `turn` shot. Make it **visible in the world**. For example:
- two money flows side by side (bill avoided vs export credit)
- a flow that people forget (the power that they buy at night)
- a jar that never gets to its line.

Add `drive` only if the surprise needs a sweep to show it.

## 5b. Checkable claims

Collect every sentence where the article says what a result looks like. There are three types:
- a figure ("most systems pay back in 6 to 12 years")
- a size of effect ("each hour of screens before bed costs about 20 minutes of sleep")
- a direction ("the more you pay each month, the sooner you're clear").

These sentences become `checks`. The validator tests your model against them. Quote figures exactly. If the article has no figure, write a sensible range with a `reason`.

## 6. The limits

Which things could change the answer, but your small model does not include them? Examples: incentives that change often, maintenance, the person's health or tax situation, changes in behaviour, rare events. Put these in `decide.leftOut`. Be honest. This list makes the page trustworthy.

## From notes to model

First, choose the shape (`story-shapes.md`). If the article has no numbers that a reader could change, the shape is `process`. Then do not write a model or checks.

- **Give every value a unit** (`"$/yr"`, `"h/night"`, `"%"`, `"people"`). The validator checks every formula against these units.
- **Use the article's numbers first.** Quote them exactly in `source.quotes`. Point to them with `"quote": <index>`.
- **Fill the gaps with assumptions.** Label them `"source": "assumption"`. Choose ordinary middle values and sensible ranges. The viewer sees an asterisk and can change them.
- **Put meaningful numbers in `constants`,** with a label and a source. Only plain unit conversions (100, 365, 12, 24, 60, 1000…) can be directly in formulas.
- **Check that the defaults give a believable answer.** For example, solar payback is 5–25 years. It is not 0.3 years or 400 years.
- **Guard against outcomes that break.** If a value can be zero or less, protect divisions with `max(x, 1)`. Cap open-ended results with `min(…, 100)`. Then "never pays back" shows as 100 years, not as 8,000 or an error.
- **Keep formulas short.** One derived value for each idea is easier to show in the world and to explain.

## Build the world

Next, map the system: what flows from where to where, and what builds up. Follow `system-guide.md`. Props come from `prop-catalog.md`. The viewer should be able to guess every node and flow with the sound off.
