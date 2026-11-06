# Story shapes: how to find the right world for an article

Articles explain very different things. Examples:
- Money that builds up.
- A habit that costs sleep.
- A test that sometimes gives the wrong result.
- A law that moves through parliament.

One kind of world cannot show all of these. Before you map anything, decide which **shape** the story has. The shape tells you these things:
- What the characters are.
- What moves between the characters.
- What the viewer can change.
- How to check the model.

Write the shape as `"shape"` at the top of the screenplay. The validator checks that the world fits the shape.

## How to find the shape

**The shape is the shape of the answer that the viewer wants.** First, write the question ("Will I clear my card?", "How much sleep do screens cost me?"). Then find the row whose result matches the question:

| Question about the article | Shape |
|---|---|
| Are there no numbers that a viewer can change, only steps or parts? | `process` |
| Is the answer a chance or a risk, such as "4 in 100 people"? | `chances` |
| Does a result feed back into its own cause, so that the change becomes faster or slower? Examples: interest on a balance, an epidemic, ice that melts and makes the world warmer. | `feedback` |
| Does something build up or decrease over time? Examples: savings, debt, water in a tank, sleep debt, weight. | `build-up` |
| Do uses that compete share a fixed amount? Examples: the hours of a day, a pay packet, a field. | `budget` |
| Does one thing change into another thing, with losses on the way? Examples: fuel into power, food into energy, applicants into hires. | `conversion` |
| Does one thing increase or decrease another thing by an amount that the article gives? Nothing moves between them. Examples: how screens change sleep, how a tax changes prices. | `cause` |

Often, more than one row fits, because one world can hold more than one of these patterns. Read the rows as a list of patterns to recognize. Do not stop at the first row that fits. Select the shape from the question:
- "Will I pay off my card?" asks about a balance that feeds itself: `feedback`.
- "How much sleep do screens cost me tonight?" asks about an effect: `cause`.
- "How much sleep debt will I have by Friday?" asks about something that builds up: `build-up`.
- "Is the e-bike or the car better for the trip?" asks how energy changes into distance: `conversion`.

**Shapes borrow from each other.** The shape names the main result. The validator checks only that part. A `build-up` world can also have `influence` links, for example screens that push on sleep while the debt builds up. A `conversion` world can also have a store (money saved). Use all that the story needs around the main result.

A shape is not a topic. Health, money, climate and politics can each take any shape.

## Characters for each topic

Each character has a **role** in the story. Each character also has a **kind**, which sets how it looks.

**Roles.** The roles are for your own thinking. They decide where flows start and end.
- **Source:** where something comes from (the sun, your pay, the advice of a doctor).
- **Converter:** what changes one thing into another thing (panels, a body, a factory).
- **Store:** what fills or empties over time (savings, a reservoir, sleep debt).
- **End point:** where something goes at the end (your home, the air, a hospital).
- **Outside party:** something large that trades with the viewer (the grid, a bank, the government).
- **Cause:** something that pushes on something else with no movement between them (a habit, a price, a rule).

**Kinds.** If a studio prop fits exactly, use `prop`. If not, give `kind`, and the renderer selects a look:

| `kind` | Looks like | For |
|---|---|---|
| `person` | a figure with a bar | one person, "you", a worker |
| `crowd` | 100 small people | a population, "people like you", chances |
| `body` | a standing figure with a heart that glows | health, symptoms, fitness, a dose |
| `home` | a house | a household, home life |
| `building` | an office block | a school, hospital, council, office, company |
| `institution` | a building with columns | a bank, court, parliament, tax office, regulator |
| `business` | a pale office block | a shop, employer, insurer |
| `factory` | a factory | industry, production |
| `farm`, `land` | a grassy hill with trees and a field | farms, land use, a region |
| `nature` | a tree | forests, ecosystems |
| `water` | a drop | rivers, rain, water use |
| `weather`, `sun` | a cloud, the sun | weather, climate, daylight (usually `"sky": true`) |
| `vehicle` | a car | travel, transport |
| `machine`, `device`, `screen` | a gauge, a plug, a phone | equipment, appliances, apps |
| `document` | a stack of pages | a law, a contract, a report |
| `money` | a stack of coins | cash, a fund |
| `store` | a glass tank | anything that builds up and is not money |
| `food`, `medicine` | a shopping bag, a pill bottle | diet, drugs |
| `time` | a clock | hours, deadlines |
| `cell`, `germ` | a cell with a nucleus, a spiky germ | biology, infections, the immune system |
| `other` | a block with a label | anything else |

