# Screenplay format (version 1)

One JSON object. `scripts/validate.mjs` checks every rule below and explains any failure in plain English.

```jsonc
{
  "version": 1,
  "question": "Should I put solar on my roof?",          // the decision, reader's voice
  "source": {
    "title": "Homeowner's Guide to Solar",
    "publisher": "U.S. Department of Energy",
    "url": "https://…",
    "quotes": ["exact sentence from the article", "…"]   // numbers cite these by index
  },
  "model": {
    "inputs": [                                         // become sliders in Simulate
      { "id": "size", "label": "System size", "unit": "kW", "kind": "lever",
        "min": 2, "max": 10, "step": 0.5, "default": 6, "source": "assumption" },
      { "id": "price", "label": "Price you pay for power", "unit": "$/kWh", "kind": "condition",
        "min": 0.12, "max": 0.45, "step": 0.01, "default": 0.25, "source": "article", "quote": 1 }
    ],
    "constants": [                                      // named numbers used in formulas
      { "id": "costPerKw", "label": "Installed cost per kW", "unit": "$/kW", "value": 3000, "source": "assumption" }
    ],
    "derived": [                                        // in-between values (optional)
      { "id": "yearlyKwh", "label": "Power made each year", "unit": "kWh", "formula": "size * sunHours * 365 * efficiency" }
    ],
    "outputs": [                                        // 1–2 outcomes the person cares about
      { "id": "payback", "label": "Years to pay back", "unit": "years", "formula": "cost / saving" }
    ]
  },
  "cast": [
    { "id": "sun", "actor": "sun", "plays": "sunHours", "source": "studio", "label": "Sun" },
    { "id": "x", "source": "custom", "plays": "saving", "label": "Savings jar",
      "recipe": [ { "shape": "cylinder", "size": [1.2, 1.4, 1.2], "color": "#86b6dd" },
                  { "shape": "cylinder", "size": [1.3, 0.2, 1.3], "color": "#2f3e57" } ] },
    { "id": "m", "source": "open", "actor": "car", "plays": "km", "url": "https://…/car.glb",
      "credit": "Car by Kenney (CC0)" }
  ],
  "explain": [
    { "shot": "establish", "focus": "home", "caption": "Should solar go on your roof? Here is how it works." },
    { "shot": "cause", "focus": "sun", "affects": "panels", "caption": "More full-sun hours means more power from the same panels." },
    { "shot": "turn", "focus": "grid", "drive": "exportRate", "caption": "But extra power sent to the grid often earns much less." },
    { "shot": "handoff", "focus": "home", "caption": "Your turn. Change the numbers and watch what moves." }
  ],
  "simulate": { "controls": ["size", "selfUse", "price"], "prompt": "Try your own roof and your own power prices." },
  "decide": {
    "tradeoffs": ["…"], "leftOut": ["…"], "questionsToAsk": ["…"]
  }
}
```

## Rules

**Ids**
- Letters, digits and `_`, starting with a letter. Unique across inputs, constants, derived values and outputs.
- `min`, `max` and `round` are reserved.

**Inputs**
- 2–4 with `kind: "lever"` and 1–3 with `kind: "condition"`.
- `min < max`, and `min ≤ default ≤ max`.
- `step` is optional.

**Sources**
- `"source": "article"` needs `"quote"`, the index of a sentence in `source.quotes`.
- Otherwise use `"source": "assumption"`.
- Constants follow the same rule.

**Formulas**
- Allowed: numbers, `+ - * /`, parentheses, `min(…)`, `max(…)`, `round(x, digits)`, and ids.
- No circular references.
- Only plain conversion numbers may appear directly in a formula: 0, 1, 2, 7, 10, 12, 24, 30, 52, 60, 100, 365, 1000. Any other number must be a named constant.

**Outputs:** 1–2.

**Cast**
- 2–10 actors.
- `plays` (optional) must be a model id. Actors without `plays` are scenery.
- `source`:
  - `studio` needs `actor` (see the cast catalog).
  - `open` needs `url` and `credit`.
  - `custom` needs a `recipe` of 1–12 shapes from `box`, `sphere`, `cylinder`, `cone`, `torus`. Each shape has `size: [x, y, z]`, plus optional `color` (#hex), `at: [x, y, z]` and `rotate: [deg, deg, deg]`. Parts stack upward unless `at` is given.

**Explain**
- 3–12 shots.
- `shot` is one of `establish`, `introduce`, `focus`, `cause`, `compare`, `turn`, `handoff`.
- `focus` is a cast id. `cause` shots also need `affects`, another cast id.
- Exactly one `turn`, and at least one `establish`.
- `caption` is 12 words or fewer.
- `drive` (optional) is the input to sweep during the shot. By default it's the input the focused actor plays, or the first lever it depends on.

**Simulate:** `controls` lists the input ids to show as sliders.

**Decide:** each of `tradeoffs`, `leftOut` and `questionsToAsk` holds 1–6 sentences.

**Words:** the checker rejects "gamified" and "engagement".

## What the renderer does with it

- **Each shot:** the camera travels to that shot type's setup during the first 45% of the shot, then slowly pushes in.
- **Driven input:** it sweeps default → min → max → default. The model recomputes every frame, so every actor downstream visibly reacts.
- **After Explain:** the film pauses on the model and the viewer gets the sliders (Simulate). "I'm ready to decide" then opens the Decide panel.
- **The recorded MP4** shows the same three acts, using a scripted Simulate segment.
