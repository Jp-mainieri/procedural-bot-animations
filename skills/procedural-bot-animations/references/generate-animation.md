# Generate an animation

Turn a user's description into one animation JSON that `parseAnimation` accepts with no errors, and that looks good. This file has what you need without any other file. The full contract is [`docs/animation-format.md`](../../../docs/animation-format.md) in the repo; use it to settle any doubt.

Every value is an **offset from neutral**: 0 in every field is the character at rest.

## 1. The three kinds

```json
{ "version": 1, "kind": "reaction", "id": "nod", "name": "Nod", "duration": 0.9,
  "tracks": { "bodySy": [[0, 0], [0.3, -0.12], [1, 0]] } }

{ "version": 1, "kind": "activity", "id": "humming", "name": "Humming", "period": 3.2,
  "tracks": { "bodyRotate": [[0, 0], [0.25, 3], [0.5, 0], [0.75, -3], [1, 0]] } }

{ "version": 1, "kind": "mood", "id": "dreamy", "name": "Dreamy",
  "pose": { "lidTop": 0.3, "eyeY": -10, "turn": 0.2 } }
```

| `kind` | Plays | Time key |
|---|---|---|
| `reaction` | Once, then fades. Starts and ends at rest | `duration`, 0.2 to 10 s |
| `activity` | A loop while the app is in a state | `period`, 0.3 to 20 s |
| `mood` | A held pose that blends with other moods by weight | none |

`id` is camelCase letters and digits, 2 to 40 characters, starting with a lowercase letter (`/^[a-z][a-zA-Z0-9]{1,39}$/`). `name` is 1 to 60 characters, no `<` or `>`.

## 2. Tracks and keyframes

`tracks` maps a field name to a list of keyframes. 1 to 24 tracks. A field with no track stays at rest. An unknown field name is an error that lists the closest valid names.

A keyframe is `[t, value]` or `[t, value, curve]`:

- `t` is progress from 0 to 1, not seconds. The first keyframe has `t = 0`. Times never decrease.
- `curve` shapes the movement to the **next** keyframe: `"linear"`, `"easeIn"` (slow start), `"easeOut"` (slow end) or `"smooth"` (the default).
- 2 to 40 keyframes per track. Before the first keyframe the first value holds; after the last, the last value holds.

**Reaction rules.** Every track starts and ends at exactly 0. The last keyframe may have `t` below 1; the value then holds at 0. Warnings: a `morph`-group field is used; `holdGaze` is above 0 for more than 80% of the duration; there is no track in the body, eyes or lids groups.

**Activity rules.** For every track the first and last value are equal, and the last keyframe has `t = 1`, so the loop has no jump at the seam. For a constant value write `[[0, 0.25], [1, 0.25]]`.

**Mood rules.** `pose` has at least one field. A mood may not use the `morph` group, `sparks`, `opacity` or `scale`.

## 3. Fields

Positions are in drawing px (the character is about 600 px wide), angles in degrees. A `scale` field is an increment over 1 (`-0.5` is half the size). The ranges are hard limits.

