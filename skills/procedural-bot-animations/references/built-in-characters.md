# Built-in characters

Two characters ship with the package as `Rig` objects: `RIG_BERRY` and `RIG_FLAME` (`src/characters/`). Both are [DevBerry](https://devberry.app)'s mascots, included with the owner's permission. The engine they run on is a generic port of DevBerry's mascot engine.

```ts
import { mountCharacter, RIG_BERRY, RIG_FLAME } from "procedural-bot-animations";

mountCharacter(host, { rig: RIG_BERRY, color: "#e11d2e" });
mountCharacter(host, { rig: RIG_FLAME, color: "#f97316" });
```

Colours are not part of a rig. Pass `color` (any CSS colour). The default is `#e11d2e`.

## Berry

A rounded body with three leaves on top.

| Property | Value |
|---|---|
| `id` | `berry` |
| Parts | `C` (middle leaf), `L` (left leaf), `R` (right leaf) |
| Idle sway | `amp` `1`, `freq` `1` |
| Flicker | `0` (a firm body) |
| Light core | none |
| Eye styles | `classic` (80 by 160), `pumpy` (82 by 124), `big` (100 by 176, tilted 14 degrees) |

Berry's hover gestures are `hop`, `peek`, `shy` and `doubleHop`. Its click gestures are `hop`, `laugh`, `wink` and `somersault`. Quick clicks trigger `huff` on the 3rd, `dizzy` on the 5th and `hide` on the 8th.

## Flame

A flame with three tongues and a lit core.

| Property | Value |
|---|---|
| `id` | `flame` |
| Parts | `C` (main tongue), `L`, `R` |
| Idle sway | `amp` `2.4`, `freq` `2.6` |
| Flicker | `1` (the body flickers) |
| Light core | yes (`core` path; the `glow` option keeps it lit) |
| Eye styles | `classic` (80 by 140), `pumpy` (86 by 112), `big` (100 by 156, tilted 14 degrees) |

Flame's hover gestures are `warmUp`, `hop`, `crackle` and `peek`. Its click gestures are `hop`, `crackle`, `laugh`, `wink` and `sneeze`. Quick clicks trigger `heatUp` on the 3rd, `dizzy` on the 5th and `burst` on the 8th.

## Which reactions need what

Every reaction works on every rig, because reactions only name fields. A rig whose `id` is neither `berry` nor `flame` uses Berry's hover and click gestures.

These reactions use the flame effect fields (`core`, `embers`, `smoke`, `gray`) and only look complete on Flame:

| Reaction | Effect fields it uses |
|---|---|
| `ignite` | `embers`, `core` |
| `extinguish` | `smoke` |
| `blaze` | `core`, `embers` |
| `crackle` | `embers` |
| `sneeze` | `embers` |
| `tierUp` | `core` |
| `warmUp` | `core`, `embers` |
| `heatUp` | `core`, `embers` |
| `burst` | `gray`, `smoke`, `embers` |

`core` is only drawn when the rig has a core path, which only Flame has. `embers` and `smoke` rise from the tip of the middle part (or from the accessory point if there is none), so they also show on other rigs. `gray` mixes the body colour toward the `grayColor` option on any rig.

The activities `flickering` (a flame at risk) and `out` (a grey ember) use `gray` and `smoke` too.

## Using them as a starting point

`RIG_BERRY.eyeStyles` and `RIG_FLAME.eyeStyles` show the proportions the JSON format derives for `pumpy` and `big` from `classic`. To make a new character, do not copy a rig by hand. Write character JSON ([`generate-character.md`](generate-character.md)); `characterToRig` builds the rig, in the same coordinate space.
