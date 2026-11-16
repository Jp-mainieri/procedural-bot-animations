# Animation format

An animation is one JSON object that adds a **reaction**, an **activity** or a **mood** to the library, as plain data. Every value is an *offset from neutral*: 0 in every field is the character at rest.

| `kind` | What it is | Time |
|---|---|---|
| `reaction` | A one-shot (a nod, a jump). Plays once, starts and ends at rest. | `duration` seconds |
| `activity` | A loop that lasts while the app stays in a state (thinking, humming). | `period` seconds, repeats |
| `mood` | A held pose that blends with other moods by weight. | none |

Use it from code:

```ts
import { parseAnimation, addToLibrary } from "procedural-bot-animations";

const r = parseAnimation(jsonText);                // never throws
if (r.ok) addToLibrary(library, r.value.compiled); // r.warnings lists non-blocking notes
else console.log(r.errors);                        // every problem, each starting with its JSON path
```

## Keys

Common to all three kinds:

| Key | Rule |
|---|---|
| `version` | The number `1`. |
| `kind` | `"reaction"`, `"activity"` or `"mood"`. |
| `id` | camelCase letters and digits, 2 to 40 characters, starting with a lowercase letter (`/^[a-z][a-zA-Z0-9]{1,39}$/`), e.g. `sideEye`. |
| `name` | 1 to 60 characters after trimming; no control characters, no `<` or `>`. |

- Reaction: `duration` (seconds, 0.2 to 10) and `tracks`.
- Activity: `period` (seconds, 0.3 to 20) and `tracks`.
- Mood: `pose`.

Unknown top-level keys are warnings (ignored).

## Tracks (reactions and activities)

`tracks` is an object: **field name -> list of keyframes**. At least 1 and at most 24 tracks. A field that has no track stays at rest. An unknown field name is an error that lists the closest valid names.

A keyframe is `[t, value]` or `[t, value, curve]`:

- `t` is progress through the animation, from 0 to 1 (not seconds). The first keyframe must have `t = 0`; times must not decrease; two equal times make a jump.
- `value` is a finite number inside the field's range (table below), in the field's unit.
- `curve` (optional) shapes the movement from this keyframe to the next. One of `"linear"`, `"easeIn"` (slow start), `"easeOut"` (slow end), `"smooth"` (smoothstep, the default). The curve on the last keyframe has no effect.
- At least 2 and at most 40 keyframes per track.
- Between keyframes the value is interpolated; before the first the first value holds, after the last the last value holds (so a track may stop early and hold).

### Reaction rules

- **Every track must start and end at 0** (first and last keyframe value exactly 0), so the character returns to neutral. The last keyframe may have `t` below 1: the value then holds at 0. Error otherwise: `tracks.rootY: must start and end at 0 ...`.
- Warning if any track uses a `morph`-group field: those belong to the transformation grammar (bubble, ring, check) and only look right when several are choreographed together.
- Warning if `holdGaze` is above 0 for more than 80 percent of the duration.
- Warning if there is no track in the `body`, `eyes` or `lids` groups at all.

### Activity rules

- It loops: time maps to `t = (seconds % period) / period`.
- **For each track the first and last values must be equal** (so there is no jump at the seam) and **the last keyframe must have `t = 1`**.
- To hold a constant value, use two keyframes: `[[0, 0.25], [1, 0.25]]`.
- A good loop makes its extremes line up: the value and its direction should flow from the end back into the start.

### Mood rules

`pose` is an object `field -> number` (at least one field), each inside the range. A mood may **not** use the `morph` group, `sparks`, `opacity` or `scale` (error). No warnings apply.

## Fields

Positions are in drawing pixels (the character is about 600 px wide), angles in degrees, `scale` fields are increments over 1 (`-0.5` is half the size). The ranges are hard limits enforced by the validator; 0 is always the rest value.

