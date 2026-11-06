---
name: explain-simulate-decide
description: Turn an article, report or PDF on any topic (money, energy, health, climate, policy, science, how something works) into a short directed 3D explainer in three acts. Explain shows how the topic works as a small living world (things connected by flows of energy, money, water, time, carbon, causes…). Simulate asks the viewer about their own situation and lets them run the model. Decide steps back, compares the options with their numbers, and leaves the choice to them. Use when someone wants to explain, simplify or "make interactive" an article, policy, report, financial or health decision, or asks for a "visual explainer", "interactive explainer", "simulation of this article", "run the model instead of reading the report", or a short explainer video of a document. Output is one offline HTML file that can also record itself to MP4.
---

# Explain, Simulate, Decide

You read the article and write a **screenplay**: a small JSON file. A fixed renderer builds the world and directs the film from it, handling staging, camera, timing and motion. Never write HTML, CSS or three.js yourself. Your job is judgement: understand the person's situation, find the decision, choose the story's shape, map the system honestly, and write plain words.

This skill is used on every kind of article, so nothing in it assumes a topic. The worked examples are about solar power because one example has to be about something. For another topic, copy their structure, not their content. `references/story-shapes.md` has examples from health, money, climate, policy and more.

## Steps

1. **Get the text.** Use the URL, PDF or pasted text. Read the whole article before writing anything.

2. **Understand the person** (when you can talk to them). If the person asking is also the one deciding, ask up to three short questions before you write anything. Ask only what changes the answer and what the article can't tell you:
   - Where they live, because it sets local prices, costs and rules.
   - A number they can read off a bill, statement or app, such as a monthly bill, a card balance, or hours slept last week.
   - Which options they are weighing. For example: "Store spare power in a battery, or send it to the grid?", "Pay the minimum, or a fixed amount?", "Screen every year, or every two?"

   Say why you are asking, and accept "don't know". Their answers become the defaults. The page will still ask any viewer the same questions (step 8). Skip this step in the web tool or when no one is there to answer.

3. **Check local and current numbers.** When the answer depends on place, price or the latest research (costs, prices, interest rates, incentives, risk figures), use web search to find current figures for the person's area. Otherwise find a few typical regions.
   - Prefer government statistics and well-known trackers.
   - Quote only pages you actually opened. Copy the sentence word for word; for a table, copy the row values as shown and add "(table)" to the publisher.
   - Store each one as `{"text", "url", "publisher", "accessed"}` in `source.quotes`, where `accessed` is the date you read it (YYYY-MM-DD).
   - A number you can't find a source for is an `assumption`. Never guess and present the guess as fact.
   - Ask before searching if the user hasn't allowed web access.

4. **Extract the story.** Work through `references/extraction-guide.md`:
   1. **Decision.** Write it as "Should I…?" or "What happens if…?".
   2. **Options.** The 2–3 real alternatives (for example solar alone, or solar with a battery). They go in `decide.compare`.
   3. **Levers.** 2–4 inputs the person controls.
   4. **Conditions.** 1–5 inputs the person doesn't control.
   5. **Outcomes.** 1–2 results the person cares about, plus up to 2 **milestones** in time ("paid back in", "debt cleared in").
   6. **Turning point.** The common misconception, which becomes the one `turn` shot.
   7. **Limits.** What the model leaves out.
   8. **Checkable claims.** Figures and directions the article states about results ("pays back in 6 to 12 years", "each extra hour of screens costs about 20 minutes of sleep"). They become `checks`.

   For a story with no numbers a reader could change, skip levers, conditions, outcomes and checkable claims (see step 5).

5. **Choose the story shape.** Read `references/story-shapes.md` and pick one shape: `build-up`, `feedback`, `budget`, `conversion`, `cause`, `chances` or `process`. The shape decides the world:
   - things piling up get a store;
   - a fixed amount shared gets one node splitting into parts;
   - an effect with nothing moving gets `influence` links;
   - a risk gets a crowd of 100 people;
   - steps with no numbers get a `process`, with **no model at all**.

   Never invent numbers to force an article into a model. If the article has no figures a reader could change, the shape is `process`.

6. **Map the system.** Write down the characters and what moves between them: where things come from, where they go, and where they pile up. `references/system-guide.md` shows how. Give each character a `prop` from `references/prop-catalog.md`, or a `kind` (person, crowd, body, building, institution, land, medicine…) and the renderer picks a fitting look. This map is the film: every flow becomes a visible stream whose size is its rate.

7. **Write the model** (every shape except `process`).
   - Inputs, named constants, derived values and outputs, each with a formula.
   - **Every value has a `unit`**, such as `"$/yr"`, `"kWh"`, `"h/night"`, `"%"`, `"people"` or `""` for a plain ratio. The validator checks that every formula comes out in its unit, so a missing × 365 or ÷ 100 is caught. See "Units" in `references/story-shapes.md`.
   - **Stores** for anything that builds up or runs down over time, such as savings, a loan balance, water in a tank or sleep debt, plus their **milestones**.
   - Every number is either quoted (`"source": "article"`, `"quote": <index>`, with a `note` if you worked it out from the quote) or labelled `"source": "assumption"`. An assumption you tuned so the model matches the source says so with `"fits"`. See "Honest numbers" in `references/story-shapes.md`.
   - **Checks.** Write down what the source says the answer looks like: at least one `between` (a figure it gives, with its quote) and one `rises` or `falls` (which way a result moves). Add `same` checks for balances. The validator runs the model against them. If one fails, fix the model, not the check.
   - Full format: `references/screenplay-format.md`.