| Field | Unit | Range | What it does |
|---|---|---|---|
| `rootY` | px | -400..650 | Negative lifts the whole character; the shadow stays on the ground |
| `opacity` | add | -1..0 | -1 disappears |
| `bodyRotate` | deg | -45..45 | Lean, around the ground |
| `centerRotate` | deg | -720..720 | Rotation around the body centre (somersault) |
| `bodySx` | scale | -0.5..0.6 | Horizontal stretch from the ground |
| `bodySy` | scale | -0.8..0.8 | Vertical stretch from the ground. Keep `bodySx` near `-bodySy` |
| `scale` | scale | -1..0.5 | Uniform size, from the ground |
| `shadow` | add | -1..0 | Shadow opacity, added to 1 |
| `partC` | deg | -50..50 | Middle part |
| `partL` | deg | -50..50 | Left part: positive raises it |
| `partR` | deg | -50..50 | Right part: negative raises it (mirrored) |
| `partAmp` | scale | -1..1.5 | Multiplies the idle sway of the parts (-1 freezes it) |
| `eyeX`, `eyeY` | px | -40..40 | Eye position. Positive `eyeY` looks down |
| `eyeSx`, `eyeSy` | scale | -1..0.6 | Eye width and height |
| `turn` | -1..1 | -1.6..1.6 | Fake 3D head turn. Past 1 it is a profile |
| `happy`, `happyLeft`, `happyRight` | 0..1 | 0..1 | Eyes become arcs (^) |
| `holdGaze` | 0..1 | 0..1 | 1 stops the eyes following the target while the animation controls them |
| `lidTop` | 0..1 | 0..1 | Top eyelid (1 closes the eye from the top) |
| `lidBottom` | 0..1 | 0..1 | Bottom eyelid (a smiling look) |
| `lidAngle` | deg | -40..40 | Positive slopes down toward the inside (angry, suspicious); negative toward the outside (worried) |
| `closeLeft`, `closeRight` | 0..1 | 0..1 | Closes one eye (a wink) |
| `lamp`, `exclaim`, `question`, `ellipsis`, `zzz`, `rays` | 0..1 | 0..1 | Accessory symbols fade in at 1 |
| `sparks` | 0..1 | 0..1 | Progress of a burst of sparks; 0 when there are none |
| `gray`, `core`, `embers`, `smoke` | 0..1 | 0..1 | Flame effects (see [`built-in-characters.md`](built-in-characters.md)) |
| `morph` group | | | Body-to-object transformations. Do not use these by hand. Use the built-in `morphCheck`, `morphLoading`, `morphCode` and `energy` |

A part field is ignored by a character that does not have that part.

## 4. Craft: what makes it look good

Numbers below come from the built-in reactions in `src/reactions.ts` and the examples in `src/examples.ts`.

- **Anticipation.** Go slightly the opposite way first. In `success` the body squashes (`bodySy` -0.16, `bodySx` 0.12) at `t` 0.1 of 1.6 s, then leaves the ground. In the `nod` example, `bodySy` goes to +0.04 and `partC` to -6 before the dip.
- **Squash and stretch, volume kept.** Make `bodySx` the negative of `bodySy`. Stretch tall is `bodySy` positive with `bodySx` negative. Magnitudes: 0.05 to 0.22 (`stretch` example: `bodySy` 0.22, `bodySx` -0.22). Always animate both.
- **Overshoot and settle.** Pass the target, return past rest a little, then settle at 0, with each swing smaller. `stretch` ends `0.2, -0.05, 0.02, 0`. `nod` dips -0.12, then -0.09.
- **Parts follow with more overshoot than the body.** In `stretch` the body moves 0.22 while `partL` and `partR` swing 30 degrees. Mirror them: `partL` +x with `partR` -x. The engine already makes the part tips lag and bend by themselves, so you do not need extra keyframes for that.
- **Eyes lead the body.** The eye should arrive a moment before the body. Start `eyeX`, `eyeY`, `turn` and lid tracks a keyframe earlier than the body tracks. This is advice, not something the engine does for you.
- **Expression comes from the lids.** Use `lidTop` 0.2 to 0.5, `lidAngle` 8 to 25 degrees, `lidBottom` up to 0.35, and `eyeX` or `eyeY` up to about 26. Prefer lids over eye size. The `wink` reaction is `happyRight` 1 with `lidBottom` 0.25.
- **`holdGaze`.** The eyes follow the pointer unless `holdGaze` is raised. Raise it to 1 within the first 6 to 10% of the animation when you animate `eyeX`, `eyeY` or `turn` (`nod`: 0 at `t` 0, 1 at 0.06). Keep it until about half the animation and bring it back to 0 by about 70% (`nod` returns to 0 at 0.68, `stretch` at 0.7). Never keep it above 0 for more than 80% of the duration.
- **Magnitudes.**

  | Move | Value |
  |---|---|
  | Small hop (`wink`) | `rootY` -26 |
  | Startled jump (`fright`) | `rootY` -45 |
  | Jump, from `success` exercise to module | `rootY` -110, -170, -220 |
  | Lean | `bodyRotate` 2 to 15 (`wink` 7) |
  | Parts | 5 to 30 degrees (`success` 20, 26 or 32; `fright` 24) |
  | Duration | 0.6 s (`wake`) to 3.4 s (`burst`); `fright` and `nod` 0.9, `wink` 1.2, `success` 1.6 |

