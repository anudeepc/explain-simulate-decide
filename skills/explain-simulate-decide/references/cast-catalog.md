# Cast catalog

Studio actors share one matte "clay" look. Each one shows its value from 0 to 1, where 0 is the bottom of the value's range and 1 is the top.

| Actor | Shows the value as | Good for |
|---|---|---|
| `sun` | brightness, size and ray length | sunshine, energy, optimism, daylight |
| `house` | window glow | home, household, property, "you" |
| `roof-panel` | number of active solar cells | solar size, capacity, installed amount |
| `battery` | fill level | stored energy, charge, reserves |
| `power-bill` | bill amount bar, warmer colour | prices, bills, costs per unit |
| `phone` | screen bar/fill | apps, screen time, notifications, digital use |
| `coin-stack` | number of coins | savings, money per year, income |
| `piggy-bank` | glow and size | savings goals, balance |
| `shopping-bag` | items rising out of the bag | spending, purchases, consumption |
| `clock` | hand sweep and face fill | time, years, payback, hours |
| `calendar` | highlighted days | days, frequency, schedules |
| `gauge` | needle angle | rate, efficiency, percentage, score |
| `thermometer` | mercury height | temperature, heat, intensity |
| `car` | charge/fuel bar, headlights | travel, distance, transport |
| `plug` | glow along the cable | grid, electricity flow, connection |
| `cloud` | coverage | weather, uncertainty, shade |
| `tree` | canopy size | environment, growth, emissions avoided |
| `water-drop` | drop size and fill | water use, liquids, rainfall |
| `factory` | chimney puffs | industry, emissions, production |
| `person-figure` | bar beside the figure | people, health, wellbeing, workload |
| `document` | stack of pages | paperwork, rules, reports, requirements |
| `scale` | beam tilt | balance, trade-off, comparison |
| `arrow-flow` | arrow length and thickness | flow, growth rate, transfer |
| `bar-stack` | bar heights | totals, amounts, any quantity |
| `stand-in` | labelled block with a meter | anything else; uses the actor's `label` |

## Tips

- **Pick the actor a viewer would guess with the sound off.**
- **Use one actor per idea.** Don't use the same actor twice, unless it's a `stand-in`.
- **Write a `label`** (2–3 words). Stand-ins show it on their face, and labels identify every actor in the Decide credits.
- **Missing an actor?** Use `"source": "custom"` with a recipe, or a stand-in, and consider contributing a studio actor. Each one is a single file in `engine/cast/`.
