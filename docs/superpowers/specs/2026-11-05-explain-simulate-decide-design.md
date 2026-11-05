# Explain, Simulate, Decide — Design Spec

Date: 2026-11-05
Status: Approved design, pending spec review

## 1. Purpose

Build a reusable, public skill (`explain-simulate-decide`) that turns any article into a short, directed 3D explainer with three acts:

1. **Explain** — a directed film walks through how the topic works, one idea per shot.
2. **Simulate** — the same actors on the same stage respond to the viewer's sliders, so they can see cause and effect.
3. **Decide** — the camera steps back; the page shows trade-offs, what the model leaves out, and questions to ask. The person decides. The page never recommends.

Deliverables:

- The skill, published in a public GitHub repo (MIT).
- A free, open-source web tool on GitHub Pages where anyone uploads an article and gets the explainer (bring your own AI key).
- A demonstration: "Should I put solar on my roof?" as an offline HTML page and a ~90 s 60 fps MP4, plus a before/after landing section showing the thesis "Don't read the report. Run the model."

Content rules: no references to the author's employer or to credit products; never use the word "gamified"; say "more understanding", not "more engagement".

## 2. Core architecture decision

**The AI writes only a screenplay (JSON). A fixed renderer turns any valid screenplay into the film.**

- All film craft (staging, camera, timing, easing) lives in renderer code, so output quality is consistent.
- Smaller and free models can fill in a structured screenplay.
- No AI-written code is ever executed.
- The Claude Code skill and the web tool share one screenplay format and one renderer.

Technical approach: no build step. Plain ES modules with JSDoc types, a vendored copy of three.js, Node's built-in test runner. Export inlines everything into one offline HTML file.

## 3. Extraction method (the skill's "script development")

The skill reads the article in six steps:

1. **Decision** — one real question a reader faces ("Should I…?" / "What happens if…?"). If the article contains no decision, frame it as "What would change if…?".
2. **Levers** — 2–4 inputs the person controls.
3. **Conditions** — 1–3 inputs the person does not control.
4. **Outcomes** — 1–2 results the person cares about.
5. **Turning point** — the most common misconception; it becomes the `turn` shot in Act 1.
6. **Limits** — what the model leaves out; shown in Act 3.

Rules:

- Every number has `source: "article"` (with a saved quote) or `source: "assumption"` (labelled as an assumption on screen). No invented numbers presented as fact.
- Captions are 12 words or fewer. A term is defined in its own shot before any later shot uses it.
- Act 3 never recommends an option.
- Banned words in output: "gamified", "engagement".

## 4. Screenplay format (v1)

```json
{
  "version": 1,
  "question": "Should I put solar on my roof?",
  "source": { "title": "...", "url": "...", "quotes": ["..."] },
  "model": {
    "inputs": [
      { "id": "panels", "label": "Panels", "unit": "panels", "kind": "lever",
        "min": 0, "max": 20, "default": 10, "source": "assumption" },
      { "id": "price", "label": "Power price", "unit": "$/kWh", "kind": "condition",
        "min": 0.15, "max": 0.45, "default": 0.30, "source": "article", "quote": 0 }
    ],
    "derived": [{ "id": "saving", "formula": "panels * 400 * price" }],
    "outputs": [{ "id": "payback", "label": "Years to pay back", "unit": "years",
                  "formula": "panels * 900 / saving" }]
  },
  "cast": [
    { "id": "sun",  "plays": "sunHours", "actor": "sun",        "source": "studio" },
    { "id": "bill", "plays": "price",    "actor": "power-bill", "source": "studio" },
    { "id": "x",    "plays": "saving",   "source": "custom",
      "recipe": [{ "shape": "cylinder", "size": [1, 0.2, 1], "color": "#d9a441" }] }
  ],
  "explain": [
    { "shot": "establish", "focus": "house", "caption": "This is your roof and your power bill." },
    { "shot": "cause", "focus": "sun", "affects": "saving", "caption": "More sun means more power you don't buy." },
    { "shot": "turn", "focus": "bill", "caption": "But the price you sell power for is lower." }
  ],
  "simulate": { "controls": ["panels", "price"], "prompt": "Try your own roof." },
  "decide": { "tradeoffs": ["..."], "leftOut": ["..."], "questionsToAsk": ["..."] }
}
```

Constraints enforced by the schema check:

