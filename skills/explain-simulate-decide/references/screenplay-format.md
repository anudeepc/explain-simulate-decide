# Screenplay format (version 2)

One JSON object. `scripts/validate.mjs` checks every rule below and explains any failure in plain English. `examples/solar/screenplay.json` is a complete example.

```jsonc
{
  "version": 2,
  "shape": "build-up",                                  // see story-shapes.md
  "tone": "energy",                                     // the accent colour; see storytelling.md
  "story": { "hero": "home", "logline": "Your roof catches sunlight all day; the power you use yourself saves far more than the power you sell, so how much does solar pay you back?" },
  "question": "Should I put solar on my roof?",          // the decision, reader's voice
  "source": {
    "title": "Homeowner's Guide to Solar",
    "publisher": "U.S. Department of Energy, U.S. EIA",
    "url": "https://…",                                  // leave out for pasted text with no web address
    "quotes": [
      "exact sentence from the article",
      { "text": "exact sentence from another source", "url": "https://…", "publisher": "U.S. EIA", "accessed": "2026-11-05" }
    ]
  },
  "model": {
    "inputs": [                                         // sliders in Simulate
      { "id": "size", "label": "System size", "unit": "kW", "kind": "lever",
        "min": 2, "max": 12, "step": 0.5, "default": 7, "source": "assumption" },
      { "id": "price", "label": "Price you pay for power", "unit": "$/kWh", "kind": "condition",
        "min": 0.1, "max": 0.45, "step": 0.01, "default": 0.165, "source": "article", "quote": 1 }
    ],
    "constants": [ { "id": "efficiency", "label": "…", "unit": "", "value": 0.8, "source": "assumption" } ],
    "derived":   [ { "id": "yearlyKwh", "label": "Power made a year", "unit": "kWh/yr", "formula": "size * sunHours * 365 * efficiency" } ],
    "outputs":   [ { "id": "saving", "label": "Saved each year", "unit": "$/yr", "formula": "billSaving + exportCredit" } ],
    "stores":    [ { "id": "savings", "label": "Savings so far", "unit": "$", "start": 0, "change": "saving" } ],
    "milestones":[ { "id": "paidBack", "label": "Paid back in", "store": "savings", "reaches": "cost" } ]
  },
  "checks": [                                            // what the source says the answer looks like
    { "claim": "Systems average about $2.60 per watt", "value": "cost", "between": [16000, 20000], "quote": 9 },
    { "claim": "A bigger system saves more each year", "value": "saving", "rises": "size" },
    { "claim": "Every unit made is used, stored or sent out", "same": ["yearlyKwh", "direct + shifted / roundTrip + exportedKwh"] }
  ],
  "world": {
    "time": { "unit": "year", "span": 25 },
    "nodes": [
      { "id": "sun", "prop": "sun", "label": "Sun", "plays": "sunHours", "sky": true },
      { "id": "home", "prop": "house", "label": "Your home", "plays": "selfUse" },
      { "id": "panels", "prop": "roof-panel", "label": "Panels", "plays": "size", "on": "home" },
      { "id": "bat", "prop": "battery", "label": "Home battery", "plays": "battery", "appears": "battery" },
      { "id": "jar", "prop": "jar", "label": "Savings", "store": "savings", "target": "cost" }
    ],
    "flows": [
      { "id": "direct", "from": "panels", "to": "home", "carrier": "energy", "rate": "direct", "label": "Used as it's made", "unit": "kWh/yr" },
      { "id": "avoided", "from": "home", "to": "jar", "carrier": "money", "rate": "billSaving", "label": "Bill you avoid", "unit": "$/yr" }
    ]
  },
  "ask": [
    { "question": "What is your average monthly power bill?", "help": "Add up your last few bills and divide.", "input": "monthlyBill" },
    { "question": "Where do you live?", "choices": [
        { "label": "Arizona", "set": { "sunHours": 6.5, "price": 0.15 }, "quote": [7, 8] },
        { "label": "New York", "set": { "sunHours": 3.6, "price": 0.29 }, "quote": [7, 8] },
        { "label": "Somewhere else", "set": { "sunHours": 4.5, "price": 0.165 } } ] }
  ],
  "explain": [
    { "shot": "establish", "caption": "Should solar go on your roof? Here is how it works." },
    { "shot": "follow", "focus": "direct", "caption": "Power you use as it's made is power you don't buy." },
    { "shot": "turn", "focus": "credit", "caption": "But the grid usually pays far less than you pay for power." },
    { "shot": "timelapse", "focus": "jar", "caption": "Savings build up each year until they cover the cost." },
    { "shot": "handoff", "caption": "Now make it yours. Answer a few questions." }
  ],
  "simulate": { "controls": ["size", "battery", "selfUse", "monthlyBill"], "prompt": "Try your own roof, bill and prices." },
  "decide": {
    "compare": [ { "label": "Solar, no battery", "set": { "battery": 0 } }, { "label": "Solar + 10 kWh battery", "set": { "battery": 10 } } ],
    "tradeoffs": ["…"], "leftOut": ["…"], "questionsToAsk": ["…"]
  }
}
```

