---
name: explain-simulate-decide
description: Turn an article, report or PDF on any topic into a short, directed 3D explainer film in three acts. Topics include money, energy, health, climate, policy, science and how something works. Explain shows how the topic works as a small, living world. In this world, flows of energy, money, water, time, carbon or causes connect things. Simulate asks the viewer about their own situation. Then the viewer runs the model. Decide compares the options with their numbers. It leaves the choice to the viewer. Use this skill when someone wants to explain, simplify or "make interactive" a document. The document can be an article, a policy, a report, a money decision or a health decision. Also use it when someone asks for a "visual explainer", "interactive explainer", "simulation of this article", or "run the model instead of reading the report". Also use it for a short explainer video of a document. The output is one offline HTML file. The file can also record itself to MP4.
---

# Explain, Simulate, Decide

You read the article and write a **screenplay**: a small JSON file. A fixed renderer uses the screenplay to build the world and direct the film. The renderer does the staging, the camera, the timing and the motion. Never write HTML, CSS or three.js yourself. Your job is judgement:

- Understand the situation of the user.
- Find the decision.
- Choose the shape of the story.
- Map the system honestly.
- Write plain words.

**The best part is no part.** The film must have the fewest characters, flows, numbers and shots that still answer the question. Each part costs the viewer attention. Before you add a part, ask what the viewer loses without it. If the answer is "nothing", do not add the part. The validator rejects parts that do nothing.

This skill is for every kind of article. Nothing in it assumes a topic. The worked examples are about solar power because one example must have a topic. For a different topic, copy their structure, not their content. `references/story-shapes.md` has examples from health, money, climate, policy and more.

## Steps

1. **Get the text.** Use the URL, the PDF or the pasted text. Read all of the article before you write anything.

2. **Understand the person** (if you can talk to the user). If the user is also the person who makes the decision, ask up to three short questions. Ask them before you write anything. Ask only for facts that change the answer and that the article cannot give:
   - Where the user lives. This sets local prices, costs and rules.
   - A number that the user can read on a bill, a statement or an app. Examples: a monthly bill, a card balance or the hours they slept last week.
   - The options that the user compares. Examples:
     - "Store spare power in a battery, or send it to the grid?"
     - "Pay the minimum, or a fixed amount?"
     - "Screen every year, or every two?"

   Tell the user why you ask. Accept "don't know" as an answer. Their answers become the defaults. The page still asks each viewer the same questions (step 9). Skip this step in the web tool. Also skip it when no one can answer.

3. **Research what the article leaves out.** If the user has not allowed web access, ask before you search. Look for two things:
   - **What really happens.** Some topics are things that a person goes through: a test, a treatment, a claim, an application or an installation. For these topics, find the real steps in an authoritative source. Find what the person does, what happens next, how long it takes and what each result means. Articles often do not give these steps. But the film must show them. Keep the full list of steps, in order. Each step becomes a beat in a scene (see "Show every step" in `references/storytelling.md`).
   - **Local and current numbers.** Sometimes the answer depends on the place, the price or the latest research. Examples are costs, prices, interest rates, incentives and risk figures. Then find current figures for the area of the user, or for some typical regions.

   How to use what you find:
   - Use official health, government and statistics sources first. Well-known trackers are also good sources.
   - Quote only pages that you opened. Copy the sentence word for word.
   - For a table, copy the row values as the page shows them. Add "(table)" to the publisher.
   - Put each quote in `source.quotes` as `{"text", "url", "publisher", "accessed"}`. The value of `accessed` is the date that you read the page (YYYY-MM-DD).
   - If you cannot find a source for a number, the number is an `assumption`. Never guess a number and show the guess as a fact.
   - Make sure that each figure is about the thing as it is today. The best-known numbers often come from an older version: an older test, a past tax rate or last year's prices. Use current figures when you can. If only older figures exist, say so in `leftOut`.

4. **Extract the story.** Follow `references/extraction-guide.md`:
   1. **Decision.** Write it as "Should I…?" or "What happens if…?".
   2. **Options.** Find the 2–3 real options. Example: solar alone, or solar with a battery. The options go in `decide.compare`.
   3. **Levers.** Find 1–4 inputs that the viewer really controls. Do not invent a choice to fill a slot. If the decision is "take part or not", that is one lever.
   4. **Conditions.** Find 1–5 inputs that the viewer does not control.
   5. **Outcomes.** Find 1–2 results that the viewer cares about. Also find up to 2 **milestones** in time ("paid back in", "debt cleared in").
   6. **The turning point.** Find the common misconception. It becomes the one `turn` shot.
   7. **Limits.** Find what the model leaves out.
   8. **Checkable claims.** Find the figures and directions that the article gives for the results. They become `checks`. Examples: "pays back in 6 to 12 years", "each extra hour of screens costs about 20 minutes of sleep".

   For a story with no numbers that a viewer could change, skip levers, conditions, outcomes and checkable claims (see step 5).

