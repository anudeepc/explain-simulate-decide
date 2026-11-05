# Explain, Simulate, Decide

**Don't read the report. Run the model.**

Turn an article into a short, directed 3D explainer in three acts:

1. **Explain.** A calm, directed film shows how the topic works, one idea per shot.
2. **Simulate.** The same actors on the same stage respond to *your* sliders, so you see cause and effect for yourself.
3. **Decide.** The camera steps back and you get the trade-offs, what the model leaves out, and questions to ask. The page never tells you what to choose.

The output is **one offline HTML file**. It can also record itself to a **1080p 60 fps MP4** with a generated music bed.

![Demo: Should I put solar on my roof?](docs/media/demo.gif)

*Demo: "Should I put solar on my roof?", built from the U.S. Department of Energy's homeowner guides (public domain). [Open the interactive page](examples/solar/solar.html).*

---

## Why

Spreadsheets didn't replace accountants. They moved them from calculating to modelling. AI can do the same for anyone who reads: move people from reading reports to running models. When building is cheap, clarity, honest models and craft are what matter. This project tries to make that easy and reusable.

## Three ways to use it

### 1. As a Claude Code skill

```bash
/plugin marketplace add anudeepc/explain-simulate-decide
/plugin install explain-simulate-decide@explain-simulate-decide
```

Or copy `skills/explain-simulate-decide/` into `~/.claude/skills/`. Then ask:

> Explain this article as an interactive explainer: https://…

Claude reads the article and writes a screenplay. It then validates the screenplay, renders the page and checks its own work against a list (every number sourced, Decide never recommends).

### 2. The free web tool, with your own key

Open the [GitHub Pages site](https://anudeepc.github.io/explain-simulate-decide/web/) and:

1. Paste the article, or upload a PDF.
2. Pick a provider: Claude, OpenAI, OpenRouter (which has free models), Groq, local **Ollama**, or any OpenAI-compatible API.
3. Generate. Then **Download HTML**, **Record MP4** or **Download screenplay**.

There is no server. Your article and key go only to the provider you choose. Pick **Demo** to try it without a key.

### 3. From the command line

```bash
node skills/explain-simulate-decide/scripts/validate.mjs my-screenplay.json
node skills/explain-simulate-decide/scripts/render.mjs my-screenplay.json -o explainer.html
```

This needs Node 18 or later. No packages to install.

## How it works

```
article ──► AI writes a screenplay (JSON) ──► validator ──► fixed renderer ──► film + model + decision
              question, levers, model,         plain-English    staging, camera,
              cast, shots, decide notes        errors           timing, motion
```

The key design choice is that **the AI writes only the screenplay, never the film.** All the directing lives in code:

- **Consistent quality.** Every film follows the same directing rules (staging, camera speed, easing, reading-time pacing), whatever model wrote the screenplay.
- **Small and free models work.** They only fill in structured content.
- **Safety.** No AI-written code ever runs. Formulas go through a tiny arithmetic parser (no `eval`), captions are shown as plain text, and exported pages carry a strict Content-Security-Policy.
- **Honesty is enforced.** Every number is either quoted from the article or labelled an assumption, and the validator checks this.

### The director's rules

| Shot | Camera | What happens |
|---|---|---|
| `establish` | Wide, slow push-in | The whole set; the question appears |
| `introduce` | ¾ angle, subject on a third | The actor sweeps through its range |
| `cause` | Two-shot | A light flow travels from cause to effect, which visibly reacts |
| `compare` | Front-on | Low vs high |
| `turn` | Hold, then slow reveal | The common misconception is corrected |
| `handoff` | Settles to the simulation view | The sliders appear |

Only one thing moves at a time, and nothing moves unless it explains something. Shot length follows reading time. Camera moves become cuts when the viewer has turned on "reduce motion".

### The cast

There are 25 studio actors in one matte clay style: everyday objects that each show one value from 0 to 1. A bill grows, a battery fills, a gauge needle swings, coins stack up, a clock sweeps.

![The studio cast](docs/media/cast.png)

The **Cast** setting chooses where actors come from:

- **Studio:** the built-in clay cast above.
- **Open library:** free CC0 glTF models, with credits added automatically.
- **Custom-built:** simple shapes the AI describes as data.

Any actor that can't be built falls back in this order: studio, then custom, then a labelled stand-in block. Every article renders.

## Repository layout

```
skills/explain-simulate-decide/
  SKILL.md                 the skill (short; details in references/)
  references/              extraction guide, screenplay format, shot types, writing rules, cast catalog
  scripts/                 validate.mjs, render.mjs
  engine/                  the renderer: plain ES modules, three.js vendored, no build step
web/                       the free upload tool (static, GitHub Pages)
examples/solar/            the demo screenplay and page
tests/                     node --test unit tests + browser checks (Playwright)
```

## Development

```bash
npm test                    # unit tests: formulas, model, schema, timing, layout, camera, export
npm run render:solar        # rebuild the demo page
npm install && npm run check            # browser render check (needs Playwright's Chromium)
node tests/web-check.mjs                # web tool with a fake AI provider
node tests/record-mp4.mjs examples/solar/solar.html out.mp4 --channel chrome
python3 -m http.server 8080 # then open http://localhost:8080/web/
```

**Add an actor:** create `skills/explain-simulate-decide/engine/cast/<name>.js` exporting `build(ctx) → { object, height, setValue(v) }`, register it in `cast/index.js`, add a row to `references/cast-catalog.md`, and check it on `tests/cast-sheet.html`.

## Content principles

- More understanding, not more engagement.
- Plain words. Captions are 12 words or fewer.
- Every number sourced or labelled.
- The page explains and the person decides. No recommendations, no persuasion, no urgency.

## Licence

MIT. three.js, mp4-muxer and pdf.js are vendored under their own MIT/Apache licences (see `engine/vendor/README.md` and `web/vendor/pdfjs/LICENSE`). The demo uses public-domain text from the U.S. Department of Energy.