## Rules

**Shape**: one of `build-up`, `feedback`, `budget`, `conversion`, `cause`, `chances`, `process`. `references/story-shapes.md` explains how to choose. The validator checks that the world fits:
- `build-up`: a store and a `timelapse` shot.
- `feedback`: a store whose `change` reads a store.
- `budget`: one node with two or more flows out in the same unit.
- `conversion`: a node with flows both in and out.
- `cause`: at least one `influence` flow.
- `chances`: a `crowd` node that plays a value in `"%"`.
- `process`: see "Process stories" below.

**Story** (required): `hero` is a node on the ground (the person or home the viewer stands in for); `logline` is one sentence, 35 words or fewer. The first shot after `establish` and the last shot before `handoff` must be about the hero: focus on it, on a part mounted on it, or on a flow to or from it.

**Tone** (optional, default `neutral`): `health`, `money`, `energy`, `water`, `climate`, `civic`, `food`, `home` or `neutral`. Films are shot on a white set; the tone is the accent colour.

**Ids**
- Letters, digits and `_`, starting with a letter. Model ids are unique across inputs, constants, derived values, outputs, stores and milestones.
- `min`, `max` and `round` are reserved.
- Node and flow ids are unique within the world.

**Units**
- Every input, constant, derived value, output, store and flow has a `unit`: text such as `"$/yr"`, `"kWh"`, `"h/night"`, `"%"`, `"people"`, or `""` for a plain number or ratio.
- The validator works out the unit of every formula and rejects one that doesn't match: a missing `× 365`, a percent not divided by 100, kWh added to $. Rates are per time (`"$/yr"`); a store's `change` is its unit per `world.time.unit`.
- Known units convert (time, energy, power, mass, length, area, volume, temperature, each currency); any other word is a countable thing.

**Where numbers come from** (inputs and constants; see "Honest numbers" in story-shapes.md)
- `"source": "article"` with `"quote"` (an index, or a list when the number comes from several sentences), plus an optional `"note"` when the number is worked out from the quotes.
- `"source": "assumption"`, plus `"fits": <check index>` when it was tuned so the model matches that check. A tuned check doesn't count as a test.

**Inputs**
- 1–4 with `kind: "lever"` and 1–5 with `kind: "condition"`.
- `"toggle": true` (with min 0 and max 1) for a yes-or-no input: the page shows a checkbox. Ask it with choices.
- `min < max`, and `min ≤ default ≤ max`. `step` is optional.

**Sources**
- `"source": "article"` needs `"quote"`, the index of an entry in `source.quotes`. Otherwise use `"source": "assumption"`.
- Constants follow the same rule.
- A quote is either a sentence (from the main article) or `{ "text", "url", "publisher", "accessed" }` (from research). A researched quote needs a `url` you opened and `accessed`, the date you read it (`YYYY-MM-DD`).

