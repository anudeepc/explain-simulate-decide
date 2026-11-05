# Explain, Simulate, Decide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `explain-simulate-decide` skill, its renderer, a solar demo, and a free GitHub Pages upload tool, per `docs/superpowers/specs/2026-11-05-explain-simulate-decide-design.md`.

**Architecture:** The AI writes a screenplay JSON; a fixed, deterministic three.js renderer ("director") turns it into a three-act page. Pure logic (formula, model, schema, timing) is separated from rendering so it is unit-testable in Node. A tiny import-graph inliner produces one offline HTML file in both Node (skill) and the browser (web tool).

**Tech Stack:** Plain ES modules + JSDoc, three.js 0.187 (vendored), mp4-muxer 5 (vendored), pdf.js 6 (vendored), Node 24 `node --test`, Playwright (dev only) for render checks.

---

## File map

```
skills/explain-simulate-decide/
  SKILL.md, references/*.md, scripts/validate.mjs, scripts/render.mjs
  engine/
    formula.js      parse/evaluate/refs/orderFormulas           (pure)
    model.js        createModel(model) → {defaults, run, ranges, meta} (pure)
    schema.js       validate(screenplay) → string[]             (pure)
    timing.js       shotDuration, buildTimeline, stateAt, easings (pure)
    layout.js       blocking marks for cast                      (pure)
    bundle.js       inline(entry, readFile) → {importMap, entryKey} (pure, isomorphic)
    export.js       toHtml(screenplay, files) → string           (isomorphic)
    stage.js        three.js scene, lights, floor, backdrop
    camera.js       shot type → camera pose over progress
    cast/kit.js     clay materials + shared geometry helpers
    cast/<actor>.js one studio actor per file → build(ctx) → Actor
    cast/index.js   studio registry
    cast/recipe.js  custom shape recipes → Actor
    cast/open.js    CC0 glTF loader → Actor (+ credit)
    cast/standin.js labelled block → Actor
    cast/resolve.js fallback chain
    flow.js         cause→effect light flow
    captions.js     lower-third captions (textContent)
    ui.js           simulate sliders, preset views, decide panel, controls
    score.js        procedural music bed on any BaseAudioContext
    voice.js        browser speech / ElevenLabs / OpenAI TTS
    record.js       deterministic frame stepping → WebCodecs → MP4
    player.js       createPlayer(el, screenplay, opts) — wires everything
    vendor/three/*, vendor/mp4-muxer.mjs
web/  index.html, app.js, providers.js, prompt.js, article.js, style.css, vendor/pdfjs/*
examples/solar/  screenplay.json, solar.html, solar.mp4, before.html
tests/  *.test.mjs, fixtures/*.json, render.spec.mjs
.claude-plugin/marketplace.json, README.md, LICENSE, package.json, .github/workflows/pages.yml
```

## Key interfaces (locked before parallel work)

```js
// formula.js
parse(src: string) → Ast            // throws FormulaError
evaluate(ast, scope: Record<string, number>) → number
refs(ast) → string[]
orderFormulas(defs: {id, formula}[], inputIds: string[]) → {id, ast}[]  // throws on unknown id / cycle

// model.js
createModel(model) → {
  ids: string[],                        // inputs, derived, outputs
  defaults(): Record<string, number>,   // input defaults
  run(inputs): Record<string, number|null>,  // non-finite → null
  ranges(): Record<string, [number, number]>, // inputs: min/max; others: sampled over input corners
  meta(id) → {label, unit, kind}
}

// timing.js
READ_WPS = 3.3, HOLD = 1.2, MIN_SHOT = 2.5, TURN_EXTRA = 1.5
shotDuration(shot) → seconds
buildTimeline(screenplay) → { segments: [{act, index, shot, start, end}], explainEnd, total }
   // segments: explain shots…, then 'simulate-demo' (8s), then 'decide' (7s)
stateAt(timeline, t) → { segment, local /*0..1*/, eased }
easeInOut(x), anticipate(x)

// Actor (every cast source returns this)
{ id, object: THREE.Object3D, height: number, setValue(v01: number), perform(name, v01) , credit?: string }

// cast/index.js
STUDIO: Record<actorName, (ctx) => Actor>   // ctx = {THREE, kit, label, color}

// player.js
createPlayer(el, screenplay, {voice, interactive=true}) → {
  duration, play(), pause(), seek(t), renderAt(t), setInputs(vals), record(opts) → Promise<Blob>, dispose()
}
window.ESD = { createPlayer }   // on exported pages; player auto-mounts
```

