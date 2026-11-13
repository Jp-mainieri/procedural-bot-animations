# Motion cookbook

Values below were calibrated on a hand-rigged SVG mascot (Berry, viewBox ~800 units wide) and adapted to Open Bot Avatar's constrained surface: one silhouette, two eyes, and a runtime API of `mood`, `lookAt`, `depth`, `view`. There is no per-part rig to animate — the "life" has to come from those four numbers plus the CSS transform on the element `mountAvatar` fills. Scale amplitudes to your avatar's `size` and to how far away it typically sits from the viewer.

## 1. Base functions

All in `src/spring.ts`: `clamp`, `lerp`, `smooth`, `damp` (exponential, no overshoot — use for anything that should "catch up" without bouncing, like gaze), `spring` (mass-spring-damper, can overshoot — use for anything that should feel physical, like a bounce).

```ts
const target = damp(current, goal, rate, dt); // rate ~5-20 depending on how snappy
spring(state, goal, stiffness, damping, dt); // stiffness ~80-320, damping ~9-22
```

## 2. Calibrated parameters

| Thing | Value |
|---|---|
| Breathing | `breathingDepth(t, baseDepth, { frequency: 0.26, depthAmount: 0.12 })` |
| Gaze damp rate | 9 (follow), wander target every 1.2-3.8 s, 30% chance it recenters |
| Wander activates after | 2.5 s with no live pointer target |
| Blink (only if your renderer doesn't do it itself — Open Bot Avatar's does) | 150 ms, interval 1.8-6 s, 20% double-blink |
| Bounce impulse / gravity | -900 / 3200 (tune gravity up for a "heavier" feel) |
| Landing squash | spring stiffness 320, damping 15, max 0.16 |
| Air stretch | `clamp(-velocityY / 12000, -0.05, 0.1)` |
| Velocity lean | `clamp(velocityX * 0.015, -16deg, 16deg)` |
| Velocity lag (trailing element) | `clamp(-velocityX * 0.02, -25deg, 25deg)` |
| Idle view wobble | `neverRepeating(t, seed) * 0.04` on both yaw and pitch (pitch at half amplitude) |

## 3. Personality → parameters

| Personality | Adjustment |
|---|---|
| Calm / wise | Softer springs (stiffness 70-100, damping 9), slower breathing (frequency 0.15-0.2), gaze rate 5 |
| Jittery / eager | Stiffness 180-220, damping 12-14, amplitudes +50%, wander every 0.6-1.5 s |
| Heavy / large | Higher gravity, lower bounce impulse, bigger landing squash (0.22), less lean |
| Small / cute | Bigger bounce energy (0.45), bigger air stretch, slightly larger gaze range |
| Corporate / understated | Amplitudes -50%, no bounce on hover — gaze and breathing only |

## 4. What each behavior is "doing" on a shape with no rig

- **Breathing** = `depth` oscillation. It's the only parameter that visibly "inflates" the silhouette, so it carries the idle-alive signal that per-part breathing used to.
- **Gaze** = `lookAt`. Follows a pointer when present; `GazeController` falls back to autonomous wandering so the avatar doesn't go dead-eyed the moment the cursor leaves.
- **Head tilt / "thinking" look** = `view.yaw`/`view.pitch` offset on top of the idle wobble, set per state via `StatePreset.viewOffset`.
- **Bounce / squash & stretch** = CSS transform on the *host element* (`translateY`, `scale`), not on the avatar's own geometry. `Bounce` gives you the physics; `bindBotStateMachine` applies it when `host` is provided.
- **Lean / lag** = also host-transform, driven by the host's own velocity (drag, auto-scroll, or the scroll-traveler below).
- **Mood** = `avatar.update({ mood })`, one of Open Bot Avatar's own moods (`idle`/`thinking`/`happy` as of its current API) or whatever its version exposes — map your state machine's richer states onto the moods it actually supports, and use `viewOffset`/bounce/lean to carry the rest of the distinction (e.g. "error" and "idle" might share a mood but differ in head tilt and whether bounce fires).

## 5. Scroll traveler

For a bot that moves between landing-page sections as the user scrolls, rather than staying fixed:

1. Mark invisible `.slot` elements in your layout, each with `data-name` and optionally `data-mood`. The slot's size is the avatar's size there.
2. Every frame, read each slot's `getBoundingClientRect()`, add `window.scrollX/scrollY` to get document-relative rects, and call `findActiveSlot(slots, scrollY, viewportHeight)` to get the current index, plus your own progress-to-next-slot calculation (e.g. based on how far the next slot's rect has entered the viewport).
3. `travelerFrame(slots, activeIndex, progress)` returns `{ x, y, scale, directionX, mood, flight }`. Apply `x`/`y`/`scale` to the host's `position: fixed` transform, feed `directionX` into `velocityLean`, and switch mood per `travelerFrame`'s output.
4. On mobile, where slots stack vertically, the same function works unchanged — `y` carries the travel instead of `x`.

## 6. Common mistakes

- Driving everything off one `sin(t)` — reads as mechanical. `neverRepeating` sums several incommensurate frequencies on purpose; give each avatar instance on a page a different `seed` too.
- Forgetting `safeDt` — an unclamped `dt` after a backgrounded tab makes springs explode on return.
- Mixing CSS `@keyframes` and this library's JS-driven `transform` on the same host element — they fight. Pick one.
- Treating `mood` as the only source of expression. Open Bot Avatar's mood set is small by design; the state machine's job is to layer `viewOffset`, bounce and lean on top so more states feel distinct than moods exist.
- Not testing `prefers-reduced-motion` — breathing, wander and bounce should all stop; only the discrete pose/mood change should remain.
