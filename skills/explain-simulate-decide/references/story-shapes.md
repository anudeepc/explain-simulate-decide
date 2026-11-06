# Story shapes: choosing the right world for any article

Articles explain very different things: money piling up, a habit that costs sleep, a test that sometimes gets it wrong, a law moving through parliament. One kind of world can't show them all. Before mapping anything, decide which **shape** the story has. The shape tells you what the characters are, what moves between them, what the viewer can change, and how to check the model.

Write it as `"shape"` at the top of the screenplay. The validator checks that the world fits it.

## Choosing the shape

**The shape is the shape of the answer the reader is asking for.** First write the question ("Will I clear my card?", "How much sleep do screens cost me?"). Then find the row whose result matches it:

| Question about the article | Shape |
|---|---|
| Are there no numbers a reader could change, only steps or parts? | `process` |
| Is the answer a chance or a risk, such as "4 in 100 people"? | `chances` |
| Does a result feed back into its own cause, so it speeds up or slows down? (interest on a balance, an epidemic, ice melting and warming) | `feedback` |
| Does something pile up or run down over time? (savings, debt, water in a tank, sleep debt, weight) | `build-up` |
| Is a fixed amount shared between uses that compete? (the hours of a day, a pay packet, a field) | `budget` |
| Is one thing turned into another, with losses along the way? (fuel into power, food into energy, applicants into hires) | `conversion` |
| Does one thing raise or lower another by an amount the article gives, with nothing moving between them? (screens and sleep, a tax and prices) | `cause` |

Several rows often fit, because one world can hold several of these. Read the rows as a list of patterns to recognise, not a sequence to stop in. Choose by the question:
- "Will I pay off my card?" asks about a balance that feeds itself: `feedback`.
- "How much sleep do screens cost me tonight?" asks about an effect: `cause`.
- "How much sleep debt will I have by Friday?" asks about something piling up: `build-up`.
- "Is the e-bike or the car better for the trip?" asks about turning energy into distance: `conversion`.

**Shapes borrow from each other.** The shape names the main result, and the validator checks only that part. A `build-up` world may also have `influence` links (screens pushing on sleep, with the debt piling up), and a `conversion` world may also have a store (money saved). Use whatever the story needs around the main result.

A shape is not a topic. Health, money, climate and politics can each take any shape.

## Characters for any topic

Every character has a **role** in the story and a **kind** that sets how it looks.

