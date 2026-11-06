# Screenplay format (version 2)

A screenplay is one JSON object. `scripts/validate.mjs` checks every rule below. It explains each failure in plain English. `examples/solar/screenplay.json` is a complete example.

```jsonc
{
  "version": 2,
  "shape": "build-up",                                  // see story-shapes.md
  "tone": "energy",                                     // the accent colour; see storytelling.md
  "story": { "hero": "home", "logline": "Your roof catches sunlight all day. The power you use yourself saves much more than the power you sell. So how much does solar pay you back?" },
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
    "derived":   [ { "id": "yearlyKwh", "label": "Power the panels make a year", "unit": "kWh/yr", "formula": "size * sunHours * 365 * efficiency" } ],
    "outputs":   [ { "id": "saving", "label": "Saved each year", "unit": "$/yr", "formula": "billSaving + exportCredit" } ],
    "stores":    [ { "id": "savings", "label": "Savings so far", "unit": "$", "start": 0, "change": "saving" } ],
    "milestones":[ { "id": "paidBack", "label": "Paid back in", "store": "savings", "reaches": "cost" } ]
  },
  "checks": [                                            // what the source says the answer looks like
    { "claim": "Systems average about $2.60 per watt", "value": "cost", "between": [16000, 20000], "quote": 9 },
    { "claim": "A bigger system saves more each year", "value": "saving", "rises": "size" },
    { "claim": "Every unit the panels make goes to the home, the battery or the grid", "same": ["yearlyKwh", "direct + shifted / roundTrip + exportedKwh"] }
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
      { "id": "direct", "from": "panels", "to": "home", "carrier": "energy", "rate": "direct", "label": "Power you use at once", "unit": "kWh/yr" },
      { "id": "avoided", "from": "home", "to": "jar", "carrier": "money", "rate": "billSaving", "label": "Bill you avoid", "unit": "$/yr" }
    ]
  },
  "ask": [
    { "question": "What is your average monthly power bill?", "help": "Add your last few bills. Then divide by the number of bills.", "input": "monthlyBill" },
    { "question": "Where do you live?", "choices": [
        { "label": "Arizona", "set": { "sunHours": 6.5, "price": 0.15 }, "quote": [7, 8] },
        { "label": "New York", "set": { "sunHours": 3.6, "price": 0.29 }, "quote": [7, 8] },
        { "label": "Somewhere else", "set": { "sunHours": 4.5, "price": 0.165 } } ] }
  ],
  "explain": [
    { "shot": "establish", "caption": "Should solar go on your roof? Here is how it works." },
    { "shot": "follow", "focus": "direct", "caption": "When you use power from your panels, you do not buy it." },
    { "shot": "turn", "focus": "credit", "caption": "But the grid usually pays much less than you pay for power." },
    { "shot": "timelapse", "focus": "jar", "caption": "Your savings grow each year until they pay for the panels." },
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

**Shape**: one of `build-up`, `feedback`, `budget`, `conversion`, `cause`, `chances`, `process`. `references/story-shapes.md` tells you how to choose. The validator checks that the world fits the shape:
- `build-up`: a store and a `timelapse` shot.
- `feedback`: a store whose `change` reads a store.
- `budget`: one node with two or more flows out in the same unit.
- `conversion`: a node with flows both in and out.
- `cause`: at least one `influence` flow.
- `chances`: a `crowd` node that plays a value in `"%"`.
- `process`: see "Process stories" below.

**Story** (always give it):
- `hero` is a node on the ground. It is the person or the home that the film follows.
- `logline` tells the story in 35 words or fewer. The validator counts the words. Use one sentence if you can. STE limits a sentence to 20 words, so use two sentences for a longer logline.
- The first shot after `establish` must be about the hero.
- The last shot before `handoff` must also be about the hero.

A shot is about the hero if its `focus` is one of these:
- the hero node
- a part that is on the hero (with `on`)
- a flow to the hero or from the hero.

**Tone** (optional, default `neutral`): `health`, `money`, `energy`, `water`, `climate`, `civic`, `food`, `home` or `neutral`. Every film has a white set. The tone sets the accent colour.

**Ids**
- Use letters, digits and `_`. Start with a letter.
- Model ids are unique across inputs, constants, derived values, outputs, stores and milestones.
- Do not use `min`, `max` or `round` as an id. The formulas use these names.
- Node and flow ids are unique in the world.

**Units**
- Every input, constant, derived value, output, store and flow has a `unit`.
- A unit is text, such as `"$/yr"`, `"kWh"`, `"h/night"`, `"%"` or `"people"`. Use `""` for a plain number or a ratio.
- The validator finds the unit of every formula. It rejects a formula whose unit does not match.
- Common errors are: no `× 365`, a percent that you did not divide by 100, or kWh plus $.
- Rates are per time (`"$/yr"`). The unit of a store's `change` is the store's unit per `world.time.unit`.
- The validator converts known units (time, energy, power, mass, length, area, volume, temperature, each currency). Any other word is a countable thing.

**Where numbers come from** (for inputs and constants). Also see "Honest numbers" in `story-shapes.md`.
- `"source": "article"` with `"quote"`. The quote is an index, or a list when the number comes from several sentences. Add an optional `"note"` when you calculate the number from the quotes.
- `"source": "assumption"`. If you tuned the value so that the model matches a check, add `"fits": <check index>`. The validator does not count that check as a test.

**Inputs**
- 1–4 inputs with `kind: "lever"` and 1–5 with `kind: "condition"`.
- `"toggle": true` (with min 0 and max 1) makes a yes-or-no input. The page shows a checkbox. Ask it with choices.
- `min < max`, and `min ≤ default ≤ max`. `step` is optional.

**Sources**
- `"source": "article"` needs `"quote"`: the index of an entry in `source.quotes`. If not, use `"source": "assumption"`.
- Constants follow the same rule.
- A quote is either a sentence from the main article, or an object `{ "text", "url", "publisher", "accessed" }` from research.
- A quote from research needs a `url` that you opened. It also needs `accessed`: the date that you read it (`YYYY-MM-DD`).

**Formulas**
- You can use numbers, `+ - * /`, parentheses, `min(…)`, `max(…)`, `round(x, digits)`, `pow(x, n)` and ids.
- A derived value must not read itself through other derived values (no circular references).
- Only plain conversion numbers can be directly in a formula. They are 0, 1, 2, 5, 7, 10, 12, 24, 30, 52, 60, 100, 365 and 1000.
- Make any other number a constant with a name.

**Checks** (always give them, except in a process story): each check has a `claim` in plain words. It also has exactly one of these:
- `"value": <id>, "between": [low, high]`, with `"quote": <index>` or a `"reason"`.
  - Use `null` for an open end: `[20, null]` means "at least 20".
  - The validator finds the value at the defaults, or at `"when": {inputId: value}`.
  - For outputs and fixed derived values, it uses the value as it is.
  - For stores, and values that move with them, it uses the value at the end of the clock.
  - For milestones, it uses the time that the store gets to the level. If the store never gets there, the value is "never".
- `"value": <id>, "rises": <input>` or `"falls": <input>`. When that input moves from its min to its max, the value must move steadily in that direction.
- `"same": [formulaA, formulaB]`. Use it for balances, such as parts that add up to a whole.
  - Both formulas must be equal at the defaults. They must also be equal at every extreme of the inputs.
  - The validator rejects a check that compares a value with its own formula. That check can never fail.

Give at least one `between` check. Also give at least one `rises` check or `falls` check. The validator also runs every extreme of the inputs. At each extreme, every value must stay a number. No flow can go negative.

**Outputs:** 1–2. The page shows outputs as fixed numbers. So an output cannot read stores. Derived values can read stores. The engine calculates them again at every step of the clock.

**Stores** (0–3):
- `start`: a number, or a formula of fixed values.
- `change`: the amount per time unit. It can read stores. It can also read the derived values that read stores.
- `floor` (optional): for example 0.
- `ceiling` (optional): a number, or a formula of fixed values, such as the size of a tank.
- Every store needs a node that shows it.

**Milestones** (0–2): `store` plus `reaches` (a formula of fixed values). The result is the first time that the store crosses that level, in `world.time` units.

**World**
- `time`: `{ "unit": "day" | "week" | "month" | "year", "span": 1–100 }`. You must give it when there are stores.
- `nodes`: 2–10. Each node has a `label` and one of these:
  - `prop`, from the catalog.
  - `kind`, when no prop fits. The renderer chooses the look. The kinds are:
    - people and bodies: `person`, `crowd`, `body`, `cell`, `germ`
    - buildings: `home`, `building`, `institution`, `business`, `factory`, `farm`
    - nature: `nature`, `land`, `water`, `weather`, `sun`
    - things: `vehicle`, `machine`, `device`, `screen`, `document`, `money`, `store`, `food`, `medicine`, `time`
    - anything else: `other`.
  - Nothing, for a store node. The unit of the store sets the look. Money shows as a jar of coins. Energy shows as a battery. Anything else shows as a tank. A `jar` is only for money.
  - A `recipe` of 1–12 parts. Each part is `{ "shape": "box" | "sphere" | "cylinder" | "cone" | "torus", "size": [x, y, z] }`.
    - Optional part fields: `"color": "#rrggbb"`, `"at": [x, y, z]` and `"rotate": [x, y, z]` in degrees.
    - Sizes are in set units. A house is about 2.5 tall. The renderer scales the whole recipe to about 2.6 tall.
    - Parts stack upward in order, unless they have `at`. The `at` position starts from the base of the node (y is up).
    - For example, a pill bottle: `[{"shape": "cylinder", "size": [0.9, 1.2, 0.9], "color": "#eeeaf4"}, {"shape": "cylinder", "size": [0.96, 0.32, 0.96], "color": "#9a8fc4"}]`.
  - `url` + `credit` for a CC0 glTF model.
- Optional node fields:
  - `plays`: a model id that the prop shows. If it is an input, the viewer can drag the prop to change it.
  - `on`: another node to sit on.
  - `sky: true`: the node floats above the set.
  - `store`: a store id. Use it with `target`, a formula that draws a line on the jar.
  - `appears`: an input. The renderer shows the node only when that input is above its minimum.
  - `groups` (crowds only, instead of `plays`): 1–4 outcomes. Each outcome is `{"value": <id in "%">, "label": "caught early"}`. One crowd of 100 lights each outcome in its own colour, in order. The label of the crowd lists the outcomes.
- **No dead parts:**
  - Every input and every constant must have a use. A formula reads it, or a node shows it.
  - Every derived value must have a use.
  - Every node must take part in a flow. The node of a store can stand alone.
- `flows`: 1–12. Each flow has:
  - `from` and `to`: two different nodes
  - a `carrier`
  - a `rate` formula. It can read stores. It must never be negative.
  - a `label`
  - a `unit` (for example `kWh/yr`, `$/yr`, `h/night`).
- Carriers: `energy`, `money`, `water`, `heat`, `light`, `goods`, `people`, `data`, `time`, `carbon`, `substance` and `influence`. Some carriers need a note:
  - `time` is hours and minutes.
  - `carbon` is emissions. The renderer draws it as puffs that drift.
  - `substance` is medicine, food or pollutants.
  - `influence` is a cause that pushes on an effect. The renderer draws it as arrowheads. Its rate is the size of the effect.

**Ask** (0–5): each question has a `question`, an optional `help`, and one of these:
- `input`: the viewer types a number.
- `choices`: 2–5 options. Each option has a `label` and a `set` (input → value, inside its range). It can also have a `quote` (an index or a list of indexes).
  - An option can set a condition to a value other than its default. Then it needs `quote` or `"source": "assumption"`.
  - With `"source": "assumption"`, the page shows an asterisk.
  - One option must set the inputs of the question to their defaults. Then a viewer who does not know has a typical answer.

**Explain**
- 3–12 shots.
- `shot` is one of `establish`, `introduce`, `focus`, `follow`, `cause`, `compare`, `turn`, `timelapse`, `handoff`.
- `focus` is a node id or a flow id. `establish` and `handoff` do not need it.
- `follow` and `cause` need a flow. `timelapse` needs a node that shows a store.
- Give exactly one `turn`. Give at least one `establish`. Give at least one `follow` or `cause`.
- `caption` is the text on screen for the shot. Captions are the film's subtitles. The viewer can turn them off.
- A `caption` has 12 words or fewer. Write it in ASD-STE100. The validator checks it.
- `drive` (optional) is the input that sweeps during the shot.

**Scenes** (`"shot": "scene"`): the hero acts in a place, like a scene in a movie. Fields:
- `set`: the place. Use the id of an entry in `places` (see below). Or use a built-in set: `doorway`, `kitchen`, `postbox`, `hospital`, `livingRoom` or `lab`.
- `camera`: `close`, `medium` (default) or `wide`.
- `at`: the mark where the hero starts. `seated: true` starts the hero in a chair.
- `with: "nurse"`: a second person in the scene. At a model place or a facade place, they stand at `host`.
- `beats` (1–8, in order, one real step each): `{"do": action, "to": mark or spot, "object": letter|envelope|kit, "from": spot, "at": spot, "feel": expression, "caption": text, "camera": framing}`.
  - Actions: `idle`, `walk`, `pickUp`, `read`, `hold`, `use`, `give`, `place`, `sit`, `talk`, `listen`, `wait` and `react`.
  - Expressions: `neutral`, `curious`, `worried`, `relieved` and `smile`.
  - `walk` goes `to` a mark. `sit` is `at` a mark.
  - `pickUp` is `from` a spot. `give` and `place` go `to` a spot.
  - `use` means that the hero works with the `object` in their hands. For example, the hero opens it, takes a sample, writes on it or seals it.
  - The validator checks each name against the place.
- A beat's `caption` is the caption for that step. It shows while the step happens. The beat lasts long enough for the viewer to read it.
- A beat's caption has the same rules as every caption: 12 words or fewer, in ASD-STE100. A beat without a caption shows the `caption` of the shot.
- A beat's `camera` sets the framing for that step: `close`, `medium`, `wide` or `detail`.
- `detail` is a close look down at the hands. Use it for small actions, for example when the hero writes a date or closes a lid.
- The camera moves smoothly from one framing to the next. It never cuts.

```json
{"shot": "scene", "set": "kitchen", "at": "counter", "caption": "You take a tiny sample at home.", "beats": [
  {"do": "use", "object": "kit", "camera": "detail", "caption": "First, write the date on the sample bottle."},
  {"do": "use", "object": "kit", "camera": "detail", "caption": "Open the bottle. The lid has a sample stick."},
  {"do": "use", "object": "kit", "camera": "detail", "caption": "Put the stick back in the bottle. Close the lid tightly."},
  {"do": "hold", "object": "kit", "caption": "Then put the bottle in the envelope."}
]}
```

| Place | Marks (where the hero stands) | Spots (where things go) |
|---|---|---|
| `doorway` (front hall) | `mat`, `enter` | `mat`, `letterbox`, `console` |
| `kitchen` | `counter`, `chair` | `counter`, `sink`, `sill`, `table` |
| `livingRoom` | `shelf`, `sofa` | `shelf`, `coffeeTable` |
| `postbox` (on the pavement) | `box`, `approach` | `slot`, `lamp` |
| `hospital` (a clinic room) | `patientChair`, `nurse`, `door`, `couch` | `desk`, `sideTable`, `screen` |
| `lab` | `bench` | `analyser`, `tray`, `rack`, `bench` |
| a `model` place | `front`, `entrance`, `host` | `door` |
| a `facade` place | `front`, `entrance`, `desk`, `host` | `door`, `desk`, `sign` |

**Places** (optional, top level): the places that the story goes to, when the built-in sets are not enough. Find the right place for the topic. For example, a film about a regulation should show the regulator.
```json
"places": [
  {"id": "regulator", "kind": "facade", "label": "Financial Conduct Authority", "image": "https://upload.wikimedia.org/…/fca-building.jpg", "credit": "Photo: A. Person, CC BY-SA 4.0, Wikimedia Commons"},
  {"id": "townHall", "kind": "model", "url": "models/town-hall.glb", "credit": "Model: B. Person, CC0, Poly Pizza", "width": 14},
  {"id": "home", "kind": "set", "set": "kitchen"}
]
```
- `kind: "set"` uses a built-in set (`set`). Each built-in set can be only one place.
- `kind: "model"` is a glTF/GLB model of a building. It needs `url` and `credit`. Its front must face +Z in the file. The renderer scales it into a plot that is `width` metres wide (6–24, default 10).
- `kind: "facade"` is a plain building with the name of the place (`label`) over the door. To show a picture on its front, give it `image` and `credit`. The `image` is a photo or a picture of the real place. `width` is 6–24 m (default 9).
- `label` is the name on the building (up to 40 characters). The page shows the credits with the sources.
- Every place must have at least one scene. A screenplay with no `places` uses the built-in sets by name.

**One world, one hero.** All the places stand along one street, in the order that the film first goes to them. The doorway, the kitchen and the living room are rooms of the hero's house. Doorways connect the rooms. A front door opens onto the street. The post box is a few steps from the front gate. The clinics and the labs are farther down the street. Model places and facade places stand across the road. The renderer cuts away the side of each room that is near the camera, like a doll's house.
- Scenes that follow each other are one continuous scene. The next scene starts where the last scene ended. The hero still holds what they held.
- If the next scene is in a different place, the hero walks there at the start of the shot. The camera follows.
- If the first beat is a `walk`, the hero walks directly to that mark.
- A walk of more than about 14 m becomes a crane. The camera goes up over the roofs, along the street and down onto the new place.
- After a diagram shot, the film goes back to the story with a short crane down onto the place.
- When a diagram shot comes after a scene, the camera rises and the picture fades to white.
- The walk or the crane makes the shot longer (see `shot-types.md`). So write the caption for the whole move.
- Put the scenes in an order that makes sense for the hero's journey. For example: the kitchen, then the post box, then the clinic.

`examples/bowel-screening` shows a full director's cut.

**Simulate:** `controls` lists 1–6 input ids. The page shows them as sliders.

**Decide:**
- `tradeoffs`, `leftOut` and `questionsToAsk` each hold 1–6 sentences.
- `compare` (optional): 2–3 options, each with a `label` and a `set`. The page shows them side by side, with the viewer's own numbers.

**Words:** the checker rejects every word in the list "Words we don't use" in `writing-rules.md`.

## Process stories

A `process` story explains steps or parts that have no numbers that a reader could change.
- It has `version`, `shape`, `question`, `source`, `world`, `explain` and `decide`.
- It has **no** `model`, `checks`, `ask`, `simulate` or `world.time`.
- Nodes need no `plays`, `store`, `appears` or `target`.
- Flows have no `rate` or `unit`. Every step moves at the same steady speed.
- Shots: `establish`, `introduce`, `focus`, `follow`, `compare`, `turn` (at most one) and `handoff`. Use at least one `follow`.
- `decide` has `tradeoffs`, `leftOut` and `questionsToAsk`. It has no `compare`.
- The film shows Explain, then Decide.

## What the renderer does with the screenplay

- **Layout.** Nodes stand on a diorama in the order of the flows, from left to right. Stores come forward. Flows show as cables (energy), paths (money, goods, people) or pipes (water). Particles move along each flow. The number of particles shows the rate.
- **Each shot.** The camera moves to the setup for that shot type. Then it makes its move. The move is a slow push, a tracking ride along a flow, or a time-lapse on a store.
- **The `drive` input.** The input sweeps from default to min, to max, and back to default. The model, the flows and the stores change on every frame.
- **After Explain.** The page asks the `ask` questions ("Make it yours"). Then it gives the viewer the sliders and the clock (Simulate). The button "I'm ready to decide" opens Decide with the comparison.
- **The MP4 recording** shows the same three acts. A script controls Simulate: the questions appear, then the controls move and the clock runs.
