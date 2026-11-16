# Architecture

The engine is split so that the part that decides what the character does has no DOM. `mountCharacter` is one renderer for it, not the only possible one.

```
┌──────────────────────────────────────────────────────────────┐
│ Your app                                                     │
│ decides WHEN things happen: bot.react("success"),            │
│ bot.update({ mood, activity }), a state machine              │
├──────────────────────────────────────────────────────────────┤
│ mount.ts   mountCharacter: builds the SVG, reads the pointer │
│            and the window, calls brain.step, writes the Pose │
│            into attributes. ticker.ts: one shared rAF loop   │
├──────────────────────────────────────────────────────────────┤
│ brain.ts   Brain.step(now, input) -> Pose. Pure, no DOM      │
│   gaze.ts, focus.ts   where the eyes look and how            │
│   interactions.ts     hover / click gestures                 │
│   parts.ts, motion.ts springs, tip physics, blink, jump      │
├──────────────────────────────────────────────────────────────┤
│ Layers, all summed as "deltas" (delta.ts):                   │
│   base idle + moods + activities + reactions                 │
│   moods.ts, reactions.ts, transformations.ts                 │
├──────────────────────────────────────────────────────────────┤
│ rig.ts (a Rig) and library.ts (a Library)                    │
│   Rig: body path, parts, eyes, ground, anchor                │
│   Library: reactions, activities, moods by name              │
│   characters/ (Berry, Flame)  character.ts (JSON -> Rig)     │
│   animation.ts (JSON -> library entry)                       │
└──────────────────────────────────────────────────────────────┘
```

`state-machine.ts` and `scroll-traveler.ts` are separate, DOM-free helpers. They do not use any of the layers above.

## How one frame is computed

`mountCharacter` subscribes one function to the shared ticker (`src/ticker.ts`). Each frame:

1. **Read the world** (`frame` in `src/mount.ts`). Take the SVG's bounding rect. Compute the pointer's `proximity` to the character (0 far, 1 on top, only if the pointer moved in the last 2.5 s). Resolve the `gaze` option into a target, normalised against 0.35 of the window width and height, relative to a point at 60% of the character's height. In `free` and `focus` modes, `decideGaze` (`src/focus.ts`) picks the point, an `interest` impulse and whether the eye should glide.
2. **Call `Brain.step(now, input)`.** The input is the gaze target, `hover`, `reduced`, the mood weights, the activity name, `detail` (`"simple"` when the character is narrower than 48 px, else `"full"`), `bend`, `interest`, `proximity` and `glide`. In order, `step` does this:
   1. Limit `dt` to 50 ms. A gesture that was queued while the character was busy starts if the character is free now and it is under 1.6 s old.
   2. Smooth the weight of every mood (0.45 s) and activity (0.4 s) with a critically damped spring. Weights jump on the first frame.
   3. **Sum the layers** into one `Delta`: each mood times its weight, each activity sampled at the current time times its weight, the reaction that is being replaced (fading out over 350 ms), the current reaction sampled at its progress `t`, and the cuddle or nap state if the pointer has rested on the character. With reduced motion, the movement fields are then zeroed.
   4. Read `holdGaze` and `morph` from the sum. `holdGaze` lets a reaction take the gaze away from the target. `morph` quietens the idle (`alive = 1 - morph`).
   5. **Gaze.** Take the target (or wander when there is none), scale it by `(1 - holdGaze) * alive`, and call `Gaze.step`. It returns the eye position and velocity, attention, boredom, convergence and a blink request.
   6. Blink, jump and squash, hover (held 0.6 s after the pointer leaves).
   7. **Parts.** Compute a target angle per part (idle sway, plus lag from the jump, plus hover and attention, plus the delta) and move each one with a spring.
   8. **Body.** Breathing, the fake 3D `turn`, squash and stretch, lean and height.
   9. **Eyes.** Position, size, eyelids and tilt of each eye (see below).
   10. **Part tips.** Compute the acceleration of the body and of each part, and push each tip spring with it.
   11. Fill in the rest of the `Pose`: opacity, shadow, accessories (zero when `detail` is `"simple"`), flame effects, and the transformation fields passed through as they are.