**Roles** (for your own thinking; they decide where flows start and end):
- **Source:** where something comes from (the sun, your pay, a doctor's advice).
- **Converter:** what turns one thing into another (panels, a body, a factory).
- **Store:** what fills or empties over time (savings, a reservoir, sleep debt).
- **End point:** where something ends up (your home, the air, a hospital).
- **Outside party:** something big that trades with the reader (the grid, a bank, the government).
- **Cause:** something that pushes on something else without anything moving (a habit, a price, a rule).

**Kinds.** If a studio prop fits exactly, use `prop`. Otherwise give `kind` and the renderer picks a look:

| `kind` | Looks like | For |
|---|---|---|
| `person` | a figure with a bar | one person, "you", a worker |
| `crowd` | 100 small people | a population, "people like you", chances |
| `body` | a standing figure with a glowing heart | health, symptoms, fitness, a dose |
| `home` | a house | a household, home life |
| `building` | an office block | a school, hospital, council, office, company |
| `institution` | a columned building | a bank, court, parliament, tax office, regulator |
| `business` | a pale office block | a shop, employer, insurer |
| `factory` | a factory | industry, production |
| `farm`, `land` | a grassy hill with trees and a field | farming, land use, a region |
| `nature` | a tree | forests, ecosystems |
| `water` | a drop | rivers, rain, water use |
| `weather`, `sun` | a cloud, the sun | weather, climate, daylight (usually `"sky": true`) |
| `vehicle` | a car | travel, transport |
| `machine`, `device`, `screen` | a gauge, a plug, a phone | equipment, appliances, apps |
| `document` | a stack of pages | a law, a contract, a report |
| `money` | a coin stack | cash, a fund |
| `store` | a glass tank | anything that builds up that isn't money |
| `food`, `medicine` | a shopping bag, a pill bottle | diet, drugs |
| `time` | a clock | hours, deadlines |
| `cell`, `germ` | a cell with a nucleus, a spiky germ | biology, infections, the immune system |
| `other` | a labelled block | anything else |

Store nodes can leave out both `prop` and `kind`: the renderer picks from the store's unit. Money gets a jar of coins, energy gets a battery, and everything else gets a tank. **A jar of coins is only for money.** The validator rejects a jar for sleep or carbon.

## Units: say what every number is

Every input, constant, derived value, output, store and flow has a `unit`, and the validator checks that every formula comes out in it. This catches the most common mistakes: a missing × 365, a percent not divided by 100, kWh added to dollars.

- **Write rates per time:** `"$/yr"`, `"kWh/yr"`, `"h/night"`, `"cigarettes a day"`. A yearly saving is `"$/yr"`, not `"$"`. A system cost paid once is `"$"`.
- **Write what is counted** when nothing standard fits: `"people"`, `"patients/yr"`, `"trees"`, `"tests"`. Any word works and plurals don't matter, but use the same word every time.
- **Percents are `"%"`** and need `/ 100` in formulas. A plain ratio, such as efficiency 0.8, is `""`.
- **Known units convert:** time (s, min, h, day, night, week, month, yr), energy (J, kWh, kcal, BTU, therm), power (W, kW), mass (g, kg, t, lb), length, area, volume (L, gal) and temperature. Each currency is its own unit, so `$` and `€` never mix.
- **Conversions are bare numbers in the formula:** `× 365` days a year, `× 12` months, `÷ 100` for percent, `÷ 60` minutes to hours, `× 1000` for kilo.
- **Hidden rates need a constant.** A battery that cycles once a day is `battery * cycles * 365`, with `cycles` in `"/day"`, not `battery * 365`.
- **Daily values beside counted days:** when you multiply by `"workdays/week"`, write the daily values per workday too (`"h/workday"`), so the units meet.
- **Counted days are things, not lengths of time.** "5 days a week" of commuting is `"workdays/week"`, and two trips a day is `"trips/day"`. Written as `"days/week"`, it reads as a length of time over a length of time, a plain number, and the "per week" disappears.
- **Write numbers and units with a space:** `"L/100 km"`, not `"L/100km"`.
- **A store's change is its unit per clock unit.** Savings in `"$"` on a yearly clock change by `"$/yr"`.

## Checks: test the model against the source

A model can be well-formed and still wrong. In `checks`, write down what the source says the answer looks like. The validator runs the model and fails if it disagrees.

```json
"checks": [
  { "claim": "Most systems pay for themselves in 6 to 12 years", "value": "paidBack", "between": [6, 12], "quote": 4 },
  { "claim": "A bigger system saves more each year", "value": "saving", "rises": "size" },
  { "claim": "More sun means a shorter payback", "value": "paidBack", "falls": "sunHours" },
  { "claim": "Every unit made is used, stored or sent out", "same": ["made", "used + stored + sent"] }
]
```

- **`between`:** a number or range the source gives for a result, at the default values (or `"when": {"size": 6}` for the case the source describes). Cite the sentence with `quote`. If the source gives no number, give a `reason` for a range any sensible answer must fall in ("A night's sleep is between 4 and 10 hours").
- **`rises` / `falls`:** which way a result moves when an input goes up. Write one for each lever the article talks about.
- **`same`:** two formulas that must be equal everywhere. Use it for balances: what goes into a converter equals what comes out plus losses, and the parts of a budget add up to the whole.
- You need **at least one `between` and one `rises` or `falls`.** A milestone counts as "never" when it isn't reached.
- **If a check fails, fix the model, not the check.** A failing check means the formulas or the defaults disagree with the source. Change a check only if you misread the source, or the source disagrees with itself (below).
- **Vague words:** "a few" is about 2 to 9, "most" is more than half, "nearly all" is 90 or more, "rarely" is under 10 in 100. Say which reading you used in the check's `claim`.
- **How wide is "about"?** For "about 320 litres", allow about 15% either side (270 to 370) unless the source gives its own range. For "over 20 years" or "at least half", leave one end open with `null`: `[20, null]`.
- **What gets checked:** an output or derived value at the defaults; a store, or a value that moves with one, at the end of the clock; a milestone as the time it is reached, or "never" when it isn't. The validator checks units first and runs the checks once the units are right.

### When the source disagrees with itself, or sources disagree

Don't invent a number to reconcile figures that disagree. Say in `decide.leftOut` which figure you didn't use and why.

- **The article disagrees with itself** ("$200 a month clears $5,000 in about 2.5 years with about $1,400 of interest" can't all be true at 22%): check the figure the model reproduces from the source's stated inputs, and drop the check for the one that doesn't fit.
- **Two official sources disagree** (a leaflet says "2 to 3 in 100", the latest annual data says 1.7): use the newer, measured figure.

## Honest numbers

Every number in a screenplay says where it came from. Viewers see the asterisks, and the sources panel lists each one.

- **Quoted:** `"source": "article", "quote": 3`. Copy the sentence word for word.
- **Worked out from a quote:** still `"source": "article"` with the quote, plus a `note` saying how. Examples: "every two years from 50 to 74 is 13 tests", "12% less per 10% price rise is a response of 1.2", "the middle of the 7–9 hours quoted".
- **Assumed:** `"source": "assumption"`. Pick ordinary middle values.
- **Tuned:** an assumption you had to pick so the model matches a figure in the source gets `"fits": <check index>`, for example the share of drinks makers reformulate, chosen to give the article's 30% fall. The page says so, and that check no longer counts as a test, because it can't fail. At least one other `between` check must test the model. Prefer leaving an effect out (and naming it in `leftOut`) to tuning many numbers.
- **Answer options:** a choice that sets a **condition** (a fact about the world, such as rainfall or a car's fuel use) needs `quote` or `"source": "assumption"`. A choice that sets a **lever** (the viewer's own choice, such as "store it in a battery") needs neither.
- **"Don't know":** each choices question needs one option that sets its inputs to their defaults. If a real answer is already the typical one, mark it as typical ("About average, or not sure") rather than adding a duplicate.
- **Yes or no:** an input that is either on or off gets `"toggle": true` with min 0 and max 1. The page shows a checkbox, and the viewer reads "Yes" or "No". Ask it with choices, not a typed number.

## Modelling tools

- **Values that change over time:** a derived value may read a store, such as "how full the tank is" or "this month's payment" from the balance. It is worked out again at every step of the clock, so write a formula once and use it in both the store's change and the flow's rate. Outputs can't read stores, because the page shows them as fixed numbers.
- **Limits on a store:** `"floor": 0` stops it going below zero, and `"ceiling"` (a number or a formula of fixed values, such as the tank size) stops it going above. Water beyond the ceiling is lost: draw that as an overflow flow whose rate reads the store.
- **Switches:** `step(x)` is 1 while x is above zero and 0 otherwise. A tank's outflow stops when it is empty: `use * step(tank)`, and the tap takes over: `use * (1 - step(tank))`. Water spills over a full tank: `rain * (1 - step(tankSize - tank))`.
- **Powers:** `pow(x, n)`, for chances that repeat. The chance of at least one positive result in n tests is `100 - 100 * pow(1 - p / 100, n)`. The base must be a plain number or share, unless the power is a fixed number such as `pow(side, 2)`.
- **Bare numbers:** only conversions (0, 1, 2, 5, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000) may sit in a formula. Every other number is a named constant with a source.

The validator also tries every extreme of the inputs. It fails when a value stops being a number (a division by zero) or a flow runs backwards. Guard divisions with `max(x, 1)` and flows with `max(0, …)`.

## The shapes

Each shape below lists the signs in an article, the world to build, the model at its core, the checks to write and the shots. The examples come from different fields on purpose: copy the structure, not the topic.

### `build-up`: something piles up or runs down

**Signs:** "over time", "adds up", "pays for itself", "until it runs out", "a year from now".
**World:** sources and end points joined by flows into a **store** node, which takes the last column. Give the store a `target` (the cost to recover, the tank's size) and a milestone.
**Model:** `store.change = inflows − outflows` per clock unit.
**Checks:** the milestone or the end level `between` what the source says; the main lever `rises`/`falls` it.
**Shots:** follow the main flow in, a `turn` on the flow people forget, then a `timelapse` on the store.
**Examples:**
- Solar savings filling a jar until they cover the cost.
- A rainwater tank: roof → tank (rain), tank → garden (watering), with "days until empty in a dry spell" as the milestone.
- Sleep debt: needed sleep minus actual sleep, piling up in a tank over a week.

### `feedback`: the result feeds its own cause

**Signs:** "compounds", "snowballs", "spirals", "the more…, the more…", "interest on interest".
**World:** like `build-up`, but a flow's rate reads the store itself. Draw that flow so the loop is visible: interest flows from the bank into the debt.
**Model:** `store.change` reads the store, for example `balance * rate / 100 - payment`, with `"floor": 0`. Write the payment once as a derived value that reads the balance (`max(fixed, balance * minShare / 100)`) and use it in both the store's change and the payment flow.
**Draw repayment** as a flow from the person paying (the hero) to the lender. The debt's level shows it shrinking.
**Checks:** the end level or milestone `between` the source's figure; the payment `falls` the time to clear.
**Shots:** `follow` the loop's flow, a `turn` on how fast it grows ("the minimum payment barely covers the interest"), and a `timelapse`.
**Examples:**
- Credit card debt with minimum payments.
- An epidemic where cases make new cases (store: people infected).
- Compound savings in a pension.

### `budget`: a fixed amount is shared

**Signs:** "out of every dollar", "24 hours in a day", "trade-off", "if you spend more on X, there's less for Y".
**World:** one node holds the total, with **two or more flows out of it in the same unit**, one per use. Uses that compete sit side by side.
**Model:** the parts are derived values. Make the last part "whatever is left": `free = max(0, total - work - sleep - travel)`. The `same` check (parts add up to the whole) is tested at every extreme of the inputs. If the parts could ever add up to more than the whole, cap them in order (sleep first, then work: `work = min(workHours, total - sleep)`), so the leftover never needs clipping and the check holds everywhere.
**Checks:** a `same` check that the parts add up to the total; the source's typical split as `between`; growing one use `falls` another.
**Shots:** `establish` the whole, `follow` each part, and a `turn` on the part that gets squeezed.
**Examples:**
- A day's 24 hours: sleep, work, travel, screens, free time.
- A household's take-home pay: rent, food, transport, savings.
- A farm's hectares: crops, grazing, trees.

### `conversion`: one thing becomes another, with losses

**Signs:** "turns into", "efficiency", "for every unit of… you get…", "is lost as".
**World:** a chain: source → converter → use, with the losses as their own flow to an end point (heat lost to the air, applicants who drop out). The converter has flows in **and** out.
**Model:** `out = in × efficiency`, and `lost = in − out`.
**By-products in another unit:** when what comes out is a different thing (litres of fuel in, kilometres and kilograms of CO2 out), there is no single-unit balance. Show the by-product as its own flow (carrier `carbon` for emissions) and check each rate against the source with `between`. Keep each flow in its own natural unit; don't convert units with numbers the source doesn't give.
**Checks:** a `same` balance where the units allow it (`in = out + lost`); efficiency `rises` the useful output; a `between` on each figure the source quotes.
**Shots:** `follow` the input, `focus` the converter, and a `turn` on the loss people don't see.
**Examples:**
- A heat pump turning one unit of power into three of heat.
- Food calories into the energy a body uses, and the rest stored as fat.
- A hiring funnel: applicants → interviews → offers → hires.

### `cause`: one thing pushes on another

**Signs:** "linked to", "raises the risk of", "for every extra hour…", "cuts by", "leads to". Nothing travels between them: it's an effect.
**World:** causes and effects as nodes (`person`, `body`, `screen`, `institution`), joined by flows with carrier **`influence`** from cause to effect. An influence's rate is the **size of the effect** (minutes of sleep lost, dollars added to prices) and is never negative; the label says which way it pushes ("Cuts sleep").
**Model:** effect = baseline − (or +) cause × effect per unit, with the effect-per-unit a quoted constant. The result node `plays` it.
- **Two effects that may overlap** (20 minutes lost per hour of screens, and 15 minutes slower to fall asleep with a phone in bed): add them only if the source treats them as separate, and say in `leftOut` that they may overlap.
- **An effect with no size per unit** in the source ("many makers change their recipes"): make its size a lever or a labelled assumption, and say in `leftOut` that the source gives no figure linking it to the cause. Don't tune it to hit a check without `fits`.
- **No personal choice** (a policy article): the levers are the policy's settings and other people's choices (the tax rate, the share of makers who reformulate). Frame the question as "What would change if…?".
**Checks:** the source's effect size as `between` (with `when` at the dose the study used); the cause `falls`/`rises` the result.
**Shots:** `establish` the person, `cause` with `drive` on the cause so it sweeps, and a `turn` on the effect people underrate.
**Examples:**
- Screen time before bed cutting sleep.
- A sugar tax raising drink prices and lowering how much people buy.
- Class size affecting time with the teacher.

### `chances`: the answer is a risk

**Signs:** "in 100", "percent chance", "risk", "false positive", "probability", "most people never…".
**World: the journey, then the odds.** A risk is something people go through, so show what happens before showing how often. Lay out the real steps a person takes, researched and quoted: for a screening test, the kit at home, the sample posted to the lab, the result, and the follow-up. People flow through them (carrier `people`) into **one `crowd`** of 100 at the end. Its `groups` light each outcome in its own colour ("cancer found early", "a false alarm", "all clear"). People read "4 in 100" far better than "4%".
- **One crowd, not one per outcome.** Several crowds of 100 people make the viewer compare blocks. One crowd split by colour shows the whole picture at once.
- **Show the outcome over the time the reader cares about.** One round of a test may change only a fraction of a person in 100, which rounds to nobody. Show the result over all the rounds the reader would take (with `pow` for repeated chances), and name the assumptions this needs in `leftOut`.
- **Only the steps that change the outcome.** Each step should be where people split or wait. A step where nothing happens to the numbers is a caption, not a character.
**Model:** shares in `"%"`. Chain them with `/ 100` (`risk * found / 100`), cap them with `min(100, …)`, and keep each one between 0 and 100. Use `pow` for repeated chances. A chances story usually has no clock, so its flows carry shares (`"%"`) with no "per time".
**Checks:** the source's rates as `between`; more testing `rises` both the benefit and the harm (show both).
**Shots:** `establish` the journey, `follow` people through each step, then `focus` the crowd, with a `turn` on the outcome people don't expect (false alarms outnumber cases found).
**Examples:**
- A screening test: cases caught early vs false alarms.
- A vaccine: infections avoided vs side effects, out of 100 vaccinated.
- Insurance: how many of 100 households ever claim.

### `process`: steps, no numbers

**Signs:** "how does… work", "the steps are", "first…, then…", and no figures a reader could change.
**World:** each stage is a node, joined in order by flows. Any carrier fits what moves: `goods` for papers and things, `people` for people, `data` for information or signals, `substance` for a drug or a germ, `influence` for "this decides that". Flows have **no rate and no unit**: everything moves at the same steady pace. A step that loops back (memory cells meeting the germ again) is fine; the layout keeps the main order left to right.
**Leave out** `model`, `checks`, `ask`, `simulate` and `decide.compare`. Never invent numbers to make a model. The film runs Explain, then Decide.
**Shots:** `establish`, a `follow` for each step in order, an optional `turn` on the step people misunderstand, and `handoff`.
**Decide:** trade-offs, what the picture leaves out, and questions to ask, as usual.
**Examples:**
- How a bill becomes law.
- How a vaccine trains the immune system.
- What happens after you make an insurance claim.

## When the article fits nothing well

- **No personal decision:** frame it as "What happens if…?" or "What would change if…?" and pick the shape of that change.
- **Numbers, but none a reader controls:** the levers can be policy choices ("What if the tax doubled?"), still 2–4 of them.
- **Several stories at once:** pick the one the article spends most words on, and put the others in `decide.leftOut`.
- **Too vague to model honestly:** use `process`. A clear picture of the steps beats a simulation built on guesses.
