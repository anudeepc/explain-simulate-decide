# Prop catalog

Studio props share one matte "clay" look and stand on the diorama as nodes. A prop with `plays` shows that value from 0 to 1 (the bottom to the top of its range). If `plays` is an input, the viewer can drag the prop up or down in Simulate to change it.

## Places and parties (good hosts for flows)

| Prop | Shows the value as | Good for |
|---|---|---|
| `house` | window glow | the home, the household, "you". Has a roof slot: put `roof-panel` on it with `on` |
| `factory` | chimney puffs | industry, production, emissions |
| `bank` | glowing coin emblem | lenders, banks, funds, insurers, the tax office |
| `power-pole` | meter needle | the electricity grid, the utility |
| `shopping-bag` | items rising out of the bag | shops, spending, consumption |
| `car` | charge or fuel bar, headlights | travel, transport |
| `person-figure` | bar beside the figure | one person, workload |
| `crowd` | 100 small people; plays a value in `"%"` and lights that many | populations, risks, "out of 100 people like you" |
| `body` | standing figure with a glowing heart | health, symptoms, fitness, a dose |
| `building` | office block whose windows light up | schools, hospitals, offices, councils, companies |
| `hill` | grassy hill with trees and a field | land, farms, forests, a region |

## Sources (often with `"sky": true`)

| Prop | Shows | Good for |
|---|---|---|
| `sun` | brightness, size, rays | sunshine, daylight |
| `cloud` | coverage | weather, rain, uncertainty |

## Stores (use with `store`, and `target` for a line)

| Prop | Shows | Good for |
|---|---|---|
| `jar` | coins filling a glass jar, a target line, a flag when reached, a ghost ring of the last try | **money only**: savings, balances |
| `tank` | a glass tank filling with liquid, with the same target line, flag and ghost ring | anything else that builds up: water, sleep debt, carbon, stock |
| `battery` | fill level | stored energy |
| `piggy-bank` | glow and size | small savings goals |
| `coin-stack` | number of coins | amounts of money |
| `water-drop` | size and fill | water stored or used |

## Converters and meters

| Prop | Shows | Good for |
|---|---|---|
| `roof-panel` | active solar cells (lies flat when `on` a roof) | solar size, capacity |
| `gauge` | needle | rate, efficiency, percentage |
| `thermometer` | mercury height | temperature, heat |
| `clock` | hand sweep | time, hours |
| `calendar` | highlighted days | days, frequency |
| `plug` | glow along the cable | a connection, a device |
| `phone` | screen fill | apps, screen time |
| `power-bill` | bill amount bar | prices, bills |
| `document` | stack of pages | rules, paperwork, reports |
| `scale` | beam tilt | balance, trade-off |
| `tree` | canopy size | environment, growth |
| `arrow-flow`, `bar-stack` | arrow or bars | generic amounts (prefer a flow) |
| `stand-in` | labelled block | anything else; shows the node's `label` |

## No prop fits?

Give the node a `kind` instead of a `prop` (see `story-shapes.md`), and the renderer picks a fitting look. A store node can leave out both: money gets a jar, energy a battery, and anything else a tank.

## Tips

- **Pick the prop a viewer would guess with the sound off.**
- **Nodes are places and things; flows are what moves.** Don't use a prop to show a rate if a flow can show it.
- **Missing a prop?** Use a `recipe` of simple shapes, or a stand-in, and consider contributing a studio prop. Each one is a single file in `engine/cast/`, listed in `cast/index.js` and `cast/names.js`.