| Field | Group | Unit | Min | Max | What it does |
|---|---|---|---|---|---|
| `rootY` | body | px | -400 | 650 | Raises (negative) or lowers the whole character; the shadow stays on the ground. |
| `opacity` | body | -1..1 | -1 | 0 | Added to the opacity (-1 disappears). |
| `bodyRotate` | body | deg | -45 | 45 | Rotation around the ground (leaning). |
| `centerRotate` | body | deg | -720 | 720 | Rotation around the body center (somersault). |
| `bodySx` | body | scale | -0.5 | 0.6 | Horizontal stretch of the body from the ground (0.2 = 20% wider). |
| `bodySy` | body | scale | -0.8 | 0.8 | Vertical stretch of the body from the ground (-0.2 = 20% shorter). Keep bodySx near -bodySy to preserve volume. |
| `scale` | body | scale | -1 | 0.5 | Uniform scale of the character, from the ground (-1 vanishes). |
| `shadow` | body | -1..1 | -1 | 0 | Shadow opacity, added to 1 (-1 hides the shadow; it cannot get stronger than normal). |
| `partC` | parts | deg | -50 | 50 | Middle appendage rotation. |
| `partL` | parts | deg | -50 | 50 | Left appendage: positive raises it. |
| `partR` | parts | deg | -50 | 50 | Right appendage: negative raises it (mirrored). |
| `partAmp` | parts | scale | -1 | 1.5 | Multiplies the amplitude of the appendage sway (-1 freezes it). |
| `eyeX` | eyes | px | -40 | 40 | Eyes move horizontally. |
| `eyeY` | eyes | px | -40 | 40 | Eyes move vertically (positive looks down). |
| `eyeSx` | eyes | scale | -1 | 0.6 | Eye width, increment over 1. |
| `eyeSy` | eyes | scale | -1 | 0.6 | Eye height, increment over 1 (-0.5 leaves the eye at half its height). |
| `turn` | eyes | -1..1 | -1.6 | 1.6 | Fake 3D turn: -1 to 1 turns the face; up to +-1.6 is a profile. |
| `happy` | eyes | 0..1 | 0 | 1 | Both eyes become arcs (^). |
| `happyLeft` | eyes | 0..1 | 0 | 1 | Only the left eye becomes an arc (^). |
| `happyRight` | eyes | 0..1 | 0 | 1 | Only the right eye becomes an arc (^). |
| `holdGaze` | eyes | 0..1 | 0 | 1 | How much the reaction takes over the gaze (0 follows the target, 1 only the reaction rules). |
| `lidTop` | lids | 0..1 | 0 | 1 | Top eyelid (0 open, 1 closes the eye from the top down). |
| `lidBottom` | lids | 0..1 | 0 | 1 | Bottom eyelid (0 open, 1 closes from the bottom up): a smiling look. |
| `lidAngle` | lids | deg | -40 | 40 | Eyelid tilt: positive slopes down toward the inside (angry, suspicious), negative toward the outside (worried). |
| `closeLeft` | lids | 0..1 | 0 | 1 | Closes just the left eye (a wink). |
| `closeRight` | lids | 0..1 | 0 | 1 | Closes just the right eye (a wink). |
| `lamp` | accessories | 0..1 | 0 | 1 | Light bulb accessory (0 hidden, 1 visible). |
| `exclaim` | accessories | 0..1 | 0 | 1 | Exclamation mark (0 hidden, 1 visible). |
| `question` | accessories | 0..1 | 0 | 1 | Question mark (0 hidden, 1 visible). |
| `ellipsis` | accessories | 0..1 | 0 | 1 | Three dots (0 hidden, 1 visible). |
| `zzz` | accessories | 0..1 | 0 | 1 | Sleeping Z's (0 hidden, 1 visible). |
| `rays` | accessories | 0..1 | 0 | 1 | Light rays (0 hidden, 1 visible). |
| `sparks` | accessories | 0..1 | 0 | 1 | Progress of the sparks of a hit (0 to 1); 0 when there are none. |
| `gray` | flame | 0..1 | 0 | 1 | Loses its color: 0 normal, 1 gray (flame characters). |
| `core` | flame | 0..1 | 0 | 1 | Lit yellow core (flame characters). |
| `embers` | flame | 0..1 | 0 | 1 | Embers rising from the tongues (intensity). |
| `smoke` | flame | 0..1 | 0 | 1 | Smoke coming off the tip (intensity). |
| `morph` | morph | 0..1 | 0 | 1 | Starts the transformation: scaling becomes relative to the anchor and the idle goes quiet. |
| `round` | morph | 0..1 | 0 | 1 | The silhouette becomes a circle. |
| `retract` | morph | -1..1 | -0.5 | 1 | Appendages retract into the body (negative: they pop out bigger). |
| `eyesVanish` | morph | 0..1 | 0 | 1 | The eyes shrink until they vanish. |
| `swap` | morph | 0..1 | 0 | 1 | At 0.5 or more shows the object in place of the body. |
| `bubbleR` | morph | px | 0 | 200 | Outer radius of the bubble (a disc when bubbleHole is 0). |
| `bubbleHole` | morph | px | 0 | 130 | Radius of the hole: with a hole, the bubble becomes a ring. |
| `bubbleArc` | morph | 0..1 | 0 | 1 | Fraction of the ring that is missing (0 = whole ring). |
| `bubbleX` | morph | px | -200 | 200 | Horizontal offset of the bubble. |
| `bubbleY` | morph | px | -200 | 200 | Vertical offset of the bubble. |
| `dotsDist` | morph | px | 0 | 260 | Distance from the side dots to the bubble; they are born underneath it. |
| `dotsBounce` | morph | 0..1 | 0 | 1 | How much the dots bounce. |
| `checkDraw` | morph | 0..1 | 0 | 1 | How much of the check mark has been drawn, from the bubble. |
| `codeDraw` | morph | 0..1 | 0 | 1 | How much of the </> has been drawn, from the three dots. |
| `orbitOpen` | morph | 0..1 | 0 | 1 | The orbit dots come out from under the bubble up to the full radius. |
| `objScale` | morph | scale | -0.5 | 0.5 | Added to the object's scale (pulse). |
| `objRotate` | morph | deg | -2200 | 2200 | Rotation of the object, in degrees. |

