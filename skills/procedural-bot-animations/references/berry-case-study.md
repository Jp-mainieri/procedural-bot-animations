# Case study: Berry (DevBerry)

`examples/berry-live/` is a faithful, working port of DevBerry's actual mascot — not a lookalike, not an approximation. It exists because the single-silhouette engine this skill ships (`src/`) cannot reproduce a multi-part rig, and the clearest way to show that boundary honestly is to put the real thing next to it.

## What's ported, and from where

Everything in `examples/berry-live/` is sourced from DevBerry's `lib/berry/` on branch `feat/berry-simulador-mascote` (confirmed identical to `main` at the time of writing), with Portuguese identifiers translated to English and formulas otherwise unchanged:

| File | Ported from | What |
|---|---|---|
| `berry-rig.js` | `lib/berry/rig.ts` | `RIG_BERRY`: the body silhouette, all 3 leaf paths with pivot/tip, eye placement and size — byte-for-byte the same coordinates, no rescaling |
| `berry-motor.js` | `lib/berry/motor.ts` | `clamp`/`lerp`/`smooth`/`damp`/`spring`, the blink scheduler (`stepBlink`, including its sine-shaped close-open curve), and the jump/squash physics (`launch`/`stepJump`: impulse -1500, gravity 5200, 32% bounce, squash spring k=320/c=15) |
| `berry-motor.js` | `lib/berry/folhas.ts` | The leaf tip's own spring (`stepTip`: lags the base's rotation and reacts to the body's vertical acceleration) and the path-bending function (`bendPath`) that curves a leaf's actual SVG points around its pivot — not a rigid rotation |
| `berry-motor.js` | `lib/berry/motor.ts` | `track`/`fromTracks` (originally `trilha`/`deTrilhas`): the keyframe system DevBerry's own reactions are built from — `[t 0..1, value, curveName?]` tuples per named field, piecewise-interpolated |
| `berry-reactions.js` | `lib/berry/reacoes.ts` | Three of DevBerry's ~15 "Pumpy-style personality" reactions, each a `fromTracks`-built function of progress `t`: `wink` (`piscadela`), `flatten` (`achatar`), `somersault` (`cambalhota`) — picked for variety, not because the rest don't port the same way |
| `berry-live.js` | — (this project's own) | Wires the above into a running character: idle leaf sway, gaze (pointer-follow + autonomous wander), breathing, jump-on-click, and a single-slot reaction player. DevBerry's own `cerebro.ts` wires in app-specific triggers (Piston results, Danki cards) and the full 9-mood blend + ~15-reaction catalog (`reacoes.ts` is 1932 lines); none of that orchestration is reproduced here, only the primitives and three sample reactions |

## What this is not

- Not part of the installable `procedural-bot-animations` package. It imports nothing from `src/` or `dist/` — it's standalone, plain JS.
- Not the full Berry. Only 3 of DevBerry's ~15 reactions are ported (see the table above); `cerebro.ts` (672 lines) and the rest of `reacoes.ts` (1932 lines total) hold the full mood-blending orchestration and the remaining reactions (susto, "colou, é?", the bubble→checkmark/code morph, confetti) — tied to the DevBerry app's own events and not meaningfully portable to a generic demo as a whole, though any individual reaction in there follows the same `fromTracks` pattern and ports the same way these three did.
- Not a replacement for Open Bot Avatar. Berry's body has no relationship to the Open Bot Avatar JSON format; the two live side by side in this repo as two different kinds of input the same engine family can drive — one single-silhouette (`src/`, driving Open Bot Avatar shapes), one multi-part (`examples/berry-live/`, driving Berry).

## Why this matters for your own character

If your character is a single flat silhouette with eyes (anything you'd model in Open Bot Avatar), use `src/` — that's what it's for. If it has separate moving parts (limbs, ears, a tail), the pattern in `berry-live.js` is the one to copy: give each part a base-rotation spring toward an idle target, a secondary tip spring that reacts to the base's own motion (`stepTip`'s `dBaseVel`/`dBodyVy` arguments), and bend the part's actual path points around its pivot (`bendPath`) rather than only rotating it as a rigid piece — that's what makes it read as bending instead of swinging.