A store node does not need `prop` or `kind`. If it has neither, the renderer selects a look from the unit of the store:
- Money gets a jar of coins.
- Energy gets a battery.
- All other units get a tank.

**A jar of coins is only for money.** The validator rejects a jar for sleep or carbon.

## Units: say what each number is

Every input, constant, derived value, output, store and flow has a `unit`. The validator checks that each formula gives a result in that unit. This check finds the most frequent mistakes:
- A missing `× 365`.
- A percent that you did not divide by 100.
- kWh added to dollars.

Follow these rules:
- **Write rates per time:** `"$/yr"`, `"kWh/yr"`, `"h/night"`, `"cigarettes a day"`. A yearly saving is `"$/yr"`, not `"$"`. A system cost that you pay one time is `"$"`.
- **Write what you count** when no standard unit fits: `"people"`, `"patients/yr"`, `"trees"`, `"tests"`. Any word is correct. Plurals are not important. Use the same word each time.
- **Percents are `"%"`.** Divide them by 100 in formulas (`/ 100`). A plain ratio, such as efficiency 0.8, is `""`.
- **The validator converts these known units:**
  - Time: s, min, h, day, night, week, month, yr.
  - Energy: J, kWh, kcal, BTU, therm.
  - Power: W, kW.
  - Mass: g, kg, t, lb.
  - Volume: L, gal.
  - Length, area and temperature.
- **Each currency is a different unit.** You cannot add `$` to `€`.
- **Conversions are bare numbers in the formula:**
  - `× 365` for the days in a year.
  - `× 12` for months.
  - `÷ 100` for a percent.
  - `÷ 60` for minutes to hours.
  - `× 1000` for kilo.
- **A hidden rate needs a constant.** A battery that cycles one time each day is `battery * cycles * 365`, with `cycles` in `"/day"`. It is not `battery * 365`.
- **Daily values beside counted days:** If you multiply by `"workdays/week"`, also write the daily values per workday (`"h/workday"`). Then the units agree.
- **Counted days are things, not lengths of time.** "5 days a week" of travel to work is `"workdays/week"`. Two trips a day is `"trips/day"`. If you write `"days/week"`, the validator reads a length of time divided by a length of time. That ratio is a plain number. The "per week" disappears.
- **Write numbers and units with a space:** `"L/100 km"`, not `"L/100km"`.
- **The change of a store has the unit of the store per clock unit.** Savings in `"$"` on a yearly clock change by `"$/yr"`.

## Checks: test the model against the source

A model can have a correct structure and still give wrong results. In `checks`, write what the source says about the answer. The validator runs the model. If the model does not agree with a check, the validator fails.

```json
"checks": [
  { "claim": "Most systems pay for themselves in 6 to 12 years", "value": "paidBack", "between": [6, 12], "quote": 4 },
  { "claim": "A bigger system saves more each year", "value": "saving", "rises": "size" },
  { "claim": "More sun gives a shorter payback time", "value": "paidBack", "falls": "sunHours" },
  { "claim": "The system uses, stores or sends out each unit that it makes", "same": ["made", "used + stored + sent"] }
]
```

- **`between`:** a number or range that the source gives for a result. The validator checks it at the default values. For the case that the source describes, add `"when": {"size": 6}`. Cite the sentence with `quote`. If the source gives no number, give a range that each sensible answer must be in. Write the reason in `reason` ("A night's sleep is between 4 and 10 hours").
- **`rises` / `falls`:** the direction that a result moves when an input increases. Write one for each lever that the article talks about.
- **`same`:** two formulas that must be equal everywhere. Use it for balances. Examples:
  - What goes into a converter equals what comes out plus the losses.
  - The parts of a budget add up to the whole.
- You need **at least one `between` check**. You also need **at least one `rises` or `falls` check**. A milestone counts as "never" when the model does not get to it.
- **If a check fails, fix the model, not the check.** A failed check means that the formulas or the defaults do not agree with the source. Change a check only for one of these two reasons:
  - You read the source incorrectly.
  - The source does not agree with itself (see below).
- **Vague words:** In the `claim` of the check, say which meaning you used:
  - "a few" is about 2 to 9.
  - "most" is more than half.
  - "nearly all" is 90 or more.
  - "rarely" is less than 10 in 100.