Notes:

- `rootY` negative lifts the character; positive sinks it (the shadow stays on the ground).
- Squash and stretch happens from the ground. To keep volume, make `bodySx` roughly the negative of `bodySy` (stretch tall = `bodySy` positive, `bodySx` negative).
- `partL` positive raises the left part, `partR` negative raises the right part (mirrored), `partC` rotates the middle one. Characters without that part ignore the field.
- `turn` is a fake 3D head turn: -1 to 1; the sign picks the direction.
- `holdGaze` 1 stops the eyes following the pointer while the animation controls them (use it briefly when you animate `eyeX`/`eyeY`).
- Accessories (`lamp`, `exclaim`, `question`, `ellipsis`, `zzz`, `rays`) fade a symbol in at 1.
- The flame group only does something on flame-like characters; the morph group is advanced (see the warning above).

## Good motion (house style)

- **Anticipation**: go slightly the opposite way first (squat before a jump, lean back before leaning forward).
- **Overshoot and settle**: pass the target, come back past rest a little, then settle at 0 (for example 0.2, -0.05, 0.02, 0).
- **Squash and stretch with volume**: `bodySx = -bodySy`. Typical magnitudes: 0.05 to 0.2.
- **Follow-through**: parts lag the body; let them overshoot more than the body does.
- **Eyes**: eyelid fields (`lidTop`, `lidBottom`, `lidAngle`) carry expression better than eye size. Typical `lidTop` 0.2 to 0.5, `lidAngle` 8 to 25, `eyeX`/`eyeY` up to 26.
- Typical magnitudes: `rootY` -20 (small hop) to -170 (big jump), `bodyRotate` 2 to 15, parts 5 to 30.

## Worked examples

A reaction (squat, tall stretch with parts spreading, settle with overshoot):

```json
{
  "version": 1,
  "kind": "reaction",
  "id": "stretch",
  "name": "Stretch",
  "duration": 1.5,
  "tracks": {
    "bodySy": [[0,0],[0.18,-0.14],[0.42,0.22],[0.58,0.2],[0.72,-0.05],[0.86,0.02],[1,0]],
    "bodySx": [[0,0],[0.18,0.14],[0.42,-0.22],[0.58,-0.2],[0.72,0.05],[0.86,-0.02],[1,0]],
    "rootY": [[0,0],[0.18,0],[0.42,-18],[0.58,-14],[0.72,0],[1,0]],
    "partL": [[0,0],[0.18,-12],[0.42,30],[0.58,26],[0.72,-8],[0.86,3],[1,0]],
    "partR": [[0,0],[0.18,12],[0.42,-30],[0.58,-26],[0.72,8],[0.86,-3],[1,0]],
    "partC": [[0,0],[0.18,-8],[0.42,12],[0.58,10],[0.72,-6],[0.86,2],[1,0]],
    "lidTop": [[0,0],[0.18,0.3],[0.42,0],[1,0]],
    "lidBottom": [[0,0],[0.42,0.3],[0.62,0.3],[0.86,0],[1,0]],
    "eyeY": [[0,0],[0.42,-8],[0.62,-8],[0.86,0],[1,0]],
    "shadow": [[0,0],[0.42,-0.15],[0.58,-0.12],[0.72,0],[1,0]],
    "holdGaze": [[0,0],[0.08,1],[0.55,1],[0.7,0],[1,0]]
  }
}
```

An activity (a loop; the first and last value of every track are equal and the last `t` is 1):