**Formulas**
- Allowed: numbers, `+ - * /`, parentheses, `min(…)`, `max(…)`, `round(x, digits)`, `pow(x, n)`, and ids.
- No circular references between derived values.
- Only plain conversion numbers may appear directly: 0, 1, 2, 5, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000. Any other number must be a named constant.

**Checks** (required, except in a process story): each has a `claim` (plain words) and exactly one of:
- `"value": <id>, "between": [low, high]` with `"quote": <index>` or a `"reason"`. Use `null` for an open end (`[20, null]` is "at least 20"). The value is taken at the defaults (or at `"when": {inputId: value}`): outputs and fixed derived values as they are, stores and values that move with them at the end of the clock, and milestones as the time reached (never reached counts as never).
- `"value": <id>, "rises": <input>` or `"falls": <input>`. Moving that input from its min to its max must move the value steadily that way.
- `"same": [formulaA, formulaB]`. Both must be equal at the defaults and at every extreme of the inputs, for balances such as parts adding up to a whole. Comparing a value with its own formula is rejected, because it can never fail.

At least one `between` and one `rises` or `falls`. The validator also runs every extreme of the inputs: each value must stay a number, and no flow may go negative.

**Outputs:** 1–2. Outputs are shown as fixed numbers, so they can't read stores. Derived values may read stores: they are worked out again at every step of the clock.