- **How wide is "about"?** For "about 320 litres", let the check accept about 15% on each side (270 to 370). Do this only if the source does not give its own range. For "over 20 years" or "at least half", use `null` to keep one end open: `[20, null]`.
- **What the validator checks:**
  - An output or a derived value: the value at the defaults.
  - A store, or a value that moves with a store: the value at the end of the clock.
  - A milestone: the time when the model gets to it, or "never" if the model does not get to it.
- The validator checks the units first. When the units are correct, it runs the checks.

### When the source does not agree with itself, or sources do not agree

Do not add your own number to make two different figures agree. In `decide.leftOut`, say which figure you did not use and why.

- **The article does not agree with itself.** Example: "$200 a month clears $5,000 in about 2.5 years with about $1,400 of interest". At 22%, all of these cannot be true. Check the figure that the model gets from the inputs that the source gives. Remove the check for the figure that does not fit.
- **Two official sources do not agree.** Example: a leaflet says "2 to 3 in 100", but the latest annual data says 1.7. Use the newer measured figure.

## Honest numbers

Each number in a screenplay says where it comes from. Viewers see the asterisks. The sources panel shows each number.

- **Quoted:** `"source": "article", "quote": 3`. Copy the sentence word for word.
- **Calculated from a quote:** also use `"source": "article"` with the quote. Add a `note` that tells how you got the number. Examples:
  - "every two years from age 50 to 74 is 13 tests"
  - "12% less for each 10% price increase is a response of 1.2"
  - "the middle of the 7–9 hours in the quote"
- **Assumed:** `"source": "assumption"`. Select usual middle values.
- **Tuned:** an assumption that you select to make the model agree with a figure in the source. It gets `"fits": <check index>`. Example: the share of drink makers that change their recipes, selected to give the 30% decrease in the article. The page tells the viewer this. That check then stops being a test, because it cannot fail. At least one other `between` check must test the model. It is better to remove an effect from the model than to tune many numbers. Name the removed effect in `leftOut`.
- **Answer options:** a choice that sets a **condition** needs `quote` or `"source": "assumption"`. A condition is a fact about the world, such as rainfall or the fuel use of a car. A choice that sets a **lever** needs neither. A lever is the viewer's own choice, such as "store it in a battery".
- **"Don't know":** each choices question needs one option that sets its inputs to their defaults. If a real answer is already the typical answer, mark it as typical ("About average, or not sure"). Do not add a second option that is the same.
- **Toggles:** an input with only two values (on, off) gets `"toggle": true`. Set its `min` to 0 and its `max` to 1. The page shows a checkbox. The viewer sees "Yes" or "No". Ask the question with choices, not with a typed number.

## Model tools

- **Values that change over time:** a derived value can read a store. Examples: "how full the tank is", or "this month's payment" from the balance. The model calculates the value again at each step of the clock. Write the formula one time. Use it in both the change of the store and the rate of the flow. Outputs cannot read stores, because the page shows outputs as fixed numbers.
- **Limits on a store:** `"floor": 0` keeps the store at zero or more. `"ceiling"` keeps the store at or below a maximum. The ceiling is a number, or a formula of fixed values such as the tank size. The tank loses the water above the ceiling. Show this as an overflow flow whose rate reads the store.
- **Switches:** `step(x)` is 1 while x is above zero. It is 0 at all other times. Examples:
  - The outflow of a tank stops when the tank is empty: `use * step(tank)`.
  - Then the tap supplies the water: `use * (1 - step(tank))`.
  - Water spills over a full tank: `rain * (1 - step(tankSize - tank))`.
- **Powers:** use `pow(x, n)` for chances that repeat. The chance of at least one positive result in n tests is `100 - 100 * pow(1 - p / 100, n)`. The base must be a plain number or a share. The only exception is a fixed power, such as `pow(side, 2)`.
- **Bare numbers:** only conversions can be bare numbers in a formula. The conversions are `0, 1, 2, 5, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000`. Each other number must be a named constant with a source.

The validator also tries each extreme of the inputs. It fails if a value stops being a number (a division by zero). It also fails if a flow goes backwards. Use `max(x, 1)` to protect divisions. Use `max(0, …)` to protect flows.

## The shapes

Each shape below gives these items:
- The signs in an article.
- The world to build.
- The model at its core.
- The checks to write.
- The shots.

The examples come from different fields on purpose. Copy the structure, not the topic.

### `build-up`: something builds up or decreases