## Tasks

### Task 1: Scaffolding + vendoring
- [ ] `package.json` (type: module, scripts: `test`, `render:solar`, `check`), MIT `LICENSE`, `.gitignore` additions.
- [ ] Vendor `three/build/three.module.js`, `three.core.js`, `examples/jsm/geometries/RoundedBoxGeometry.js`, `examples/jsm/loaders/GLTFLoader.js` + its `utils/BufferGeometryUtils.js` into `engine/vendor/three/`, rewriting bare `three` imports to relative paths so files load without an import map.
- [ ] Vendor `mp4-muxer/build/mp4-muxer.mjs` → `engine/vendor/mp4-muxer.mjs`; pdf.js `pdf.min.mjs` + `pdf.worker.min.mjs` → `web/vendor/pdfjs/`.
- [ ] Commit.

### Task 2: formula.js (TDD)
Tests (`tests/formula.test.mjs`): precedence `2+3*4=14`; parentheses; unary minus; `min/max/round`; refs collected; unknown identifier throws; `panels * 400 * price` with scope; garbage like `constructor`, `a.b`, `x[0]`, `"s"`, `alert(1)` throw at parse; `orderFormulas` sorts dependencies and throws on cycle `a=b, b=a` and on unknown refs.
- [ ] Write failing tests → run (`node --test tests/formula.test.mjs`, expect FAIL) → implement recursive-descent parser (tokens: number, ident, `+ - * / ( ) ,`; only `min max round` callable) → PASS → commit.

### Task 3: model.js (TDD)
Tests: solar fixture defaults; run returns all ids; division by zero → `null`; ranges for inputs equal min/max; output range spans corner samples.
- [ ] Failing tests → implement → PASS → commit.

### Task 4: schema.js (TDD)
Tests with `tests/fixtures/solar.json` (valid → `[]`) and mutations, each producing a specific message: missing question; 1 lever; 5 levers; 0 conditions; 3 outputs; `default` out of range; `min >= max`; caption 13 words; zero/two `turn` shots; no `establish`; unknown `focus` id; unknown `controls` id; `custom` cast without recipe; recipe shape `pyramid`; bad formula; cycle; `source: "article"` with missing quote index; banned word "engagement" in any caption/decide text.
- [ ] Failing tests → implement → PASS → commit.

### Task 5: timing.js + layout.js (TDD)
Tests: 6-word caption → max(2.5, 6/3.3+1.2)=3.02; turn shot gets +1.5; timeline segments contiguous and end with simulate-demo (8s) and decide (7s); `stateAt` at boundaries; layout: focal actor on left third, others on back row, deterministic and non-overlapping for 1–8 actors.
- [ ] Failing tests → implement → PASS → commit.

### Task 6: bundle.js + export.js (TDD)
`inline(entryPath, readFile)` walks static `import … from './x'`, `export … from './x'`, `import './x'`, rewrites each relative specifier to a stable key `esd:/<path>`, returns `{modules: {key: source}, entryKey}`. `toHtml` builds an import map of `data:text/javascript;base64,…` URLs, embeds screenplay JSON as `<script type="application/json" id="esd-screenplay">`, strict CSP meta, and a module that mounts the player. Tests: graph with a cycle-free chain of 3 files is fully rewritten; no relative specifiers remain; HTML contains CSP and JSON escaped against `</script>`.
- [ ] Failing tests → implement → PASS → commit.

### Task 7: Stage, camera, kit, flow, captions
- [ ] `stage.js`: renderer (antialias, ACES tone mapping, sRGB, soft shadows), warm-neutral backdrop with gradient, floor disc, hemisphere + key + rim lights, light fog.
- [ ] `camera.js`: `poseFor(segment, layout, local)` → `{position, target}`; per spec table; speed capped via easing; reduced-motion → snap to end pose.
- [ ] `cast/kit.js`: `clay(color)` MeshStandardMaterial roughness 0.85; `rounded(w,h,d,r)`; palette.
- [ ] `flow.js`: instanced glowing beads along a curved path between two actors, progress-driven.
- [ ] `captions.js`: lower-third, fade by local progress, `textContent` only.

