# Storytelling: direct it like a filmmaker

A model explains; a story makes someone care enough to follow the model. Before mapping anything, decide the story the film tells. Think the way a great family-film director would: a person we recognise, an ordinary moment, a question that grows, a discovery, and a return to the person, who now sees their situation differently.

## The story in five lines

Write these down first. They go in `story`.

1. **The hero.** One person the viewer can stand in for, shown as a character on the set: "you", a household, a patient, a commuter. Specific and ordinary beats general: "a kit lands on your doormat" beats "screening programmes". In the screenplay, the hero is a node (`story.hero`).
2. **What they want.** A lower bill, a good night's sleep, to catch an illness early, to be debt-free.
3. **What they don't know yet.** The misconception, or the hidden part of the system. This becomes the `turn`.
4. **The discovery.** The moment the world shows them what's really going on: two streams side by side, a crowd that splits, a jar that never fills.
5. **How it ends.** Back with the hero, who now understands their choice. The film hands the choice over; it never makes it for them.

Then write the **logline**: one sentence, under 35 words, holding all five. "A kit arrives on your doormat; most kits find nothing, and most people sent for more tests don't have cancer, so what does doing the test really change for you?"

## How a director would shoot it

- **Open small.** Start on the hero in an ordinary moment, not on a statement about the topic. The first shot after `establish` is about the hero: `introduce` them, or `follow` something arriving at their door.
- **Follow the hero through the world.** The camera goes where the hero's stuff goes: the kit to the lab, the power from the roof to the home, the money from the card to the bank. Order the shots in the order things happen to the hero.
- **Go wide, then come back.** Pull out to the big picture (100 people, 25 years, the whole grid), then end close on the hero again. The last shot before `handoff` is about the hero. The validator checks both ends.
- **Hold the turn.** Set up what the hero expects one shot before the turn, then let the turn land on a held, quiet shot. The `turn` gets extra time on screen; don't fill it with a second idea.
- **Show, then say.** The picture does the explaining; the caption tells the viewer what to notice and why it matters. Never caption what the viewer can plainly see ("Here is a house").
- **Honest stakes.** Real consequences, told calmly. No fear, no urgency, no villains. Respect the viewer's intelligence and their right to decide.

## Show every step: don't skip

When the film follows something a person does (a test, a form, a claim, an installation), show **every real step, in the order it happens**, the way the authoritative source lists them. A viewer should be able to do it themselves after watching. Skipping a step ("you take a sample", then the post box) leaves a gap the viewer has to guess at.

- **One step, one beat.** Take the steps from your research ("What actually happens" in SKILL.md), quote them in `source.quotes`, and make each one a beat with its own `caption`: "First, write the date on the sample bottle." "Open the bottle. The lid has a sample stick."
- **Look closely at small things.** For a step done with the hands (writing, opening, sealing), give the beat `"camera": "detail"`. The camera glides in to the hands and back out; it never cuts.
- **Give each step time.** A beat with a subtitle lasts as long as it takes to read. Don't cram two steps into one line. If a scene would need more than 8 beats, split it into two scenes in the same place.
- **No jumps in time or place without saying so.** If days pass or the hero goes somewhere new, the subtitle says it: "The result comes by letter, usually within two weeks."
- **Keep the steps that matter for the decision**, and keep them accurate. Don't invent steps the source does not describe; if a step can't be shown (it's private, or the engine has no prop for it), say it in the subtitle while the hero does the nearest action.

## Writing the captions (subtitles)

Captions are the narration. Viewers can turn them off, so the picture must carry the story too, but when they are on they should read like a film's narrator.

- **Present tense, close to the hero:** "The kit arrives. You post a tiny sample back." "Your panels wake up with the sun."
- **One image, one idea, 12 words or fewer.** A caption names what is happening on screen now.
- **Rhythm.** Vary the length. A short line after two longer ones lands hard: "Most find nothing."
- **Plain words.** Explain a term the first time you use it ("a colonoscopy, a camera check of the bowel").
- **The last line hands over:** "Now make it yours." "Your numbers decide the rest."

## Casting: the right characters

- **Recognisable with the sound off.** For each character, ask what it really looks like, and look it up if you don't know (a home test kit is a small tube in an envelope; a heat pump is a box with a fan). Pick the prop or `kind` closest to that, or build a simple `recipe`.
- **The hero is always someone the viewer can stand in for:** a `person`, a `body`, a `crowd` of people like them, or their `home`.
- **Few characters, each with a job** (see "The best part is no part" in SKILL.md). If two characters play the same role, merge them.

## Colour: the tone

Films are shot on a clean white set. The props bring the colour, and one accent colour (`tone`) suits the topic:

| `tone` | For |
|---|---|
| `health` | medicine, screening, sleep, the body |
| `money` | debt, savings, bills, pay |
| `energy` | power, solar, fuel, batteries |
| `water` | rain, tanks, rivers, water use |
| `climate` | emissions, transport, nature |
| `civic` | laws, taxes, public services |
| `food` | diet, cooking, groceries |
| `home` | heating, housing, the household |
| `neutral` | anything else |
