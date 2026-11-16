# Motion cookbook

Calibrated values from the engine in `src/`. Every number below can be found with a grep in the file named next to it. Units: gaze values run from -1 to 1, positions are in drawing px (the viewBox is 880 wide), angles are in degrees, and times are in seconds unless marked `ms`.

## 1. Building blocks (`src/motion.ts`)

| Function | Use |
|---|---|
| `damp(current, target, rate, dt)` | Exponential catch-up. No overshoot. Rate is 1/s |
| `spring(m, target, k, c, dt)` | Stiffness `k`, damping `c`. Overshoots when `c` is below `2 * sqrt(k)`. Mutates `m` (`{ a, v }`) |
| `smoothDamp(m, target, time, dt)` | Critically damped, no jerk, arrives in about `time` seconds. Used for anything that must not flicker |
| `stepHold(h, input, now, holdMs, releasePerSecond, dt)` | A peak that holds, then releases slowly |
| `track(keyframes)` / `fromTracks(tracks)` | Keyframe interpolation. Curves: `linear`, `easeIn`, `easeOut`, `smooth` (default) |
| `newBlink` / `stepBlink` | The blink scheduler |
| `launch` / `stepJump` | Jump with gravity, a short bounce and a landing squash |

## 2. Eyes (`src/gaze.ts`)

| Thing | Value |
|---|---|
| Eye spring | stiffness `K = 900`, damping `C = 2 * sqrt(K) * 0.62` (slightly underdamped) |
| Saccade threshold | the eye hops when the target is more than `0.12` away |
| Minimum time between saccades | `220` ms |
| Saccade aim | `0.06` of the distance short of the target |
| Smooth pursuit | target speed below `3`, distance below `0.35`: the goal follows at rate `10` |
| Fast pursuit | target speed `3` or more, distance below `0.6` (`MAX_PURSUIT_LAG`): the goal follows at rate `14` |
| Blink on a saccade | distance above `0.9`, with probability `0.35` |
| Microsaccades | every `500` + up to `1100` ms, an offset of `(random - 0.5) * 0.04` horizontally and `* 0.034` vertically, only when the last saccade was over `400` ms ago |
| Attention from a saccade | `min(0.45, distance * 0.35)` per saccade |
| Attention from a close cursor | settles toward `proximity * 0.6` at rate `1.3` |
| Boredom | grows by `dt / 7` while the target speed is under `0.05`, the last saccade was over `3000` ms ago and attention is under `0.25` |
| Convergence (cross-eyed) | starts at proximity `0.75`, full at `1` |
| Glide (`free` and `focus` modes) | the goal moves with `smoothDamp` over the glide time; microsaccades of the same size return on arrival |

## 3. Blink (`src/motion.ts`)

| Thing | Value |
|---|---|
| Duration | `150` ms (`BLINK_DURATION`) |
| First blink | `1500` ms after the brain is created |
| Interval | `1800` + up to `4200` ms (1.8 to 6 s) |
| Double blink | `0.2` probability; the second starts `90` ms after the first |
| Shape | `sin(phase * PI)`; the eye height shrinks by up to `0.93` of itself (`src/brain.ts`) |
| Off | with reduced motion, and while sleeping (the `sleeping` activity or the nap, at weight `0.5` or more) |

## 4. How the eye reacts (`src/brain.ts`)

| Thing | Value |
|---|---|
| Eye offset from the gaze | `x * 32`, `y * 24` px |
| Eye size with attention | `1 + 0.16 * attention`, and `0.06 * attention` more in height |
| Stretch along a saccade | up to `0.3`, rising from a gaze speed of `2` to full at `9`; attack `0.05` s, release `0.22` s |
| Tilt along a saccade | up to `16` degrees; attack `0.06` s, release `0.45` s |
| Looking up | height `+0.07 * up`. Looking down: height `-0.04 * down`, and the top lid `+0.16 * down` |
| Boredom | top lid `+0.3 * boredom`, height `-0.06 * boredom` |
| Attention on the lid | top lid `-0.15 * attention` |
| Convergence | each eye moves `16` px toward the centre and tilts `9` degrees |
| Face turn (`turn`) | the eye on the side it turns toward shrinks up to `0.3` at `turn` `1`; between `1` and `1.6` the face goes to profile and one eye vanishes |

