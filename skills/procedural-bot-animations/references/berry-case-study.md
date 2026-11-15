# Case study: Berry (DevBerry)

`examples/berry-live/` is a faithful, working port of DevBerry's actual mascot and its simulator — not a lookalike, not an approximation. It exists because the single-silhouette engine this skill ships (`src/`) cannot reproduce a multi-part rig, and the clearest way to show that boundary honestly is to put the real thing next to it, running the real logic.

Try it live: [`berry-demo.html`](../../examples/berry-live/berry-demo.html) — a simulator combining DevBerry's own dev-preview controls (mood, activity, reaction and interaction panels; a focus-mode test field) with the stage-plus-tabbed-panel layout from [Open Bot Avatar's editor](https://dominikscholz.github.io/open-bot-avatar/).

## What's ported, and from where

Everything in `examples/berry-live/` is sourced from DevBerry's `lib/berry/` on branch `feat/berry-simulador-mascote` (confirmed identical to `main` at the time of writing), with Portuguese identifiers translated to English and formulas otherwise unchanged:

| File | Ported from | What |
|---|---|---|
| `berry-rig.js` | `lib/berry/rig.ts` | `RIG_BERRY`: the body silhouette, all 3 leaf paths with pivot/tip, eye placement and size, leg height, idle amplitude — byte-for-byte the same coordinates, no rescaling |
| `berry-motor.js` | `lib/berry/motor.ts` | `clamp`/`lerp`/`smooth`/`damp`/`spring`, `track`/`fromTracks` (keyframe tracks, originally `trilha`/`deTrilhas`), the blink scheduler, jump/squash physics, `smoothDamp` (SmoothDamp, originally `suavizar`) and `stepHold` (hold-then-release, originally `passoSegurar`) |
| `berry-motor.js` | `lib/berry/folhas.ts` | The leaf tip's own spring (`stepTip`) and the path-bending function (`bendPath`) that curves a leaf's actual SVG points around its pivot |
| `berry-delta.js` | `lib/berry/delta.ts` | The full additive pose-delta field list and `zero`/`sum` (as `zeroDelta`/`addDelta`) |
| `berry-moods.js` | `lib/berry/humores.ts` | All 9 continuous, weight-blendable moods |
| `berry-gaze.js` | `lib/berry/olhar.ts` | `Gaze` (originally `Olhar`): real saccade/pursuit/microsaccade eye physics, attention/boredom, convergence — the single most load-bearing file for "the eyes look right" |
| `berry-focus.js` | `lib/berry/foco.ts` | The `free`/`focus` gaze modes: page-event tracking (focus, typing, clicks, scroll), focus anchors via `data-berry-focus`, wandering to visible elements |
| `berry-interactions.js` | `lib/berry/interacoes.ts` | Berry's hover/click gesture tables, the weighted no-repeat picker, the cuddle/nap hover states |
| `berry-reactions.js` | `lib/berry/reacoes.ts` | 21 of Berry's reactions (all of them except the Chama's) and all 3 of its loop activities (`thinking`/`loading`/`sleeping`) |
| `berry-brain.js` | `lib/berry/cerebro.ts` | `BerryBrain` (originally `CerebroBerry`): the real orchestrator — mood/activity blending, the reaction queue with fade-out, the hover/click gesture state machine (busy/pending/chain), gaze composition, leaf spring targets, the full reactive eye formula (3D turn, lids, saccade-driven stretch/tilt) |
| `berry-live.js` | — (this project's own) | The DOM binder: renders the rig as SVG and applies `BerryBrain`'s pose every frame; owns pointer/hover/click wiring |

## What this is not

- Not part of the installable `procedural-bot-animations` package. It imports nothing from `src/` or `dist/` — it's standalone, plain JS.
- Not the Chama. DevBerry's sibling flame character has its own rig, reactions (`acender`, `apagar`, `labareda`, `crepitar`, `espirrar`, ...) and activities (`vacilando`, `apagada`) — not ported.
- Not the object-morph transformations. `lib/berry/transformacoes.ts` (the Pumpy-style grammar: the body becomes a perfect circle, shrinks into a bubble, and the bubble becomes a loading ring, a checkmark, or `</>`) is the one real system left out. It's both the most complex piece (continuous path-geometry interpolation between a silhouette and a circle, radial point/ring/stroke drawing) and the most tied to a specific product UI (a loading/success/code-result indicator) — `BerryBrain`'s `react()` drops the corresponding queue-during-transformation branch for the same reason. Everything else — moods, activities, the gesture picker, gaze, all 21 non-Chama reactions, and every spring/physics primitive — is intact.
- Simplified eyelid rendering. DevBerry's real renderer clips the eye with actual eyelid paths; `berry-live.js` approximates `lidTop`/`lidBottom` as a visible-height fraction plus a vertical center shift, and folds `lidAngle` into the eye's own rotation instead of tilting the lid independently. The pose math (`berry-brain.js`) is exact; only this one rendering step is an approximation.
- Simple text accessories. The lamp/`!`/`?`/`…`/`zzz` accessories render as plain text glyphs, not DevBerry's illustrated icons, and sparks/rays aren't rendered at all (the pose data for them still flows through, for anyone who wants to add the visuals).

## Why this matters for your own character

If your character is a single flat silhouette with eyes (anything you'd model in Open Bot Avatar), use `src/` — that's what it's for. If it has separate moving parts (limbs, ears, a tail), the pattern in `berry-brain.js`/`berry-live.js` is the one to copy:

- Give each part a base-rotation spring toward an idle target (`berry-brain.js`'s leaf `targets` + `spring`), and a secondary **tip** spring that reacts to the base's own motion (`stepTip`'s `dBaseVel`/`dBodyVy` arguments) — that's what makes a leaf lag and whip instead of moving rigidly with the body.
- Bend the part's actual path points around its pivot (`bendPath`) rather than only rotating it as a rigid piece.
- Drive the eyes with a real `Gaze` (saccade for a target that jumped, pursuit for one that's moving, constant microsaccades at rest, attention/boredom as slow states) instead of a single damped follow — this is the single change most responsible for "the eyes look alive" versus "the eyes are glued to a cursor."
- Keep moods, activities and reactions as three separate additive layers (continuous weight-blended, continuous loop, one-shot-with-fade) summed into one pose each frame, rather than one state machine that picks a single "current pose."