### Task 8: Studio cast (25 actors) + resolve
- [ ] Implement `sun, house, roof-panel, battery, power-bill, phone, coin-stack, clock, gauge, car, plug, thermometer, calendar, piggy-bank, shopping-bag, cloud, tree, water-drop, factory, person-figure, document, scale, arrow-flow, bar-stack, stand-in`, each `build(ctx) → Actor` with `setValue` visibly mapping 0–1 (fill level, height, glow, hand angle, count).
- [ ] `recipe.js`, `open.js` (GLTFLoader from URL or data URL; credit string), `standin.js` (rounded block + canvas-texture label), `resolve.js` (chosen → studio → custom → stand-in).
- [ ] Contact sheet page `tests/cast-sheet.html` renders all actors at v=0.2 and v=0.9 for visual review.

### Task 9: player.js + ui.js
- [ ] Wire: resolve cast, layout, actors bound to model values via `ranges()` normalisation; per frame `renderAt(t)` computes segment → camera pose, focal actor performs, flow on `cause`, captions; simulate-demo sweeps the first lever min→max→default while showing sliders; decide pulls back to wide and shows panel.
- [ ] Interactive mode: after explain, live sliders drive `setInputs`; three preset view buttons; output readouts with units; decide panel (trade-offs, left out, questions, sources with quotes, credits, assumption labels). Controls: play/pause, scrub, restart, Record MP4.
- [ ] Commit.

### Task 10: score.js, voice.js, record.js
- [ ] `score.js`: `scheduleScore(ctx, timeline, dest)` — soft pad (detuned triangles → lowpass), chord change per segment, swell on cuts, master −18 dB.
- [ ] `voice.js`: modes `off | browser | elevenlabs | openai`; browser speaks captions at segment start; API modes fetch per-caption audio, return AudioBuffers for live play and recording.
- [ ] `record.js`: pause live loop; for frame i at 60 fps call `renderAt(i/60)`, `new VideoFrame(canvas)`, encode H.264 (`avc1.640028`, fall back to VP9) 1920×1080; audio via `OfflineAudioContext` + `AudioEncoder` AAC; mux with mp4-muxer; return Blob.
- [ ] Commit.

### Task 11: scripts + solar demo
- [ ] `scripts/validate.mjs <file>` → prints errors, exit 1/0. `scripts/render.mjs <file> [-o out.html]` → validates, inlines, writes HTML.
- [ ] Write `examples/solar/screenplay.json` from the DOE *Homeowner's Guide to Going Solar* (quotes saved; other numbers labelled assumptions). Render `solar.html`. Write `before.html` (report + quote form).
- [ ] Playwright check (`tests/render.spec.mjs`): load solar.html, no console errors, screenshots at 3 timestamps identical across 2 loads. Record `solar.mp4` via Playwright using real Chrome channel calling `ESD.record()`.

### Task 12: Skill docs
- [ ] `SKILL.md` (frontmatter name/description; when to use; 6 steps; validate → render → self-review checklist; cast/voice options) and `references/` five files. `.claude-plugin/marketplace.json` + `plugin.json`.

### Task 13: Web tool
- [ ] `article.js` (PDF via pdf.js, txt/md, paste, URL best-effort, 60k trim), `providers.js` (Anthropic direct-browser, OpenAI-compatible w/ base URL incl. OpenRouter/Groq/Ollama presets, mock), `prompt.js` (fetch SKILL.md + references → system prompt; article wrapped as data; extract JSON), `app.js` (4 steps, up to 2 repair attempts, preview with player, Download HTML via `toHtml` in browser, Record MP4, Download screenplay, Edit screenplay JSON), landing before/after section.
- [ ] Test with mock provider in Playwright: upload text → preview plays → download HTML non-empty.

### Task 14: README, Pages workflow, skill evals, publish gate
- [ ] README (thesis, GIF, quick start for skill / web tool, how it works, screenplay format link, contributing an actor). `.github/workflows/pages.yml`.
- [ ] Run the skill flow on heat-pump and news articles; screenplays pass validate.
- [ ] Ask user to confirm repo name/visibility before `gh repo create`.