- **Accessories.** `exclaim` 1 for a scare (`fright` shows it from `t` 0.08 to 0.8). `lamp` for an idea, `question` for doubt, `zzz` for sleep, `sparks` ending at 1 for a hit.
- **Activities.** Make the first and last value of every track equal and end at `t = 1`. Use quarter keyframes (`0`, `0.25`, `0.5`, `0.75`, `1`) so the extremes line up. Keep them gentle: `humming` is `bodyRotate` of 3 degrees and `bodySy` of 0.02 over 3.2 s.
- **Moods.** Mostly lids and a little body. Built-in moods use `lidTop` 0.22 to 0.58 and `lidAngle` -16 to 26. Do not put motion that moves through space in a mood.

## 5. Return to zero

A reaction that does not return to 0 leaves the character off-pose. Check, for every track:

1. The first keyframe is `[0, 0]`.
2. The last keyframe is `[something, 0]`.
3. A track that moves late still ends at 0 (`[0.9, 0.3], [1, 0]`).
4. `holdGaze` is back to 0 well before the end, and all accessories are back to 0.

For an activity, the first and last values are equal (not necessarily 0), and the last `t` is 1.

## 6. Self-check (always do this)

Never hand over an animation you have not validated.

1. Save the JSON to `animation.json`.
2. Save this script as `check-animation.mjs` next to it:

   ```js
   import { readFileSync } from "node:fs";
   // Inside the package repo, after `npm run build`: "./dist/index.js".
   // In a project that installed the package: "procedural-bot-animations".
   import { describeAnimation, parseAnimation } from "procedural-bot-animations";

   const result = parseAnimation(readFileSync(process.argv[2], "utf8"));
   if (!result.ok) {
     console.error("ERRORS:\n" + result.errors.join("\n"));
     process.exit(1);
   }
   const { definition, compiled } = result.value;
   console.log("OK:", describeAnimation(definition));
   if (result.warnings.length) console.log("WARNINGS:\n" + result.warnings.join("\n"));

   if (compiled.kind === "reaction") {
     const off = (t) => Object.entries(compiled.def.sample(t)).filter(([, v]) => Math.abs(v) > 1e-9);
     console.log("at t=0:", off(0), "at t=1:", off(1)); // both should be []
   }
   ```

3. Run `node check-animation.mjs animation.json`.
4. Fix **every** error. Typical fixes:

   | Error says | Fix |
   |---|---|
   | `tracks.<field>: must start and end at 0` | Make the first and last keyframe value exactly 0 |
   | An unknown field with a list of close names | Use the suggested name |
   | `t` out of order or the first `t` is not 0 | Sort the keyframes and start at `[0, ...]` |
   | A value outside the range | Check the table in section 3 |
   | Activity first and last value differ, or last `t` is not 1 | Copy the first value to the end and set the last `t` to 1 |
   | Mood uses a forbidden field | Remove `sparks`, `opacity`, `scale` and the `morph` group |

5. Run the script again. Repeat until it prints `OK`. Then read the warnings and the `describeAnimation` sentence: does it describe what the user asked for?
6. If the package is not available to run, say so, go through section 5 by hand, and tell the user the animation was not machine-validated.

To see it move: build a library and play it (`addToLibrary(library, result.value.compiled)`, then `mountCharacter(host, { rig, library })` and `bot.react(id)`), or paste the JSON into the Studio (<https://jp-mainieri.github.io/procedural-bot-animations/>).

## 7. Reply format

Give the user the JSON in one code block, the `describeAnimation` sentence, and how to play it: `bot.react("id")` for a reaction, `bot.update({ activity: "id" })` for an activity, `bot.update({ mood: "id" })` for a mood. Say which character it was designed for if it uses part fields.