- `inputs`: 2–4 with `kind: "lever"`, 1–3 with `kind: "condition"`; `min < max` and `min ≤ default ≤ max`.
- `outputs`: 1–2.
- `formula`: arithmetic only — numbers, `+ - * /`, parentheses, `min`, `max`, `round`, and ids of inputs/derived values. Evaluated by our own parser (never `eval`/`Function`). Circular references are rejected.
- `shot`: one of `establish`, `introduce`, `focus`, `cause`, `compare`, `turn`, `handoff`. Exactly one `turn` and at least one `establish`.
- `caption`: ≤ 12 words.
- `cast[].source`: `studio` | `open` | `custom`. `custom` requires `recipe`; recipe shapes limited to `box`, `sphere`, `cylinder`, `cone`, `torus`.
- Every `focus`/`affects`/`plays`/`controls` id must exist.

## 5. Renderer ("the director")

Location: `skills/explain-simulate-decide/engine/` (the only copy).

| File | One job |
|---|---|
| `schema.js` | Validate a screenplay → list of readable errors |
| `formula.js` | Tokenize, parse, evaluate arithmetic; dependency order; cycle detection |
| `model.js` | inputs → all derived values and outputs (pure) |
| `cast/*.js` | One studio actor per file: builds its 3D object and performances (`fill`, `grow`, `glow`, `tick`, `pulse`), each driven by 0–1 |
| `cast/resolve.js` | Fallback order: chosen source → studio → custom → stand-in (rounded block + icon + label) |
| `cast/open.js` | Loads CC0 glTF models (Kenney, Poly Pizza); records credits |
| `cast/recipe.js` | Builds custom actors from shape recipes |
| `stage.js` | Set (floor, backdrop, soft three-point light, light haze) and blocking (focal actor on a third, supporting actors on back marks) |
| `director.js` | Shot type → camera move, framing, duration |
| `timeline.js` | Fixed clock: time → exact scene state (deterministic) |
| `captions.js` | Lower-third captions, plain text only |
| `voice.js` | Off / browser speech / ElevenLabs or OpenAI with user key |
| `score.js` | Procedural Web Audio music bed, soft swells on cuts |
| `simulate.js` | Act 2 sliders; actors respond live; three preset camera views; no free orbit |
| `decide.js` | Act 3 panel: trade-offs, left out, questions, sources with quotes, credits |
| `record.js` | Fixed-step frame capture → WebCodecs → MP4 (vendored MIT muxer), 60 fps, includes audio |
| `export.js` | Inline engine + screenplay + assets into one offline HTML with a strict CSP |

Studio cast (initial ~25 actors, matte "clay" style): sun, house, roof-panel, battery, power-bill, phone, coin-stack, clock, gauge, car, plug, thermometer, calendar, piggy-bank, shopping-bag, cloud, tree, water-drop, factory, person-figure, document, scale, arrow-flow, bar-stack, stand-in.

Directing rules:

| Shot | Camera | Action |
|---|---|---|
| `establish` | Wide, slow push-in | Whole set; question appears |
| `introduce` | Dolly to actor, ¾ angle | Small anticipation, then performance |
| `focus` | Close-up hold | Actor performs its value |
| `cause` | Two-shot | Light flow travels cause → effect |
| `compare` | Side-by-side frame | Two states of one actor |
| `turn` | Hold, then slow reveal | Misconception corrected; longest shot |
| `handoff` | Settle to simulation view | Sliders fade in |

- One thing moves at a time; nothing moves unless it explains.
- Camera speed cap; one shared easing set.
- Shot duration = caption reading time (≈ 3.3 words/s) + hold (1.2 s), min 2.5 s; `turn` gets +1.5 s.
- `prefers-reduced-motion`: camera moves become cuts.
- Act 3: camera returns to the opening wide shot.

## 6. Skill folder

```
skills/explain-simulate-decide/
├── SKILL.md               (~150 lines) when to use, 6 steps, validate → render → self-review
├── references/
│   ├── extraction-guide.md    finding decision/levers/turning point, good vs bad examples
│   ├── screenplay-format.md   every field + schema
│   ├── shot-types.md          purpose of each shot and when to use it
│   ├── writing-rules.md       plain words, 12-word captions, banned words, no recommending
│   └── cast-catalog.md        studio actors and performances
├── scripts/
│   ├── validate.mjs       screenplay → errors or OK (exit code 0/1)
│   └── render.mjs         screenplay → one offline HTML file
└── engine/
```

Principles: model does judgement, scripts do mechanics; short SKILL.md with references loaded on demand; no dependency on other skills; follows the open Agent Skills format; output is one offline file.

Skill flow: user gives URL / PDF / text → Claude extracts and writes `screenplay.json` → `validate.mjs` (fix until OK) → `render.mjs` → self-review checklist (every number sourced, Act 3 neutral, captions ≤ 12 words, turning point present) → user opens the page; one button records MP4.