5. **Find the story.** Read `references/storytelling.md`. Before you map anything, decide who the film follows and what they discover:
   - the hero (a person or a home that the viewer stands in for)
   - what the hero wants
   - what the hero does not know yet
   - the discovery
   - how the story ends.

   Write a logline of 35 words or fewer, in short sentences. The film opens on the hero, goes out into the world and comes back to the hero. Choose the `tone` that suits the topic. The film has a white set. The tone sets its one accent colour.

   Then **choose the story shape.** Read `references/story-shapes.md`. Choose one shape: `build-up`, `feedback`, `budget`, `conversion`, `cause`, `chances` or `process`. The shape decides the world:
   - Things that pile up get a store.
   - If people share a fixed amount, one node splits into parts.
   - An effect with nothing that moves gets `influence` links.
   - A risk gets a crowd of 100 people.
   - Steps with no numbers get a `process`, with **no model at all**.

   Never invent numbers to force an article into a model. If the article has no figures that a viewer could change, the shape is `process`.

6. **Map the system.** Write down the characters and what moves between them. Find where things come from, where they go and where they pile up. `references/system-guide.md` shows how. Give each character a `prop` from `references/prop-catalog.md`. Or give it a `kind` (person, crowd, body, building, institution, land…). Then the renderer chooses a look that fits. This map is the film. Each flow becomes a visible stream. The size of the stream shows its rate.

7. **Write the model** (for every shape except `process`).
   - Write the inputs, named constants, derived values and outputs. Give each one a formula.
   - **Each value has a `unit`**, for example `"$/yr"`, `"kWh"`, `"h/night"`, `"%"`, `"people"` or `""` for a plain ratio. The validator checks that each formula gives its unit. Thus it finds a missing × 365 or ÷ 100. See "Units" in `references/story-shapes.md`.
   - Add a **store** for each amount that builds up or runs down over time. Examples: savings, a loan balance, water in a tank or sleep debt. Add the **milestones** of each store.
   - Each number has a source. A number from the article has `"source": "article"` with `"quote": <index>`. If you calculated the number from the quote, add a `note`. Any other number has `"source": "assumption"`. If you tuned an assumption to make the model agree with the source, add `"fits"`. See "Honest numbers" in `references/story-shapes.md`.
   - **Checks.** Write down what the source says about the answer. Write at least one `between` check: a figure that the source gives, with its quote. Write at least one `rises` or `falls` check: the direction that a result moves. Add `same` checks for balances. The validator runs the model against the checks. If a check fails, fix the model, not the check.
   - For the full format, see `references/screenplay-format.md`.

8. **Build the world.**
   - **Nodes** use a `prop` from `references/prop-catalog.md` or a `kind`. Panels can sit `on` a house. The sun sits in the `sky`. A store shows its level. Use a jar of coins only for money. Use a tank for all other amounts.
   - An option that is not always there, such as a battery, gets `appears`. It grows into the world when its input is above its minimum.
   - **Flows** go between nodes. Each flow has a carrier and a `rate` formula with a `unit`.
   - The carriers are `energy`, `money`, `water`, `heat`, `light`, `goods`, `people`, `data`, `time`, `carbon`, `substance` and `influence`. Use `influence` for a cause that pushes on an effect.
   - Flows with the same carrier and unit share one scale. Thus a trickle next to a stream shows the difference without words.

9. **Write the questions that the page asks** (`ask`, usually 2–5). Ask for the facts that make the answer the viewer's own:
   - A number from a bill, a statement, an app or their own count (hours slept, trips a week). Add a hint about where to find it.
   - Choices for things that people know as a category: their state, their habits, the option that they prefer.

   Each answer sets one or more inputs. Each choices question needs one option that sets exactly the defaults ("Not sure", "About average", "Somewhere else"). Do not write `ask` if no answer from a viewer can change the result. Never write `ask` for a `process` story.

10. **Write the shots.** Write 6–12 `explain` shots, with one idea in each shot. Each caption has 12 words or fewer. Captions are the film's subtitles. Narrate in the present tense, close to the hero (see `references/storytelling.md`).
    - Open on the hero. Follow what happens to the hero, in order. Then go wide. End on the hero again.
    - Follow the system in the order it works: source, flow, store, or the first step to the last step.
    - Use at least one `follow` or `cause` shot. Use exactly one `turn` (at most one in a `process`). Use a `timelapse` on each store.
    - Start with `establish`. End with `handoff`.
    - See `references/shot-types.md` and `references/writing-rules.md`.
    - Write all text that the viewer reads in ASD-STE100. This includes the captions, labels, questions, `ask` text and Decide text. See "All viewer text is ASD-STE100" in `references/writing-rules.md`.

