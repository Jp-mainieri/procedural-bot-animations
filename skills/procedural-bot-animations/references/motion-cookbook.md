# Motion cookbook

Calibrated values for the engine in `src/`, which renders a silhouette-plus-eyes definition itself (`mountRig`) and drives it with `moods.ts`/`reactions.ts`/`gaze.ts`/`fake3d.ts`, composed by `brain.ts`. For a character with separate moving parts (limbs, ears, leaves), see `references/berry-case-study.md` instead — these values don't transfer to a rig.

## 1. Base functions

All in `src/spring.ts`: `clamp`, `lerp`, `smooth`, `damp` (exponential, no overshoot — use for anything that should "catch up" without bouncing), `spring` (mass-spring-damper, can overshoot — use for anything that should feel physical).

```ts
current = damp(current, target, rate, dt); // rate ~5-20 depending on snappiness
spring(state, target, stiffness, damping, dt); // stiffness ~80-320, damping ~9-22
```

## 2. Calibrated parameters

| Thing | Value | Where |
|---|---|---|
| Breathing | `frequency: 0.26`, `depthAmount: 1` → ±2% body scale | `noise.ts#breathing`, used by `brain.ts` |
| Gaze pursuit rate | 9 | `GazeEngine` |
| Gaze saccade spring | stiffness 260, damping 16 (slight overshoot, then settles) | `GazeEngine` |
| Microsaccade jitter | 0.015 | `GazeEngine` |
| Wander | new target every 1.2-3.8s; 30% chance it recenters; after 2.5s idle | `GazeEngine` |
| Boredom onset | 4s with no explicit gaze target | `GazeEngine` |
| Fake-3D turn | max eye slide 6 units; far eye shrinks 40%; near eye grows 12%; body lean 2° | `fake3d.ts` |
| Mood blend rate | 5 (1/seconds) | `MoodBlender` |
| Bounce reaction | duration 0.55s, peak height 18 units, squash ~0.16, priority 1 | `reactions.ts#bounce` |
| Fright reaction | duration 0.5s, priority 3 (interrupts almost anything) | `reactions.ts#fright` |
| Reaction queue | one pending slot; dropped if older than 1.6s when its turn comes | `ReactionPlayer` |

## 3. What each behavior actually touches

Open Bot Avatar's own API (`mood`, `lookAt`, `depth`, `view`) is not used at all here — `src/render.ts` draws the body path and two eye groups itself, so moods and reactions can deform the eyes directly instead of being limited to a 3-string mood enum:

- **Breathing** = `body.scaleY`/`scaleX` oscillation (`brain.ts`), not a separate "depth" concept.
- **Gaze** = eye `offsetY` directly, and eye `offsetX` indirectly through `fakeTurn` (see below) — `GazeEngine` output feeds both.
- **Fake-3D turn** = `fake3d.ts#fakeTurn(turn)`: slides both eyes toward the gaze's horizontal direction and shrinks the far one / grows the near one, the same illusion as rotating a flat silhouette's "head". Driven by gaze's `offset.x`, not a separate control.
- **Moods** = `moods.ts`: each named mood is a full-weight (`eyeScaleY`, `eyeArcAmount`, `bodyY`, ...) delta; `blendMoods` lerps each active mood's contribution by its own weight and multiplies/sums them together, so e.g. `curious` + `sleepy` can be active at once — unlike Open Bot Avatar's single `mood` string.
- **Reactions** = `reactions.ts`: closed-form curves of progress `t` (not live spring integration), queued one at a time by `ReactionPlayer` with a priority and staleness rule.
- **Blink** = `blink.ts#BlinkScheduler`, always running (this engine draws its own eyes, so nothing blinks on its own the way Open Bot Avatar's runtime would).

## 4. Personality → parameters

| Personality | Adjustment |
|---|---|
| Calm / wise | Lower `gaze.pursuitRate` (~5), longer `wanderIntervalSeconds`, slower `breathing.frequency` |
| Jittery / eager | Higher `gaze.pursuitRate` (~16), shorter wander interval, faster breathing, frequent `react("bounce")` |
| Corporate / understated | Skip reactions entirely; moods only, smaller `fakeTurn.maxSlide` |

## 5. Scroll traveler

For a bot that moves between landing-page sections as the user scrolls: see `src/scroll-traveler.ts` (`travelerFrame`/`findActiveSlot`), which is independent of the render/brain layers above — it only computes position/scale/mood-by-section numbers from slot rects you read yourself.

## 6. Common mistakes

- Driving gaze off a single `sin(t)` — `GazeEngine`'s wander already sums randomized targets; don't add your own periodic motion on top, it'll look mechanical.
- Forgetting `safeDt` — already applied inside `bindBrain`, but if you call `Brain.update` yourself, clamp your own `dt`.
- Calling `brain.setMood({ proud: 1 })` to turn a mood on, then `brain.setMood({})` to turn it off — `setMood` **merges** into existing targets, it doesn't replace them. Turning a mood off means passing it explicitly at weight 0: `brain.setMood({ proud: 0 })`.
- Not testing `prefers-reduced-motion` — breathing, wander, blink and reactions should all stop; only the discrete mood/pose change should remain.
