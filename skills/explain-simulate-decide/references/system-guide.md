# System guide: make a topic into a living world

Most stories are about **something that flows** and **something that builds up**. Or they are about one thing that **pushes on** a different thing. Power flows from the roof, and money builds up in savings. Interest flows in, and a debt grows. Screens take sleep, and sleep debt piles up. Map those flows, stores and causes. Then the film nearly writes itself.

Choose the shape of the story first (`story-shapes.md`). The shape decides which of the steps below are most important. A `cause` story is mostly influences. A `chances` story is mostly crowds. A `process` story has flows with no rates.

## 1. List the things (nodes)

Write down each *thing* in the story that holds, makes, changes or receives something.

| Role | Question | Solar | Credit card | Sleep and screens |
|---|---|---|---|---|
| Source | Where does it come from? | Sun | Your pay | Your evening |
| Converter | What turns one thing into a different thing? | Panels (on the house) | — | — |
| Store | What builds up or runs down over time? | Savings jar | Card balance | Sleep debt (tank) |
| End point | Where does it end up? | Your home, the grid | The bank | Your body |
| Cause | What pushes on something else? | — | The interest rate | Screen time |

Rules:
- **Use the fewest nodes that answer the question,** usually 3 to 7. Each node must take part in a flow (the best part is no part).
- **Put the hero's own things at the centre** (home, car, wallet). Put outside parties (the grid, the bank, the market) to the side.
- **Put parts on their host with `on`.** Panels go on a roof. A battery can go on a wall.
- **Things above the set go in the `sky`:** the sun, the weather.
- **Choose props that a viewer would recognise with the sound off.** See `prop-catalog.md`. Or give a `kind` (`person`, `body`, `building`, `institution`, `land`…) and let the renderer choose.

## 2. Draw the arrows (flows)

For each pair of nodes, ask what moves between them. Ask how much moves in each time unit.

| Flow | From → to | Carrier | Rate (formula) | Unit |
|---|---|---|---|---|
| Sunlight | sun → panels | light | `sunHours` | h/day |
| Used as it's made | panels → home | energy | `direct` | kWh/yr |
| Sent to the grid | panels → grid | energy | `exportedKwh` | kWh/yr |
| Bought from the grid | grid → home | energy | `boughtKwh` | kWh/yr |
| Bill you avoid | home → jar | money | `billSaving` | $/yr |
| Export credit | grid → jar | money | `exportCredit` | $/yr |

Rules:
- **Each flow needs a rate formula from the model, with a unit.** If you cannot write one, do not show the flow. A `process` story is the exception.
- **A cause is a flow too.** Its carrier is `influence`. It goes from the cause to the thing that it changes. Its rate is the size of the effect. The rate is never negative. The label tells which way the cause pushes.
- **Keep the units the same in each carrier.** The renderer draws flows with the same carrier and unit on the same scale. A $276 credit stream next to a $607 savings stream looks half as busy. That comparison is often the whole insight.
- **Show the flows that people forget.** Examples: power still bought at night, interest or heat lost through walls. The misconception usually hides in these flows.
- **Use the fewest flows that tell the story,** usually 3 to 8.

## 3. Add time (stores and milestones)

Each amount that builds up becomes a **store**, with a `start` value and a `change` per time unit:

```json
"stores": [{ "id": "savings", "label": "Savings so far", "unit": "$", "start": 0, "change": "saving" }],
"milestones": [{ "id": "paidBack", "label": "Paid back in", "store": "savings", "reaches": "cost" }]
```

- **You can use feedback loops.** The `change` of a store can read stores, also its own store. Example: a loan balance with `"change": "balance * rate / 100 - repayment"` and `"floor": 0`.
- **Milestones are the moments that people ask about:** paid back, debt cleared, tank empty. The page shows "Paid back in 20.6 years" or "Not within 25 years".
- **Give the store node a `target`** (for example, the cost of the system). Then the jar draws a line. A flag goes up when the store gets to the target.
- **Set `world.time`** to a unit and a span that fit the decision. Examples: 25 years for solar, 30 years for a mortgage, 12 months for a budget.

## 4. Things that appear

An option that is not always there (a battery, a second car, an extra payment) gets a node with `"appears": "<input>"`. The node grows into the scene when that input is above its minimum. Its flows appear with it. Use it with a `cause` shot that has `drive` set to that input. Then the viewer sees it arrive.

## 5. Check the map before you write JSON

- Can you point at the store that you care about?
- Can you see each flow that fills or empties that store?
- Can the viewer see the turning point? Often it is two streams side by side, or a jar that never gets to its line.
- With the sound off, can a viewer guess what each node and stream is?