11. **Write Decide.**
    - Use `compare` to compare the options with the viewer's own numbers. A `process` story has no numbers, so it has no `compare`.
    - List the trade-offs, what the model leaves out and the questions to ask.
    - **Never recommend an option.**

12. **Delete what does not earn its place.** Look at each character, flow, input, shot and sentence. Ask what the viewer would lose without it. Merge two flows that say the same thing. Show several outcomes in one crowd (`groups`), not one crowd for each outcome. Remove a shot that repeats a different shot. The validator rejects an input that no formula reads. It also rejects a value that nothing uses and a character that no flow touches.

13. **Run the validator.** The validator checks the structure, every unit, your checks against the source and every extreme of the inputs. It also checks that all viewer text is ASD-STE100. Fix each error. Then run the validator again until it says OK:
    ```bash
    node scripts/validate.mjs screenplay.json
    ```
    To see each ASD-STE100 problem with its fix, run:
    ```bash
    node scripts/ste-check.mjs screenplay.json
    ```

14. **Make the film** as one offline HTML file:
    ```bash
    node scripts/render.mjs screenplay.json -o explainer.html [--cast auto|studio|open|custom] [--voice off|browser]
    ```

15. **Check your work** before you give it to the user:
    - [ ] The shape fits the article. You did not invent a number to make a model. If there are no numbers to change, the shape is `process`.
    - [ ] If the topic is something that a person goes through, the film shows the real steps. You researched and quoted the steps. The film shows more than the odds.
    - [ ] Each real step is its own beat with its own caption, in order. No step is missing. Small steps that the hands do use the `detail` camera.
    - [ ] The film has nothing that the viewer would not miss.
    - [ ] The film has a hero that the viewer cares about. The film opens and ends with the hero. The captions read like a narrator.
    - [ ] Each number has a quote or an `assumption` label. Each researched figure has its URL and the date that you read it.
    - [ ] You opened each URL that you quote. Each quote agrees with the page word for word.
    - [ ] The checks hold the source's own figures. You did not loosen a check to make the model pass.
    - [ ] Each character is something that a viewer would recognise with the sound off. A jar of coins holds money only.
    - [ ] The `turn` corrects a misconception that the article raises. The world makes it visible (two streams side by side, a jar that never fills).
    - [ ] A person can answer each `ask` question in less than a minute. Each choices question has an option for "don't know".
    - [ ] Each caption has 12 words or fewer, in plain words. The film explains each term before it uses the term.
    - [ ] All text that the viewer reads is ASD-STE100. `node scripts/ste-check.mjs screenplay.json` prints "No problems" (see `references/writing-rules.md`).
    - [ ] Decide gives no recommendation. `leftOut` names the real limits of the model.
    - [ ] The text has none of the words in "Words we don't use" in `references/writing-rules.md`.

16. **Give the film to the user.**
    - Give the user the file path. The user can open the file in a browser and push **Record MP4**. This makes a 1080p 60 fps video.
    - Tell the user which numbers are assumptions. Tell the user which researched figures to check again before they rely on them.

Run the scripts from the folder of this skill, or use absolute paths. The scripts need Node 18 or later. They need no packages.

## Options the user may ask for

- **Cast** (`--cast`) has four modes:
  - `auto` uses the cast that the screenplay gives.
  - `studio` uses built-in clay props.
  - `open` uses free CC0 models. Each model needs a `url` and a `credit`.
  - `custom` uses shape recipes.

  If the renderer cannot build a character, it tries `studio`, then `custom`, then a stand-in with a label.
- **Voice** (`--voice`) has two modes:
  - `off` gives captions and music only. This is the default.
  - `browser` uses the built-in speech of the computer.

  For recorded narration with ElevenLabs or OpenAI voices, use the web tool with the user's own key.

## Don'ts

- Do not add features to the page. Do not edit the generated HTML. Change the screenplay and run `render.mjs` again.
- Do not stretch a model to cover everything. If an idea needs more than 4 levers, the article has two decisions. Choose the main decision.
- Do not draw a flow that you cannot give a rate. If you cannot write the formula, the flow is not in the model. A `process` story is the exception: its flows are steps, with no rates.
- Do not invent numbers to make an article fit a model. Choose the shape that the article has.
- Do not use persuasive framing. The page builds understanding. The viewer decides.