3. **Render the `Pose`** (`render` in `src/mount.ts`), in this order: root offset and opacity, rotation around the body centre, body rotation and squash around the ground, uniform scale (its pivot moves from the ground to the anchor as `morph` grows), the body path (only rewritten when `round` changes), parts (rotation, retraction, and `bendPath` when the bend changed by 0.08 degrees or more), eyes (transform, eyelid clip polygon, happy arc), body colour (mixed with grey by `gray`), flame core, embers and smoke, shadow, sparks, accessories, and the transformation object when `swap` is 0.5 or more.

## Why layers are added, not swapped

Every layer returns a `Delta`: a flat set of offsets from rest, one number per field in `src/delta.ts`. The brain sums them with `addDelta`. A mood at weight 0.5 contributes half of its offsets. A reaction that plays over a mood simply adds to it. A reaction that replaces another does not cut it: the old one keeps playing and fades out, so there is no jump.

That is why a new reaction written as JSON works on every character and with every mood. It names fields, not characters. It is also why every reaction must start and end at zero: whatever it adds has to leave no trace.

Three layers have different lifetimes:

| Layer | Lifetime | Smoothed by |
|---|---|---|
| Moods | Held. Several at once, each with a weight | The weight moves with a critically damped spring (0.45 s) |
| Activities | Looped while selected. Sampled by time in seconds | The weight moves with a spring (0.4 s) |
| Reactions | One-shot, sampled by progress `t` from 0 to 1 | Fade out over 350 ms when replaced |

Reactions in `EXCLUSIVE` (`src/transformations.ts`: the transformations `morphLoading`, `morphCheck`, `morphCode` and `energy`) cannot be interrupted. A reaction requested meanwhile waits in a one-slot queue.

## How the eyes work

```
target (-1..1) -> Gaze.step -> eye spring -> reactive shape (Brain) -> eyelid clip (mount)
```

1. **Gaze target.** The input target is clamped to -1..1. With no target, the brain picks a wander point every 1.2 to 3.8 s (30% of the time it recentres).
2. **Saccade or pursuit decision** (`Gaze.step` in `src/gaze.ts`). If the target is moving fast, the goal follows it firmly. If it moves slowly and is near, the goal pursues it smoothly. If it is far (more than 0.12 away) and the last saccade was more than 220 ms ago, the goal jumps to the target, aiming 6% short. With a `glide` time (the `free` and `focus` modes), the goal moves along a smooth curve instead, with no saccades.
3. **Eye spring.** The eye position follows the goal on a spring that is slightly underdamped, so a saccade overshoots a little and settles. Microsaccades add small random offsets to the goal at rest.
4. **Slow states.** Attention rises with large saccades, a fast target and a close pointer. Boredom rises while nothing moves.
5. **Reactive shape** (`Brain.step`). The eye's offset is the gaze times 32 px horizontally and 24 px vertically, plus the `eyeX` and `eyeY` fields. The eye stretches and tilts with the gaze velocity (fast attack, slow release). Attention enlarges it. Looking up enlarges it a little, looking down lowers the eyelid, and boredom lowers the eyelid. Convergence moves the eyes together. The `turn` value shifts and shrinks them.
6. **Eyelid clip** (`applyEye` in `src/mount.ts`). Each eye is a rounded rectangle clipped by a polygon. The polygon's top and bottom edges come from `lidTop` and `lidBottom`, and `lidAngle` tilts the top edge. The blink and `closeLeft`/`closeRight` scale the eye's height. A happy eye crossfades from the pill to an arc.

## How parts move

Each part is a two-link chain.

- **Base link.** A stiff spring (stiffness 120, damping 11) rotates the part around its `pivot`. Its target is idle sway, plus the lag from jumping, plus hover and attention, plus the `partC`, `partL` or `partR` field.
- **Tip link.** A softer spring (stiffness 190, damping 8, in `src/parts.ts`) has its own angle. It is pushed when the base link or the body accelerates, so the tip lags and whips. The result is clamped to 38 degrees.
- **Bending.** `bendPath` rotates every point of the part's path around the pivot by `bend * t^2` degrees, where `t` is the point's distance along the pivot-to-tip axis. The base barely moves and the tip moves most, so the part curves.

The `Pose` carries `partC`, `partL`, `partR` (angle of the base link) and `bendC`, `bendL`, `bendR` (angle of the tip link). With `detail: "simple"`, reduced motion or `bend: false`, the tip springs are held at zero.

## How transformations stay seamless

A transformation turns the body into an object (a loading ring, a check, `</>`, an orbit) and back. It is a reaction like any other, made of fields (`src/transformations.ts`). There is no cut because every step is continuous geometry:

1. The body path is interpolated point by point into a circle with the same commands (`circleLike` and `mixPath` in `src/parts.ts`). The circle has radius `ROUND_RADIUS` and is centred on the rig's `anchor`. The `round` field drives this.
2. The parts retract into the body (`retract`) and the eyes shrink to nothing (`eyesVanish`).
3. The circle scales down to the radius of the bubble (`DOT_R`). `DOT_SCALE = DOT_R / ROUND_RADIUS` is the exact scale.
4. At the `swap` frame, the body is hidden and the bubble is shown. It has the same centre, radius and colour, so nothing changes on screen.
5. The bubble is a stroked circle. A disc is a stroke as wide as its radius. Opening a hole (`bubbleHole`) makes a ring, and `bubbleArc` removes part of it. Side dots are born under it. The check and `</>` are strokes as wide as the bubble, drawn with dash offsets (`checkDraw`, `codeDraw`). The orbit dots come out from under it (`orbitOpen`).
6. The exit plays the same steps in reverse.

While `morph` is above 0, the scale pivot moves from the ground to the anchor and the idle goes quiet, so the circle is exactly where the bubble will appear.

## Coordinate space

All rigs share one space (`src/rig.ts`): the viewBox is `190 60 880 990`, the ground is at (627, 960), and `anchor` is (627, 660). The body stands on the ground and its horizontal centre is near x = 627. Reactions, accessories and transformations work for every character because they all use this space.

`characterToRig` (`src/character.ts`) maps a character's 0..100 box into it with a scale of 9.5:

```
x' = 627 + (x - bodyBoxCentreX) * 9.5
y' = 960 + (y - bodyBoxBottom) * 9.5
```

Parts, pivots, tips and eyes use the same transform. The eye's size is derived from `eyes.scale`, the shadow sits at y = 988, and `baseHeight` (the distance from the ground to the base of the parts, used by the tip physics) is 960 minus the mean pivot y, or 0.6 of the body height with no parts. The exact rules are at the end of [`character-format.md`](character-format.md).

## Render a Pose yourself

`Brain` does not read the pointer, the window or the clock. You give it the time and the input, and it returns numbers. To draw the character with canvas, WebGL or another SVG structure, skip `mountCharacter`:

```ts
import { Brain, RIG_FLAME } from "procedural-bot-animations";

const brain = new Brain(RIG_FLAME, { now: performance.now() });

function frame(now: number) {
  const pose = brain.step(now, {
    gaze: null, // or { x, y } from -1 to 1, relative to the character
    hover: false,
    reduced: false,
    mood: { neutral: 1 }, // weights by name
    activity: null,
    detail: "full",
  });
  // pose.rootY, pose.bodySx, pose.bodySy, pose.partL, pose.bendL,
  // pose.leftEye (x, y, sx, sy, lidTop, lidBottom, lidAngle, happy, rot) ...
  draw(pose);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

brain.react("wink", performance.now()); // returns false for an unknown name
```

The `Rig` gives you the geometry (`body`, `appendages`, `eyes`, `eyeStyles`, `ground`, `center`). Read `render` and `applyEye` in `src/mount.ts` for what each `Pose` field means on screen. Pass a `library` in the `Brain` options to use custom animations, and an `rng` to make the randomness repeatable in tests.

## Performance

These are all in the code:

- **One loop.** Every mounted character subscribes to the same `requestAnimationFrame` loop and the same `pointermove` listener (`src/ticker.ts`). When the last one unsubscribes, both stop.
- **Off-screen and hidden tabs.** `mountCharacter` unsubscribes its frame function when an `IntersectionObserver` says the SVG is not on screen, and when `document.visibilityState` is `"hidden"`.
- **Simple detail.** When the character is narrower than 48 px (`size`, or the host width when `size` is not set), `detail` is `"simple"`: no idle sway of the parts, no tip bending, no accessories and no sparks.
- **Page observer only when needed.** The listener for page events (focus, typing, clicks, scroll) runs only while a character uses `gaze: "free"` or `"focus"`.
- **Few DOM writes.** The body path is rewritten only when the `round` morph changes. A part's bent path is rewritten only when its bend changes by 0.08 degrees or more. The body colour is written only when it changes. `update` rebuilds the SVG only for changes that need it (the rig, the visible parts, or one of the colours of the eyes, ink, accent, lamp, rays or grey); other options change attributes.
