# Prop catalog

Studio props share one matte "clay" look. They stand on the diorama as nodes. A prop with `plays` shows that value from 0 to 1 (the bottom to the top of its range). If `plays` is an input, the viewer can drag the prop up or down in Simulate to change the input.

## Places and parties (good hosts for flows)

| Prop | Shows the value as | Good for |
|---|---|---|
| `house` | window glow | the home, the household, "you". It has a roof slot. Put `roof-panel` on it with `on`. |
| `factory` | chimney puffs | industry, production, emissions |
| `bank` | a coin emblem that glows | lenders, banks, funds, insurers, the tax office |
| `power-pole` | meter needle | the electricity grid, the utility |
| `shopping-bag` | items that rise out of the bag | shops, spending, consumption |
| `car` | charge or fuel bar, headlights | travel, transport |
| `person-figure` | bar next to the figure | one person, workload |
| `crowd` | 100 small people. It plays a value in `"%"` and lights that many people. Or it shows up to 4 outcomes in colour with `groups`. | populations, risks, "out of 100 people like you" |
| `body` | a person figure with a heart that glows | health, symptoms, fitness, a dose |
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
| `jar` | coins that fill a glass jar, a target line, a flag at the target, a ghost ring of the last try | **money only**: savings, balances |
| `tank` | a glass tank that fills with liquid, with the same target line, flag and ghost ring | anything else that builds up: water, sleep debt, carbon, stock |
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
| `power-bill` | bar for the bill amount | prices, bills |
| `document` | stack of pages | rules, paperwork, reports |
| `scale` | beam tilt | balance, trade-off |
| `tree` | canopy size | environment, growth |
| `arrow-flow`, `bar-stack` | arrow or bars | general amounts (a flow is better) |
| `stand-in` | block with a label | anything else. It shows the `label` of the node. |

## No prop fits?

Give the node a `kind`, not a `prop` (see `story-shapes.md`). Then the renderer chooses a look that fits. A store node can have neither. Then money gets a jar, energy gets a battery and all other amounts get a tank.

## Tips

- **Choose the prop that a viewer would guess with the sound off.**
- **Nodes are places and things. Flows are what moves.** Do not use a prop to show a rate if a flow can show it.
- **Is a prop missing?** Use a `recipe` of simple shapes, or a stand-in. You can also add a studio prop to the project. Each studio prop is one file in `engine/cast/`. The files `cast/index.js` and `cast/names.js` list each studio prop.