**Stores** (0–3): `start` (a number or formula of fixed values) and `change` (amount per time unit; may read stores and the derived values that read them). Optional `floor` (for example 0) and `ceiling` (a number or formula of fixed values, such as a tank's size). Every store needs a node that shows it.

**Milestones** (0–2): `store` plus `reaches` (a formula of fixed values). The result is the first time the store crosses that level, in `world.time` units.

**World**
- `time` `{ "unit": "day" | "week" | "month" | "year", "span": 1–100 }`. Required when there are stores.
- `nodes`: 2–10, each with `label` and one of:
  - `prop` from the catalog;
  - `kind`, when no prop fits: `person`, `crowd`, `body`, `home`, `building`, `institution`, `business`, `factory`, `farm`, `nature`, `land`, `water`, `weather`, `sun`, `vehicle`, `machine`, `device`, `screen`, `document`, `money`, `store`, `food`, `medicine`, `time`, `cell`, `germ` or `other`. The renderer picks the look;
  - nothing, for a store node: the look comes from the store's unit (money → jar of coins, energy → battery, anything else → tank). A `jar` is only for money;
  - a `recipe` of 1–12 parts, each `{ "shape": "box" | "sphere" | "cylinder" | "cone" | "torus", "size": [x, y, z] }` with optional `"color": "#rrggbb"`, `"at": [x, y, z]` and `"rotate": [x, y, z]` in degrees. Sizes are in set units: a house is about 2.5 tall, and the whole recipe is scaled to fit about 2.6 tall. Parts stack upward in order unless given `at`, which is measured from the node's base (y is up). For example, a pill bottle: `[{"shape": "cylinder", "size": [0.9, 1.2, 0.9], "color": "#eeeaf4"}, {"shape": "cylinder", "size": [0.96, 0.32, 0.96], "color": "#9a8fc4"}]`;
  - `url` + `credit` for a CC0 glTF model.
- Optional node fields:
  - `plays`: a model id the prop shows. If it's an input, the viewer can drag the prop to change it.
  - `on`: another node to sit on.
  - `sky: true`: floats above the set.
  - `store`: a store id. Use with `target`, a formula that draws a line on the jar.
  - `appears`: an input; the node is shown only above that input's minimum.
  - `groups` (crowds only, instead of `plays`): 1–4 outcomes, each `{"value": <id in "%">, "label": "caught early"}`. One crowd of 100 lights each outcome in its own colour, in order, and its label lists them.
- **No dead parts:** every input and constant must be read by a formula (or shown by a node), every derived value must be used, and every node must take part in a flow (a store's node may stand alone).
- `flows`: 1–12, each with `from`, `to` (different nodes), a `carrier`, a `rate` formula (may read stores; never negative), a `label`, and a `unit` (for example `kWh/yr`, `$/yr`, `h/night`).
  - Carriers: `energy`, `money`, `water`, `heat`, `light`, `goods`, `people`, `data`, `time` (hours and minutes), `carbon` (emissions, drawn as drifting puffs), `substance` (medicine, food, pollutants) and `influence` (a cause pushing on an effect, drawn as arrowheads; its rate is the size of the effect).

**Ask** (0–5): each has a `question`, an optional `help`, and either:
- `input`: the viewer types a number; or
- `choices`: 2–5 options, each with a `label`, `set` (input → value, inside its range) and an optional `quote` (an index or a list of indexes). An option that sets a condition to a value other than its default needs `quote` or `"source": "assumption"` (it shows an asterisk). One option must set the question's inputs to their defaults, so a viewer who doesn't know has a typical answer.

**Explain**
- 3–12 shots.
- `shot` is one of `establish`, `introduce`, `focus`, `follow`, `cause`, `compare`, `turn`, `timelapse`, `handoff`.
- `focus` is a node or flow id. It isn't needed for `establish` and `handoff`.
- `follow` and `cause` need a flow. `timelapse` needs a node that shows a store.
- Exactly one `turn`, at least one `establish`, and at least one `follow` or `cause`.
- `caption` is 12 words or fewer.
- `drive` (optional) is the input to sweep during the shot.

**Scenes** (`"shot": "scene"`): the hero acting in a small set, cut into the film like a scene in a movie. Fields:
- `set`: `doorway`, `kitchen`, `postbox`, `hospital`, `livingRoom` or `lab`.
- `camera`: `close`, `medium` (default) or `wide`.
- `at`: the mark where the hero starts. `seated: true` starts them in a chair.
- `with: "nurse"`: a second person in the scene.
- `beats` (1–4, in order): `{"do": action, "to": mark, "object": letter|envelope|kit, "from": spot, "feel": expression}`. Actions are `idle`, `walk`, `pickUp`, `read`, `hold`, `give`, `place`, `sit`, `talk`, `listen`, `wait` and `react`. Expressions are `neutral`, `curious`, `worried`, `relieved` and `smile`.

A scene counts as a shot about the hero. The film cuts into and out of a scene and fades up from white. `examples/bowel-screening` shows a full director's cut.

**Simulate:** `controls` lists 1–6 input ids to show as sliders.

**Decide:**
- `tradeoffs`, `leftOut` and `questionsToAsk` each hold 1–6 sentences.
- Optional `compare`: 2–3 options, each with a `label` and `set`. They're shown side by side with the viewer's own numbers.

**Words:** the checker rejects every word under "Words we don't use" in `writing-rules.md`.

## Process stories

A `process` story explains steps or parts with no numbers a reader could change. It has `version`, `shape`, `question`, `source`, `world`, `explain` and `decide`, and **no** `model`, `checks`, `ask`, `simulate` or `world.time`.
- Nodes need no `plays`, `store`, `appears` or `target`.
- Flows have no `rate` or `unit`. Every step moves at the same steady pace.
- Shots: `establish`, `introduce`, `focus`, `follow`, `compare`, `turn` (at most one) and `handoff`. Use at least one `follow`.
- `decide` has `tradeoffs`, `leftOut` and `questionsToAsk`, but no `compare`.
- The film runs Explain, then Decide.

## What the renderer does with it

- **Layout.** Nodes stand on a diorama in the order the flows run, left to right. Stores come forward. Flows run as cables (energy), paths (money, goods, people) or pipes (water), with particles whose number shows the rate.
- **Each shot.** The camera travels to that shot type's setup, then makes its move: a slow push, a tracking ride along a flow, or a time-lapse on a store.
- **Driven input.** The input sweeps default → min → max → default. The model, the flows and the stores react on every frame.
- **After Explain.** The page asks the `ask` questions ("Make it yours"), then hands over the sliders and the clock (Simulate). "I'm ready to decide" opens Decide with the comparison.
- **The recorded MP4** shows the same three acts. Simulate is scripted: the questions appear, then the controls move and the clock runs.
