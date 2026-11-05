# Living diorama (screenplay v2) — design

Approved 2026-11-05. Replaces the "row of gauges" staging from v1.

## Problem
v1 put one clay object per model value on an arc. Each object only displayed a number, nothing was
connected, and Simulate was sliders changing labels. It read as a dashboard sculpted in clay.

## Idea
The screenplay describes a **system**: nodes (things) connected by **flows** (energy, money, water,
heat, goods, people, light, data) whose rates are model formulas, plus **stores** that fill and drain
over a simulated clock. The renderer builds one connected miniature world on a plinth and runs it.

## Screenplay v2 (changes from v1)
- `version: 2`.
- `model.stores[]` (0–3): `{id, label, unit, start, change}`; `change` is a per-time-unit formula
  that may read stores (feedback loops). Optional `floor` (number).
- `model.milestones[]` (0–2): `{id, label, store, reaches}`. Value = first clock time the store
  crosses `reaches` (a formula), or "not within the span".
- Derived values and outputs cannot read stores (they stay static); flows and store changes can.
- `world.time` `{unit, span}` (needed when there are stores).
- `world.nodes[]` (2–10) replace `cast`: `{id, prop, label, plays?, on?, sky?, store?, target?}`
  plus the v1 `recipe` / `url`+`credit` options. `on` mounts a node on another (panels on a roof).
  `sky` floats it above the set. `store` binds a store; `target` is a formula drawn as a line.
- `world.flows[]` (1–12): `{id, from, to, carrier, rate, label?, unit?}`.
- Shots: `establish`, `introduce`, `focus`, `follow` (camera tracks along a flow), `cause`
  (two-shot of a flow's ends), `compare`, `turn`, `timelapse` (clock runs over a store), `handoff`.
  `focus` is a node or flow id. Needs exactly one `turn` and at least one `follow` or `cause`.

## Rendering
- Layered layout: flows define ranks left→right; attached and sky nodes follow their host.
- Particles travel along each flow path. Density follows the rate, normalised per carrier+unit so
  flows of the same kind are comparable (a trickle of small credits vs a stream of bill savings).
- Stores show their level at the clock time; targets draw a line; milestones raise a flag.
- Look: sky gradient, image-based light, a plinth diorama, emissive energy carriers.
- Film finish (added 2026-11-06, after "it feels like a 90s video game, not a film"): the scene renders
  into a high-range buffer and is finished in `post.js` with contact shade (ambient occlusion), bloom,
  depth of field focused on what the camera aims at, a colour-true tone curve, a light grade, vignette
  and fine grain. Low warm key light with soft shadows. The camera drifts slightly in every shot.
  Coins stand on edge and roll (turning by distance over radius); power and heat are glowing pulses
  inside glass conduits; sunlight is a soft shaft. A soft pool of light marks the node in focus.
  Quality steps down for phones, software rendering and slow frames; recording always uses full quality.
- Simulate: drag a node to change the input it plays; a compact dock keeps sliders for keyboard and
  screen readers; Run/Pause the clock; a ghost of the previous run stays on each store.

## Unchanged
Single offline HTML, MP4 recording, safe formula parser, validator with plain-English errors,
sourced numbers, Decide never recommends, the web tool.

## Addendum: the skill thinks through the person's situation (requested 2026-11-05)
- Skill step "Understand the person": in Claude Code, ask up to three questions that change the answer
  (where they live, a number from a bill, which option they lean toward) before writing.
- Skill step "Check local and current numbers": web-search current local figures (install cost, prices,
  export credits), quote each with URL and publisher (`source.quotes` entries may be `{text, url, publisher}`).
- Screenplay `ask[]` (0–5): the page asks every viewer the same kind of questions ("Make it yours") after the
  film; a typed number sets one input, a choice sets several (e.g. a state sets sun hours, price and cost).
- `decide.compare[]` (2–3 options, e.g. grid credit vs home battery) shown side by side with the viewer's numbers.
- Nodes with `appears` (e.g. the battery) grow into the world when their input is above its minimum.
