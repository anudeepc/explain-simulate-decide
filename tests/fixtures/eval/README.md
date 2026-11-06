# Cross-topic test set

Eight short articles from different fields (`tests/fixtures/articles/`), each turned into a screenplay by an agent following only the skill. The numbers in the articles are illustrative.

| Article | Field | Shape the skill chose |
|---|---|---|
| `sleep-screens` | health | build-up, with cause links |
| `credit-card` | personal finance | feedback |
| `rainwater-tank` | home, water | build-up |
| `day-hours` | work and life | budget |
| `ebike-commute` | transport, climate | conversion |
| `bowel-screening` | health, risk | chances |
| `sugar-tax` | public policy | cause |
| `vaccine` | biology, no numbers | process |

`tests/schema.test.mjs` checks that every screenplay here stays valid, so a change to the validator can't quietly break a topic. To check them visually:

```bash
for n in $(ls tests/fixtures/eval); do
  node skills/explain-simulate-decide/scripts/render.mjs tests/fixtures/eval/$n/screenplay.json -o test-results/eval/$n.html
  node tests/render-check.mjs test-results/eval/$n.html test-results/eval/$n
done
```

To test a change to the skill's instructions, give a fresh agent the skill folder and one article, with no web search and no one to ask, and compare its screenplay and the validator errors it hit with these.