**Signs:** "over time", "adds up", "pays for itself", "until it runs out", "a year from now".
**World:** flows connect sources and end points to a **store** node. The store takes the last column. Give the store a `target` (the cost to recover, the size of the tank) and a milestone.
**Model:** `store.change = inflows − outflows` per clock unit.
**Checks:** the milestone or the end level is `between` the values in the source. Write a `rises` or `falls` check for the main lever.
**Shots:** `follow` the main flow in. Then use a `turn` on the flow that people forget. Then use a `timelapse` on the store.
**Examples:**
- Solar savings that fill a jar until they pay for the system.
- A rainwater tank: roof → tank (rain), tank → garden (water for the garden). The milestone is "days until empty in a dry period".
- Sleep debt: the sleep that you need minus the sleep that you get. It builds up in a tank over a week.

### `feedback`: the result feeds its own cause

**Signs:** "compounds", "snowballs", "spirals", "the more…, the more…", "interest on interest".
**World:** like `build-up`, but the rate of a flow reads the store itself. Show that flow, so that the viewer sees the loop. Example: interest flows from the bank into the debt.
**Model:** `store.change` reads the store, for example `balance * rate / 100 - payment`, with `"floor": 0`. Write the payment one time as a derived value that reads the balance (`max(fixed, balance * minShare / 100)`). Use it in both the change of the store and the payment flow.
**Repayment:** show repayment as a flow from the person who pays (the hero) to the lender. The level of the debt shows that the debt decreases.
**Checks:** the end level or the milestone is `between` the figures in the source. A `falls` check shows that a larger payment decreases the time to clear the debt.
**Shots:** `follow` the flow of the loop. Use a `turn` on how fast the loop grows ("The minimum payment pays little more than the interest"). Then use a `timelapse`.
**Examples:**
- Credit card debt with minimum payments.
- An epidemic where cases make new cases (store: people with the infection).
- Compound savings in a pension.

### `budget`: uses share a fixed amount

**Signs:** "out of every dollar", "24 hours in a day", "trade-off", "if you spend more on X, there's less for Y".
**World:** one node holds the total. **Two or more flows in the same unit** go out of it, one for each use. Uses that compete are side by side.
**Model:** write each part as a derived value. Make the last part "all that remains": `free = max(0, total - work - sleep - travel)`. The validator tests the `same` check (the parts add up to the whole) at each extreme of the inputs. The parts must never add up to more than the whole. If they can, limit them in order: sleep first, then work (`work = min(workHours, total - sleep)`). Then the rest never needs a limit. The check stays true everywhere.
**Checks:** write a `same` check that the parts add up to the total. Write the typical split in the source as `between`. Write a `falls` check: when one use increases, another use decreases.
**Shots:** `establish` the whole. `follow` each part. Use a `turn` on the part that the other parts make smaller.
**Examples:**
- The 24 hours of a day: sleep, work, travel, screens, free time.
- The take-home pay of a household: rent, food, transport, savings.
- The hectares of a farm: crops, grazing, trees.

### `conversion`: one thing becomes another, with losses

**Signs:** "turns into", "efficiency", "for every unit of… you get…", "lost as".
**World:** a chain: source → converter → use. The losses are a separate flow to an end point (heat that goes into the air, applicants who stop). The converter has flows in **and** out.
**Model:** `out = in × efficiency`, and `lost = in − out`.
**By-products in a different unit:** sometimes the output is a different thing, for example litres of fuel in, kilometres and kilograms of CO2 out. Then there is no balance in one unit. Show the by-product as its own flow (carrier `carbon` for emissions). Check each rate against the source with `between`. Keep each flow in its own natural unit. Do not convert units with numbers that the source does not give.
**Checks:** write a `same` balance where the units allow it (`in = out + lost`). Write a `rises` check: more efficiency gives more useful output. Write a `between` check on each figure that the source quotes.
**Shots:** `follow` the input. `focus` the converter. Use a `turn` on the loss that people do not see.
**Examples:**
- A heat pump that changes one unit of power into three units of heat.
- Food calories that change into the energy that a body uses. The body stores the rest as fat.
- A hiring funnel: applicants → interviews → offers → hires.

### `cause`: one thing pushes on another

