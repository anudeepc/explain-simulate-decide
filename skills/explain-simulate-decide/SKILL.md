---
name: explain-simulate-decide
description: Turn an article, report or PDF into a short directed 3D explainer page in three acts. Explain walks through how the topic works, one idea per shot. Simulate hands the viewer the cause-and-effect model to operate. Decide steps back and leaves the choice to the person. Use when someone wants to explain, simplify or "make interactive" an article, policy, report, financial or health decision, or asks for a "visual explainer", "interactive explainer", "simulation of this article", "run the model instead of reading the report", or a short explainer video of a document. Output is one offline HTML file that can also record itself to MP4.
---

# Explain, Simulate, Decide

You read the article and write a **screenplay**: a small JSON file. A fixed renderer directs the film from it, handling staging, camera, timing and motion. Never write HTML, CSS or three.js yourself. Your job is judgement: find the decision, build an honest model, and write plain words.

## Steps

1. **Get the text.** Use the URL, PDF or pasted text the user gave you. Read the whole article before writing anything.
2. **Extract the story** in six steps (details and examples are in `references/extraction-guide.md`):
   1. **Decision**: the one question a reader actually faces, written as "Should I…?" or "What happens if…?". If the article has no decision, write "What would change if…?".
   2. **Levers**: 2–4 inputs the person controls.
   3. **Conditions**: 1–3 inputs the person does not control.
   4. **Outcomes**: 1–2 results the person cares about.
   5. **Turning point**: the most common misconception. It becomes the `turn` shot.
   6. **Limits**: what the model leaves out. They go in `decide.leftOut`.
3. **Write the model.** Inputs, named constants, derived values and outputs, with formulas. Every number is either quoted from the article (`"source": "article"`, `"quote": <index>`) or labelled `"source": "assumption"`. Never invent a number and present it as fact. Full format: `references/screenplay-format.md`.
4. **Cast the actors.** Each actor plays one model value. Pick everyday objects from `references/cast-catalog.md`. For anything the catalog doesn't cover, use the stand-in (a labelled block) or a `custom` recipe.
5. **Write the shots.** Write 6–10 `explain` shots, one idea per shot, with captions of 12 words or fewer. Use exactly one `turn`, start with `establish`, and end with `handoff`. When to use each shot type is in `references/shot-types.md`. Follow `references/writing-rules.md`.
6. **Write Decide.** Trade-offs, what the model leaves out, and questions to ask. **Never recommend an option.**
7. **Validate.** Fix every error and run it again until it says OK:
   ```bash
   node scripts/validate.mjs screenplay.json
   ```
8. **Render** a single offline HTML file:
   ```bash
   node scripts/render.mjs screenplay.json -o explainer.html [--cast auto|studio|open|custom] [--voice off|browser]
   ```
9. **Check your work** before handing it over:
   - [ ] Every number in the model has a quote or is labelled an assumption
   - [ ] Every formula is correct and in sensible units. Check that the default values give a believable answer
   - [ ] The `turn` shot corrects a misconception the article actually raises
   - [ ] Captions are 12 words or fewer, in plain words, with each term explained in its own shot before later shots use it
   - [ ] Decide gives no recommendation, and leftOut names the model's real limits
   - [ ] None of the words listed in `writing-rules.md`
10. **Hand over.** Tell the user the file path. They can open it in a browser and press **Record MP4** for a 1080p 60 fps video. Also mention which numbers are assumptions they may want to change.

Run the scripts from this skill's folder, or use absolute paths. They need Node 18 or later and no packages.

## Options the user may ask for

- **Cast** (`--cast`):
  - `auto` (default): each actor uses the source written in the screenplay.
  - `studio`: the built-in clay cast.
  - `open`: free CC0 models. Needs `url` and `credit` on each actor.
  - `custom`: the AI's shape recipes.

  Any actor that can't be built falls back in this order: studio, then custom, then stand-in.
- **Voice** (`--voice`): `off` (captions and music only, the default) or `browser` (the computer's built-in speech). Recorded narration with ElevenLabs or OpenAI voices comes from the web tool, using the user's own key.

## Don'ts

- Don't add features to the page or edit the generated HTML. Change the screenplay and render again.
- Don't stretch a model to cover everything. If an idea needs more than 4 levers, the article holds two decisions: pick the main one.
- Don't use persuasive framing. The page builds understanding and the person decides.