8. **Build the world.**
   - **Nodes** use a `prop` from `references/prop-catalog.md` or a `kind`. Panels can sit `on` a house. The sun sits in the `sky`. A store shows its level: a jar of coins only for money, a tank for anything else.
   - An option that isn't always there, such as a battery, gets `appears`: it grows into the world when its input is above its minimum.
   - **Flows** go between nodes. Each has a carrier and a `rate` formula with a `unit`. The carriers are `energy`, `money`, `water`, `heat`, `light`, `goods`, `people`, `data`, `time`, `carbon`, `substance`, and `influence` for a cause that pushes on an effect.
   - Flows of the same carrier and unit share one scale, so a trickle beside a stream shows the difference without words.

9. **Write the questions the page asks** (`ask`, usually 2–5). Ask for the facts that make the answer theirs:
   - A number they can find on a bill, statement, app or their own count (hours slept, trips a week), with a hint about where to look.
   - Choices for things people know as a category: their state, their habits, which option they lean toward.

   Each answer sets one or more inputs. Every choices question needs one option that sets exactly the defaults ("Not sure", "About average", "Somewhere else"). Leave `ask` out only when no viewer's answer would change the result, and always for a `process` story.

10. **Write the shots.** Write 6–12 `explain` shots, one idea per shot, with captions of 12 words or fewer.
   - Follow the system in the order it works: source, flow, store, or first step to last.
   - Use at least one `follow` or `cause`, exactly one `turn` (at most one in a `process`), and a `timelapse` on any store.
   - Start with `establish` and end with `handoff`.
   - See `references/shot-types.md` and `references/writing-rules.md`.

11. **Write Decide.**
    - `compare` the options using the viewer's own numbers (not in a `process` story, which has none).
    - List the trade-offs, what the model leaves out, and questions to ask.
    - **Never recommend an option.**

12. **Validate.** The validator checks the structure, every unit, your checks against the source, and every extreme of the inputs. Fix every error and run it again until it says OK:
    ```bash
    node scripts/validate.mjs screenplay.json
    ```

13. **Render** a single offline HTML file:
    ```bash
    node scripts/render.mjs screenplay.json -o explainer.html [--cast auto|studio|open|custom] [--voice off|browser]
    ```

14. **Check your work** before handing it over:
    - [ ] The shape fits the article, and no number was invented to make a model. With no numbers to change, the shape is `process`.
    - [ ] Every number has a quote or is labelled an assumption. Researched figures carry their URL and the date you read them.
    - [ ] You opened every URL you quote, and each quote matches the page word for word.
    - [ ] The checks hold the source's own figures, and no check was loosened to make the model pass.
    - [ ] Every character is something a viewer would recognise with the sound off, and a jar of coins only ever holds money.
    - [ ] The `turn` corrects a misconception the article actually raises, and the world makes it visible (two streams side by side, a jar that never fills).
    - [ ] The `ask` questions are ones a person can answer in under a minute, and each choices question has an option for "don't know".
    - [ ] Captions are 12 words or fewer, in plain words, and each term is explained before it is used.
    - [ ] Decide gives no recommendation, and `leftOut` names the model's real limits.
    - [ ] None of the words listed under "Words we don't use" in `references/writing-rules.md`.

15. **Hand over.**
    - Give the user the file path. They can open it in a browser and press **Record MP4** for a 1080p 60 fps video.
    - Say which numbers are assumptions, and which researched figures they should check again before relying on them.

Run the scripts from this skill's folder, or use absolute paths. They need Node 18 or later and no packages.

## Options the user may ask for

- **Cast** (`--cast`): `auto` uses what the screenplay says. The other modes are `studio` (built-in clay props), `open` (free CC0 models, each needing a `url` and `credit`) and `custom` (shape recipes). Anything that can't be built falls back to studio, then custom, then a labelled stand-in.
- **Voice** (`--voice`): `off` (captions and music only, the default) or `browser` (the computer's built-in speech). Recorded narration with ElevenLabs or OpenAI voices comes from the web tool, using the user's own key.

## Don'ts

- Don't add features to the page or edit the generated HTML. Change the screenplay and render again.
- Don't stretch a model to cover everything. If an idea needs more than 4 levers, the article holds two decisions: pick the main one.
- Don't draw a flow you can't put a rate on. If you can't write the formula, the flow isn't in the model (a `process` story is the exception: its flows are steps, with no rates).
- Don't invent numbers to make an article fit a model. Choose the shape the article actually has.
- Don't use persuasive framing. The page builds understanding and the person decides.