**Signs:** "linked to", "raises the risk of", "for every extra hour…", "cuts by", "leads to". Nothing moves between the two things. It is an effect.
**World:** causes and effects are nodes (`person`, `body`, `screen`, `institution`). Flows with carrier **`influence`** connect each cause to its effect. The rate of an influence is the **size of the effect**, for example minutes of sleep lost or dollars added to prices. The rate is never negative. The label tells the direction of the push ("Decreases sleep").
**Model:** effect = baseline − (or +) cause × effect per unit. The effect per unit is a quoted constant. The result node `plays` it.
- **Two effects that can overlap.** Example: the source gives 20 minutes lost for each hour of screens. It also gives 15 more minutes to fall asleep with a phone in bed. Add the two effects only if the source treats them as separate. Say in `leftOut` that they can overlap.
- **An effect with no size per unit in the source** ("many makers change their recipes"). Make its size a lever or a labelled assumption. Say in `leftOut` that the source gives no figure that links the effect to the cause. Do not tune it to agree with a check without `fits`.
- **No personal choice** (a policy article). The levers are the settings of the policy and the choices of other people. Examples: the tax rate, the share of makers that change their recipes. Write the question as "What would change if…?".
**Checks:** write the effect size from the source as `between`. Use `when` at the dose that the study used. Write a `falls` or `rises` check from the cause to the result.
**Shots:** `establish` the person. Use `cause` with `drive` on the cause, so that the cause sweeps. Use a `turn` on the effect that people think is small.
**Examples:**
- Screen time before bed that decreases sleep.
- A sugar tax that increases drink prices. Then people buy fewer drinks.
- Class size that changes the time with the teacher.

### `chances`: the answer is a risk

**Signs:** "in 100", "percent chance", "risk", "false positive", "probability", "most people never…".
**World: first the journey, then the chances.** A risk is something that people go through. Thus, show what happens before you show how often it happens. Show the real steps that a person takes. Research and quote these steps. For a screening test, the steps are: the kit at home, the sample in the post to the lab, the result, the follow-up. People flow through the steps (carrier `people`) into **one `crowd`** of 100 at the end. Its `groups` show each outcome in its own colour ("Cancer found early", "A false alarm", "All clear"). People understand "4 in 100" much better than "4%".
- **One crowd, not one crowd for each outcome.** If there are many crowds of 100 people, the viewer compares blocks. One crowd in different colours shows all of the result at one time.
- **Show the outcome over the time that is important to the viewer.** One round of a test can change only a fraction of a person in 100. That fraction rounds to nobody. Show the result over all the rounds that the viewer will take. Use `pow` for repeated chances. In `leftOut`, name the assumptions that this needs.
- **Only the steps that change the outcome.** Each step must be a point where people split or wait. If a step does not change the numbers, make it a caption, not a character.
**Model:** write shares in `"%"`. Chain them with `/ 100` (`risk * found / 100`). Limit them with `min(100, …)`. Keep each share between 0 and 100. Use `pow` for repeated chances. A chances story usually has no clock. Thus, its flows carry shares (`"%"`) with no "per time".
**Checks:** write the rates from the source as `between`. Write `rises` checks that show that more tests increase both the benefit and the harm. Show both.
**Shots:** `establish` the journey. `follow` people through each step. Then `focus` the crowd. Use a `turn` on the outcome that people do not expect (there are more false alarms than cases found).
**Examples:**
- A screening test: cases found early against false alarms.
- A vaccine: infections that it prevents against side effects, out of 100 people who get the vaccine.
- Insurance: how many of 100 households ever make a claim.

### `process`: steps, no numbers

**Signs:** "how does… work", "the steps are", "first…, then…", and no figures that a viewer can change.
**World:** each stage is a node. Flows connect the nodes in order. Select the carrier that fits what moves:
- `goods` for papers and things.
- `people` for people.
- `data` for information or signals.
- `substance` for a drug or a germ.
- `influence` for "this decides that".

Flows have **no rate and no unit**. Everything moves at the same steady speed. A step that loops back is correct (for example, memory cells that meet the germ again). The layout keeps the main order from left to right.
**Do not write** `model`, `checks`, `ask`, `simulate` or `decide.compare`. Do not add numbers that are not in the article to make a model. The film shows Explain, then Decide.
**Shots:** `establish`, then a `follow` for each step in order, an optional `turn` on the step that people do not understand, and `handoff`.
**Decide:** trade-offs, what the picture does not show, and questions to ask, as usual.
**Examples:**
- How a bill becomes law.
- How a vaccine trains the immune system.
- What happens after you make an insurance claim.

## When the article does not fit a shape well

- **No personal decision:** write the question as "What happens if…?" or as "What would change if…?". Then select the shape of that change.
- **Numbers, but none that a viewer controls:** the levers can be policy choices ("What if the tax doubled?"). You still need 2–4 levers.
- **Many stories at one time:** select the story that gets the most words in the article. Put the other stories in `decide.leftOut`.
- **Too vague to model honestly:** use `process`. A clear picture of the steps is better than a simulation that uses guesses.
