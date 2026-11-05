# Screenplay format (version 2)

One JSON object. `scripts/validate.mjs` checks every rule below and explains any failure in plain English. `examples/solar/screenplay.json` is a complete example.

```jsonc
{
  "version": 2,
  "question": "Should I put solar on my roof?",          // the decision, reader's voice
  "source": {
    "title": "Homeowner's Guide to Solar",
    "publisher": "U.S. Department of Energy, U.S. EIA",
    "url": "https://…",
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
    "derived":   [ { "id": "yearlyKwh", "label": "Power made a year", "unit": "kWh", "formula": "size * sunHours * 365 * efficiency" } ],
    "outputs":   [ { "id": "saving", "label": "Saved each year", "unit": "$", "formula": "billSaving + exportCredit" } ],
    "stores":    [ { "id": "savings", "label": "Savings so far", "unit": "$", "start": 0, "change": "saving" } ],
    "milestones":[ { "id": "paidBack", "label": "Paid back in", "store": "savings", "reaches": "cost" } ]
  },
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

**Ids**
- Letters, digits and `_`, starting with a letter. Model ids are unique across inputs, constants, derived values, outputs, stores and milestones.
- `min`, `max` and `round` are reserved.
- Node and flow ids are unique within the world.

**Inputs**
- 2–4 with `kind: "lever"` and 1–5 with `kind: "condition"`.
- `min < max`, and `min ≤ default ≤ max`. `step` is optional.

**Sources**
- `"source": "article"` needs `"quote"`, the index of an entry in `source.quotes`. Otherwise use `"source": "assumption"`.
- Constants follow the same rule.
- A quote is either a sentence (from the main article) or `{ "text", "url", "publisher", "accessed" }` (from research). A researched quote needs a `url` you opened and `accessed`, the date you read it (`YYYY-MM-DD`).

**Formulas**
- Allowed: numbers, `+ - * /`, parentheses, `min(…)`, `max(…)`, `round(x, digits)`, and ids.
- No circular references between derived values.
- Only plain conversion numbers may appear directly: 0, 1, 2, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000. Any other number must be a named constant.

**Outputs:** 1–2. Derived values and outputs are fixed in time, so they can't read stores.

**Stores** (0–3): `start` (a number or formula of fixed values) and `change` (amount per time unit; may read stores). Optional `floor` (for example 0).

**Milestones** (0–2): `store` plus `reaches` (a formula of fixed values). The result is the first time the store crosses that level, in `world.time` units.

**World**
- `time` `{ "unit": "day" | "week" | "month" | "year", "span": 1–100 }`. Required when there are stores.
- `nodes`: 2–10, each with `label` and one of:
  - `prop` from the catalog;
  - a `recipe` of 1–12 shapes (`box`, `sphere`, `cylinder`, `cone`, `torus`, each with `size: [x, y, z]`, optional `color`, `at`, `rotate`);
  - `url` + `credit` for a CC0 glTF model.
- Optional node fields:
  - `plays`: a model id the prop shows. If it's an input, the viewer can drag the prop to change it.
  - `on`: another node to sit on.
  - `sky: true`: floats above the set.
  - `store`: a store id. Use with `target`, a formula that draws a line on the jar.
  - `appears`: an input; the node is shown only above that input's minimum.
- `flows`: 1–12, each with `from`, `to` (different nodes), a `carrier` (`energy`, `money`, `water`, `heat`, `light`, `goods`, `people`, `data`), a `rate` formula (may read stores), a `label`, and optionally a `unit` (for example `kWh/yr`, `$/yr`).

**Ask** (0–5): each has a `question`, an optional `help`, and either:
- `input`: the viewer types a number; or
- `choices`: 2–5 options, each with a `label`, `set` (input → value, inside its range) and an optional `quote` (an index or a list of indexes). One option must set exactly the defaults, so a viewer who doesn't know has a typical answer.

**Explain**
- 3–12 shots.
- `shot` is one of `establish`, `introduce`, `focus`, `follow`, `cause`, `compare`, `turn`, `timelapse`, `handoff`.
- `focus` is a node or flow id. It isn't needed for `establish` and `handoff`.
- `follow` and `cause` need a flow. `timelapse` needs a node that shows a store.
- Exactly one `turn`, at least one `establish`, and at least one `follow` or `cause`.
- `caption` is 12 words or fewer.
- `drive` (optional) is the input to sweep during the shot.

**Simulate:** `controls` lists 1–6 input ids to show as sliders.

**Decide:**
- `tradeoffs`, `leftOut` and `questionsToAsk` each hold 1–6 sentences.
- Optional `compare`: 2–3 options, each with a `label` and `set`. They're shown side by side with the viewer's own numbers.

**Words:** the checker rejects every word under "Words we don't use" in `writing-rules.md`.

## What the renderer does with it

- **Layout.** Nodes stand on a diorama in the order the flows run, left to right. Stores come forward. Flows run as cables (energy), paths (money, goods, people) or pipes (water), with particles whose number shows the rate.
- **Each shot.** The camera travels to that shot type's setup, then makes its move: a slow push, a tracking ride along a flow, or a time-lapse on a store.
- **Driven input.** The input sweeps default → min → max → default. The model, the flows and the stores react on every frame.
- **After Explain.** The page asks the `ask` questions ("Make it yours"), then hands over the sliders and the clock (Simulate). "I'm ready to decide" opens Decide with the comparison.
- **The recorded MP4** shows the same three acts. Simulate is scripted: the questions appear, then the controls move and the clock runs.