```json
{
  "version": 1,
  "kind": "activity",
  "id": "humming",
  "name": "Humming",
  "period": 3.2,
  "tracks": {
    "bodyRotate": [[0,0],[0.25,3],[0.5,0],[0.75,-3],[1,0]],
    "bodySy": [[0,-0.015],[0.25,0.02],[0.5,-0.015],[0.75,0.02],[1,-0.015]],
    "bodySx": [[0,0.015],[0.25,-0.02],[0.5,0.015],[0.75,-0.02],[1,0.015]],
    "partL": [[0,0],[0.25,8],[0.5,0],[0.75,-4],[1,0]],
    "partR": [[0,0],[0.25,-4],[0.5,0],[0.75,8],[1,0]],
    "partC": [[0,0],[0.25,6],[0.5,0],[0.75,-6],[1,0]],
    "eyeY": [[0,0],[0.25,-3],[0.5,0],[0.75,-3],[1,0]],
    "lidBottom": [[0,0.25],[1,0.25]]
  }
}
```

A mood:

```json
{
  "version": 1,
  "kind": "mood",
  "id": "dreamy",
  "name": "Dreamy",
  "pose": {
    "lidTop": 0.3,
    "lidBottom": 0.1,
    "lidAngle": -8,
    "eyeY": -10,
    "turn": 0.2,
    "bodyRotate": -3,
    "partL": 8,
    "partR": -8,
    "partC": 5,
    "partAmp": -0.4,
    "rootY": -4
  }
}
```

## Prompt

Copy everything in the block below into any LLM, then add a description of the animation you want after the last line.