Install: `/plugin marketplace add <owner>/explain-simulate-decide`, or copy the folder to `~/.claude/skills/`.

## 7. Web tool (GitHub Pages)

Location: `web/`, imports the engine from `../skills/explain-simulate-decide/engine/`.

Steps:

1. **Article** — drop PDF (pdf.js, vendored), paste text, drop `.txt`/`.md`, or URL (best effort; on CORS failure, ask to paste text). Articles over ~60,000 characters are trimmed, with a notice.
2. **Provider** — Anthropic (direct browser access), OpenAI-compatible (OpenAI, OpenRouter, Groq; custom base URL), or local Ollama. Key kept in `sessionStorage`; "remember on this device" (localStorage) is opt-in.
3. **Settings** — Cast: studio / open / custom. Voice: off / browser / ElevenLabs / OpenAI.
4. **Generate** — system prompt built at runtime from `SKILL.md` + `references/*.md`. Response must be screenplay JSON. On validation failure, errors are sent back for up to 2 repair attempts, then shown to the user. Preview plays in-page. Buttons: Download HTML, Record MP4, Download screenplay. Advanced: edit screenplay JSON and re-render.

Safety and privacy:

- No server; article and key go only to the chosen provider.
- Article is wrapped as data in the prompt; non-JSON replies are rejected.
- Captions and labels rendered with `textContent`; formulas via the safe parser; exported pages carry a strict CSP (no external scripts or connections).
- Open-library credits and article quotes are written into every export.

Hosting: GitHub Action publishes the Pages site on push to `main`.

## 8. Demonstration

- Topic: "Should I put solar on my roof?"
- Source: U.S. Department of Energy, *Homeowner's Guide to Going Solar* (public domain). Numbers from the guide carry quotes; others are labelled assumptions.
- `examples/solar/`: `screenplay.json`, `solar.html`, `solar.mp4` (~90 s, 60 fps).
- Landing page before/after: the same information as a report + quote form vs the directed explainer.

## 9. Testing

- **Unit** (`node --test`, no dependencies): formula parser (precedence, refs, cycles, unknown ids, no code execution), schema (good/bad fixtures), model maths, director timing, cast fallback.
- **Render** (Playwright, dev dependency only): solar page renders; screenshots at fixed timestamps are stable across runs; no console errors.
- **Skill** — run on three articles: solar; a second decision piece (heat pump vs gas); a news piece without an obvious decision. Each screenplay passes `validate.mjs` and the self-review checklist.
- **Web tool** — automated with a mock provider returning a fixture screenplay; one live run by the user with their own key.

## 10. Done criteria

1. Public GitHub repo with MIT licence, README, demo GIF, passing tests.
2. Skill installs via plugin marketplace and by folder copy; produces valid pages for all three test articles.
3. GitHub Pages tool live and working end to end (mock + one real provider run).
4. Solar demo HTML and MP4 in `examples/` and linked from the landing page.

## 11. Out of scope

LinkedIn article and narration script, Word (.docx) input, user accounts, any server or hosted AI, free camera orbit.

## 12. Publishing gate

Before the repo is made public: check GitHub login with `gh auth status` and confirm the repo name and owner with the user.

## 13. Implementation notes (changes made while building)

- **Named constants.** Formulas may only contain plain conversion numbers. Every other number must be a `constants` entry with a label and source, so the "every number sourced" rule is checked by the validator.
- **`drive` field (optional) on shots.** It chooses which input sweeps during a shot.
- **`plays` is optional** on cast entries; actors without it are scenery.
- **Calmer pacing.** 2.6 words/s plus a 1.6 s hold, with a 3.5 s minimum per shot. The recorded Simulate segment is 12 s and Decide is 10 s. The solar film runs about 72 s.
- **Layout.** Actors stand on a shallow arc (an amphitheatre), not in rows, so no actor hides another. The camera fits each shot by framing (fit these actors, from this angle), not by fixed offsets.
- **Captions, labels and painted panels are drawn on a 2D canvas** over the 3D stage, so the live page and the MP4 show identical pixels. The live sliders and Decide panel are accessible DOM controls.
- **Recording** uses H.264 at 8 Mbps plus AAC. Headless Chromium's shell crashes on long recordings, so `tests/record-mp4.mjs` uses installed Chrome (`--channel chrome`). MP4s are kept out of git and published as release assets.
- **The "before" view** on the landing page is an inline panel, not a separate `before.html`.
- **Second test article.** The heat-pump example uses a synthetic test article (`tests/fixtures/heat-pump-article.md`), because the Department of Energy heat-pump pages returned 404. The news-article test is not done yet.