## 5. Hold-then-release (`stepHold` in `src/brain.ts`)

States that come and go quickly are held, so the eye does not flicker between two shapes.

| State | Hold | Release per second | Then smoothed with |
|---|---|---|---|
| Cursor `near` | `900` ms | `1.2` | `smoothDamp` `0.3` s |
| `attention` | `1200` ms | `0.8` | `smoothDamp` `0.35` s |
| `hover` | `600` ms | `2` | `smoothDamp` `0.25` s |

Other smoothing times in the brain: mood weights `0.45` s, activity weights `0.4` s, boredom `0.8` s, convergence `0.35` s, cuddle `0.6` s, nap `0.9` s. A replaced reaction fades out over `350` ms (`REACTION_FADE_MS`). The frame time `dt` is limited to `0.05` s.

## 6. Hover and click (`src/interactions.ts`, `src/brain.ts`, `src/mount.ts`)

| Thing | Value |
|---|---|
| Pause between hover gestures | `1200` ms (`HOVER_PAUSE_MS`) |
| A queued gesture expires after | `1600` ms (`PENDING_VALIDITY_MS`) |
| Quick clicks count as a chain when less than | `700` ms apart (`CLICK_CHAIN_INTERVAL_MS`) |
| Click chain reactions | the 3rd, 5th and 8th click (Berry: `huff`, `dizzy`, `hide`; Flame: `heatUp`, `dizzy`, `burst`) |
| Cuddle (happy eyes, a slow sway) | pointer resting for `2500` ms (`HOVER_CUDDLE_MS`) |
| Nap | pointer resting for `9000` ms (`HOVER_NAP_MS`) |
| Touch: hover state after a tap | `900` ms |
| Pointer counts as "recent" for | `2500` ms |
| Proximity range | `1.8` times the character width |

Gestures are drawn by weight and never repeat the last one. Hover and click gestures wait for a reaction to end instead of cutting it. App reactions (`react`) enter at once.

## 7. Parts (`src/brain.ts`, `src/parts.ts`)

| Thing | Value |
|---|---|
| Base spring | stiffness `120`, damping `11` |
| Tip spring | stiffness `190`, damping `8` (`K_TIP`, `C_TIP`) |
| Tip lag from rotation | `0.55` (`ROTATION_LAG`) |
| Tip lag from vertical acceleration | `0.14` (`VERTICAL_LAG`) |
| Largest bend | `38` degrees (`MAX_BEND`) |
| Idle sway, middle part | `3 * sin(s * 1.1 * f) + 1.5 * sin(s * 2.3 * f + 1)` degrees, times the rig's `idle.amp` |
| Idle sway, left and right | amplitude `2.5`, frequencies `0.9` and `1.0` |
| Hover | left `+20`, right `-20` degrees |
| Attention | left `+10`, right `-10` degrees |
| Boredom | left `-7`, right `+7` degrees |
| Berry's idle | `amp` `1`, `freq` `1` |
| Flame's idle | `amp` `2.4`, `freq` `2.6`, `flicker` `1` |

## 8. Body, jump and breathing (`src/brain.ts`, `src/motion.ts`, `src/mount.ts`)

