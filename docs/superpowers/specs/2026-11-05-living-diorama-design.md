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
- Simulate: drag a node to change the input it plays; a compact dock keeps sliders for keyboard and
  screen readers; Run/Pause the clock; a ghost of the previous run stays on each store.

## Unchanged
Single offline HTML, MP4 recording, safe formula parser, validator with plain-English errors,
sourced numbers, Decide never recommends, the web tool.
