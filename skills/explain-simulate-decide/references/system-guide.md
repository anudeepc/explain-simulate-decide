# System guide: turning a topic into a living world

Most stories are about **something flowing** and **something building up**, or about one thing **pushing on** another. Power flows from the roof and money builds up in savings. Interest flows in and a debt grows. Sleep is lost to screens and sleep debt piles up. Map those flows, stores and causes, and the film nearly writes itself.

Choose the story's shape first (`story-shapes.md`): it decides which of the steps below matter most. A `cause` story is mostly influences, a `chances` story is mostly crowds, and a `process` story has flows with no rates.

## 1. List the things (nodes)

Write down every *thing* the story mentions that holds, makes, changes or receives something.

| Role | Question | Solar | Credit card | Sleep and screens |
|---|---|---|---|---|
| Source | Where does it come from? | Sun | Your pay | Your evening |
| Converter | What turns one thing into another? | Panels (on the house) | — | — |
| Store | What builds up or runs down over time? | Savings jar | Card balance | Sleep debt (tank) |
| End point | Where does it end up? | Your home, the grid | The bank | Your body |
| Cause | What pushes on something else? | — | The interest rate | Screen time |

Rules:
- **Use 4–8 nodes.** Fewer feels empty and more feels like a factory.
- **Put the person's own things at the centre** (home, car, wallet). Put external parties (the grid, the bank, the market) to the side.
- **Mount parts on their host with `on`.** Panels go on a roof, a battery could go on a wall.
- **Things above the set go in the `sky`:** the sun, the weather.
- **Pick props a viewer would recognise with the sound off.** See `prop-catalog.md`, or give a `kind` (`person`, `body`, `building`, `institution`, `land`…) and let the renderer choose.

## 2. Draw the arrows (flows)

For each pair of nodes, ask what moves between them and how much per time unit.

| Flow | From → to | Carrier | Rate (formula) | Unit |
|---|---|---|---|---|
| Sunlight | sun → panels | light | `sunHours` | h/day |
| Used as it's made | panels → home | energy | `direct` | kWh/yr |
| Sent to the grid | panels → grid | energy | `exportedKwh` | kWh/yr |
| Bought from the grid | grid → home | energy | `boughtKwh` | kWh/yr |
| Bill you avoid | home → jar | money | `billSaving` | $/yr |
| Export credit | grid → jar | money | `exportCredit` | $/yr |

Rules:
- **Every flow needs a rate formula from the model, with a unit.** If you can't write one, leave the flow out (unless the story is a `process`).
- **A cause is a flow too:** carrier `influence`, from the cause to what it changes, with the size of the effect as its rate (never negative; the label says which way it pushes).
- **Keep units consistent within a carrier.** The renderer draws flows that share a carrier and unit on the same scale. A $276 credit stream next to a $607 savings stream looks half as busy, and that comparison is often the whole insight.
- **Show the flows people forget**, such as power still bought at night, interest, or heat lost through walls. They're usually where the misconception hides.
- **Use 4–10 flows.**

## 3. Add time (stores and milestones)

Whatever builds up becomes a **store**, with a `start` value and a `change` per time unit:

```json
"stores": [{ "id": "savings", "label": "Savings so far", "unit": "$", "start": 0, "change": "saving" }],
"milestones": [{ "id": "paidBack", "label": "Paid back in", "store": "savings", "reaches": "cost" }]
```

- **Feedback loops are allowed.** A store's `change` may read stores, including itself. For example, a loan balance with `"change": "balance * rate / 100 - repayment"` and `"floor": 0`.
- **Milestones are the moments people ask about:** paid back, debt cleared, tank empty. The page shows "Paid back in 20.6 years", or "Not within 25 years".
- **Give the store node a `target`** (for example, the system cost). The jar then draws a line, and a flag rises when the store reaches it.
- **Set `world.time`** to a unit and span that fit the decision: 25 years for solar, 30 years for a mortgage, 12 months for a budget.

## 4. Things that appear

An option that isn't always there (a battery, a second car, an extra payment) gets a node with `"appears": "<input>"`. It grows into the scene when that input is above its minimum, and its flows appear with it. Pair it with a `cause` shot that has `drive` set to that input, so the viewer sees it arrive.

## 5. Check the map before writing JSON

- Can you point at the store you care about, and see every flow that fills or drains it?
- Is the turning point visible? Often two streams side by side, or a jar that never reaches its line.
- Would a viewer with the sound off guess what each node and stream is?