| Thing | Value |
|---|---|
| Breathing | `sin(s * 1.65)`; `bodySy` by `0.024`, `bodySx` by `-0.012` |
| Gaze lean | `bodyRotate` by `look.x * 2.2` degrees |
| Wander (no target) | a new point every `1200` + up to `2600` ms; `0.3` probability of recentring; x up to `0.8` |
| Jump | gravity `5200`, default launch speed `-1500`, bounce `0.32` of the impact speed |
| Landing squash | up to `0.16`, from `impact / 9000`; spring `-320`, `-15` |
| Gaze target scale | the pointer offset is divided by `0.35` of the window size |
| Simple detail | below `48` px wide: no part sway, no tip bending, no accessories |

## 9. Built-in moods (`src/moods.ts`, weight 1)

| Mood | Main fields |
|---|---|
| `curious` | `eyeSy` `0.1`, `eyeSx` `0.08`, `partC` `9`, `turn` `0.25` |
| `focused` | `lidTop` `0.22`, `lidAngle` `6`, `partAmp` `-0.6` |
| `suspicious` | `lidTop` `0.42`, `lidBottom` `0.12`, `lidAngle` `18`, `turn` `-0.3` |
| `sleepy` | `lidTop` `0.58`, `lidAngle` `-6`, `eyeY` `10`, `rootY` `6` |
| `proud` | `happy` `1`, `partL` `12`, `partR` `-12`, `eyeY` `-6` |
| `downcast` | `lidTop` `0.28`, `lidAngle` `-16`, `eyeY` `16`, `rootY` `10` |
| `angry` | `lidTop` `0.34`, `lidAngle` `26`, `eyeSy` `-0.05` |
| `smiling` | `lidBottom` `0.3`, `eyeSy` `0.04` |

The expression comes from the eyelids, not from the eye size. Moods blend by weight, so `{ curious: 0.5, sleepy: 0.5 }` is valid.

## 10. Reaction magnitudes (`src/reactions.ts`)

| Reaction | Real numbers |
|---|---|
| `success` (lesson) | duration `1.6` s. Jump `rootY` `-170` (exercise `-110`, module `-220`). Parts `26` (exercise `20`, module `32`). Squash on the first push `bodySy` `-0.16`, `bodySx` `0.12`; on landing `bodySy` `-0.18`, `bodySx` `0.14`. `happy` `1`. Sparks at the end |
| `fright` | duration `0.9` s. `rootY` `-45`. Eyes shrink to dots: `eyeSx` `-0.45`, `eyeSy` `-0.62`. Parts `24`. `exclaim` `1` |
| `wink` | duration `1.2` s. `happyRight` `1`, `lidBottom` `0.25`, `rootY` `-26`, `bodyRotate` `7`, `partR` `-22`, `turn` `0.35` |

## 11. Personality to parameters

| Personality | What to change |
|---|---|
| Calm | Lower `rig.idle.amp` and `freq`. Use moods such as `sleepy` or `focused`. Prefer `gaze: "focus"` |
| Eager | Higher `rig.idle.freq`. Try the `big` or `pumpy` `eyeStyle`. React often |
| Fire or restless | `rig.flicker` up to `1`, and a high `idle.freq` (Flame uses `2.6`) |
| Understated | Use moods only, no reactions. Set `interactive: false` |
| Different eye shape | `eyeStyle: "classic"`, `"pumpy"` or `"big"`, or override `rig.eyeStyles` in the character JSON |

## 12. Common mistakes

- Adding your own periodic motion on top of the gaze. The brain already wanders and makes microsaccades; a sine on top looks mechanical.
- Expecting `update({ mood })` to merge. It replaces the previous `mood`. To clear it, pass `{}` or `"neutral"`.
- Putting a transformation field (the `morph` group) in a hand-made reaction. These fields only look right when many are choreographed together. Use the built-in `morphCheck`, `morphLoading`, `morphCode` or `energy`.
- A reaction whose last keyframe is not exactly 0. It would leave the character off-pose after it ends. The validator rejects it.
- Raising `holdGaze` for most of a reaction. The eyes stop following the target. Release it before the end.
- Testing only with motion on. Check `reducedMotion: true`: the movement fields are zeroed and only expression changes remain.
