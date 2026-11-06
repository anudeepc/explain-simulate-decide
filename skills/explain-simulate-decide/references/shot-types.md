# Shot types

You choose the shot type. The renderer decides the camera, the framing and the timing. Use one idea in each shot.

| Shot | Focus | What it is for | Camera | What moves |
|---|---|---|---|---|
| `establish` | — | Open: show the whole world and the question | Wide, slow arc | Everything runs at the default values |
| `introduce` | node | Meet a thing and the value it shows | ¾ angle, subject on a third | Its value sweeps |
| `focus` | node | Stay with one thing to make a point | Close, small angle | The thing sweeps, or the lever behind it sweeps |
| `follow` | flow | Show where something goes | Moves along the flow. For a flow from the sky, it looks up the beam | The flow itself. No input sweeps |
| `cause` | flow | Show that a change to X changes this flow | Two-shot of both ends, with the other flows into the same node | The `drive` input sweeps. The flow gets thicker or thinner with it |
| `compare` | node or flow | Two states of one thing ("a little vs a lot") | Front-on, medium | `drive` sweeps low → high |
| `turn` | node or flow | Correct the idea that most people get wrong. **Exactly one** (at most one in a `process` story). | Slow arc. This is the longest shot | Nothing moves, so the viewer can compare. Add `drive` only if the surprise needs a sweep |
| `timelapse` | store node | Show what builds up over time | Medium on the store | The clock runs from 0 to the span: the jar fills, the store crosses the line, the flag rises |
| `handoff` | — | Last shot: give the choice to the viewer | Moves to the Simulate view (in a `process` story, to Decide) | The questions come next. In a `process` story, Decide comes next |
| `scene` | a place (`set`) | The hero acts: a moment in their life (see `screenplay-format.md`) | Follows the hero like a Steadicam, from the open side of the room. For far moves, it cranes over the roofs | The hero walks to the place, then does the beats |

## A reliable shape (6–12 shots)

1. `establish`: the question, in the hero's world.
2. `introduce` the hero. Or `follow` the first thing that happens to them (a kit on the doormat, sunlight on their roof).
3. `follow` or `cause` for each main flow, in the order that things happen to the hero.
4. One shot that shows what the hero expects.
5. `turn`: the insight. Usually this is two flows side by side, or one flow that is smaller than people expect.
6. `cause` with `drive` set to the input of an option (for example, the battery appears).
7. Go wide: `timelapse` on the store, or `focus` on the crowd.
8. Go back to the hero: `focus` on them. The validator checks that the film ends here before the `handoff`.
9. `handoff`.

## Shot length (automatic)

- **Length:** the caption stays on screen long enough to read at a calm pace (about 2.4 words per second). Then the viewer has 2 s to watch the scene. The camera move and the fades add time to that. For example, a 12-word caption gives a shot of about 9 s. No shot is shorter than 6 s.
- **Extra time:** `follow` lasts at least 8 s. `turn` gets an extra 2.5 s. `timelapse` gets an extra 4 s.
- **Scenes:** a scene gets about 2.4 s for each beat. It also gets the time to go to the place. This is one of these:
  - the walk from the last scene (at about 1.45 m/s)
  - a crane of 5.5–8.5 s for a far place
  - a 2.6 s crane down after a diagram shot.

  If the caption needs more time than that, the hero does the beats more slowly to fill the time.
- **After Explain:** the recording adds a 26 s Simulate segment (questions, controls, clock) and an 18 s Decide segment.

Eight to eleven shots give an Explain act of about 70–100 seconds. The whole film is then about two to two and a half minutes. Shorter captions make a faster film. Do not add shots to fill time.