```text
You design animations for a 2D procedural character engine. Reply with ONE valid JSON object and nothing else: no markdown fences, no commentary.

Every value is an OFFSET from neutral (0 = the character at rest). Pick one kind:

REACTION (plays once):  { "version": 1, "kind": "reaction", "id": "camelCaseId", "name": "Display Name", "duration": 1.2, "tracks": { "<field>": [[t, value], [t, value, "curve"], ...], ... } }
ACTIVITY (loops):       { "version": 1, "kind": "activity", "id": "camelCaseId", "name": "Display Name", "period": 3, "tracks": { ... same ... } }
MOOD (held pose):       { "version": 1, "kind": "mood", "id": "camelCaseId", "name": "Display Name", "pose": { "<field>": value, ... } }

GENERAL: id is camelCase letters and digits, 2-40 chars, starts lowercase. name is 1-60 characters without < or >. duration is 0.2-10 seconds; period is 0.3-20 seconds. 1-24 tracks.

KEYFRAMES: [t, value] or [t, value, curve]. t is progress 0..1 (not seconds), the first keyframe has t = 0, times never decrease. curve is one of "linear", "easeIn", "easeOut", "smooth" (default) and shapes the movement to the NEXT keyframe. 2-40 keyframes per track. Values must be inside each field's range.

RULES:
- REACTION: every track must start and end at exactly 0 (first and last keyframe value 0). The last keyframe may have t < 1. Do not keep holdGaze above 0 for more than 80 percent of the duration. Include body, eyes or lids tracks. Do not use morph-group fields.
- ACTIVITY: for every track the first and last values must be equal, and the last keyframe must have t = 1, so the loop is seamless. For a constant value use [[0, v], [1, v]].
- MOOD: any field except the morph group, sparks, opacity and scale.
- Motion style: anticipation first (move slightly the opposite way), then the main move, then overshoot and settle. Squash and stretch keeping volume: bodySx is about -bodySy (typical 0.05-0.2). Parts (partC, partL, partR) follow the body with overshoot. Use the eyelids (lidTop 0.2-0.5, lidAngle 8-25, lidBottom up to 0.35) and eyeX/eyeY for expression. holdGaze 1 briefly (back to 0 early) while you animate the eyes.

FIELDS (name [group]: unit, min..max. meaning):
- rootY [body]: px, -400..650. Raises (negative) or lowers the whole character; the shadow stays on the ground.
- opacity [body]: -1..1, -1..0. Added to the opacity (-1 disappears).
- bodyRotate [body]: deg, -45..45. Rotation around the ground (leaning).
- centerRotate [body]: deg, -720..720. Rotation around the body center (somersault).
- bodySx [body]: scale, -0.5..0.6. Horizontal stretch of the body from the ground (0.2 = 20% wider).
- bodySy [body]: scale, -0.8..0.8. Vertical stretch of the body from the ground (-0.2 = 20% shorter). Keep bodySx near -bodySy to preserve volume.
- scale [body]: scale, -1..0.5. Uniform scale of the character, from the ground (-1 vanishes).
- shadow [body]: -1..1, -1..0. Shadow opacity, added to 1 (-1 hides the shadow; it cannot get stronger than normal).
- partC [parts]: deg, -50..50. Middle appendage rotation.
- partL [parts]: deg, -50..50. Left appendage: positive raises it.
- partR [parts]: deg, -50..50. Right appendage: negative raises it (mirrored).
- partAmp [parts]: scale, -1..1.5. Multiplies the amplitude of the appendage sway (-1 freezes it).
- eyeX [eyes]: px, -40..40. Eyes move horizontally.
- eyeY [eyes]: px, -40..40. Eyes move vertically (positive looks down).
- eyeSx [eyes]: scale, -1..0.6. Eye width, increment over 1.
- eyeSy [eyes]: scale, -1..0.6. Eye height, increment over 1 (-0.5 leaves the eye at half its height).
- turn [eyes]: -1..1, -1.6..1.6. Fake 3D turn: -1 to 1 turns the face; up to +-1.6 is a profile.
- happy [eyes]: 0..1, 0..1. Both eyes become arcs (^).
- happyLeft [eyes]: 0..1, 0..1. Only the left eye becomes an arc (^).
- happyRight [eyes]: 0..1, 0..1. Only the right eye becomes an arc (^).
- holdGaze [eyes]: 0..1, 0..1. How much the reaction takes over the gaze (0 follows the target, 1 only the reaction rules).
- lidTop [lids]: 0..1, 0..1. Top eyelid (0 open, 1 closes the eye from the top down).
- lidBottom [lids]: 0..1, 0..1. Bottom eyelid (0 open, 1 closes from the bottom up): a smiling look.
- lidAngle [lids]: deg, -40..40. Eyelid tilt: positive slopes down toward the inside (angry, suspicious), negative toward the outside (worried).
- closeLeft [lids]: 0..1, 0..1. Closes just the left eye (a wink).
- closeRight [lids]: 0..1, 0..1. Closes just the right eye (a wink).
- lamp [accessories]: 0..1, 0..1. Light bulb accessory (0 hidden, 1 visible).
- exclaim [accessories]: 0..1, 0..1. Exclamation mark (0 hidden, 1 visible).
- question [accessories]: 0..1, 0..1. Question mark (0 hidden, 1 visible).
- ellipsis [accessories]: 0..1, 0..1. Three dots (0 hidden, 1 visible).
- zzz [accessories]: 0..1, 0..1. Sleeping Z's (0 hidden, 1 visible).
- rays [accessories]: 0..1, 0..1. Light rays (0 hidden, 1 visible).
- sparks [accessories]: 0..1, 0..1. Progress of the sparks of a hit (0 to 1); 0 when there are none.
- gray [flame]: 0..1, 0..1. Loses its color: 0 normal, 1 gray (flame characters).
- core [flame]: 0..1, 0..1. Lit yellow core (flame characters).
- embers [flame]: 0..1, 0..1. Embers rising from the tongues (intensity).
- smoke [flame]: 0..1, 0..1. Smoke coming off the tip (intensity).
- morph [morph]: 0..1, 0..1. Starts the transformation: scaling becomes relative to the anchor and the idle goes quiet.
- round [morph]: 0..1, 0..1. The silhouette becomes a circle.
- retract [morph]: -1..1, -0.5..1. Appendages retract into the body (negative: they pop out bigger).
- eyesVanish [morph]: 0..1, 0..1. The eyes shrink until they vanish.
- swap [morph]: 0..1, 0..1. At 0.5 or more shows the object in place of the body.
- bubbleR [morph]: px, 0..200. Outer radius of the bubble (a disc when bubbleHole is 0).
- bubbleHole [morph]: px, 0..130. Radius of the hole: with a hole, the bubble becomes a ring.
- bubbleArc [morph]: 0..1, 0..1. Fraction of the ring that is missing (0 = whole ring).
- bubbleX [morph]: px, -200..200. Horizontal offset of the bubble.
- bubbleY [morph]: px, -200..200. Vertical offset of the bubble.
- dotsDist [morph]: px, 0..260. Distance from the side dots to the bubble; they are born underneath it.
- dotsBounce [morph]: 0..1, 0..1. How much the dots bounce.
- checkDraw [morph]: 0..1, 0..1. How much of the check mark has been drawn, from the bubble.
- codeDraw [morph]: 0..1, 0..1. How much of the </> has been drawn, from the three dots.
- orbitOpen [morph]: 0..1, 0..1. The orbit dots come out from under the bubble up to the full radius.
- objScale [morph]: scale, -0.5..0.5. Added to the object's scale (pulse).
- objRotate [morph]: deg, -2200..2200. Rotation of the object, in degrees.

THE ANIMATION I WANT:
```
