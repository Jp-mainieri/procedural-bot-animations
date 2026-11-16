# Character format

A character is one JSON object: a silhouette, two eyes and, optionally, a few moving parts. The engine turns it into a rig (`characterToRig`), so anything you can describe here can be animated by every built-in reaction, mood and activity.

The core keys (`version`, `id`, `name`, `body`, `eyes`) are exactly an [Open Bot Avatar](https://github.com/dominikscholz/open-bot-avatar) definition: any valid Open Bot Avatar definition is accepted unchanged. The optional `rig` key is this engine's extension; Open Bot Avatar ignores it.

Use it from code:

```ts
import { validateCharacter, characterToRig, parseCharacter } from "procedural-bot-animations";

const result = parseCharacter(jsonText);          // never throws
if (result.ok) use(result.value.rig);             // result.warnings lists non-blocking notes
else console.log(result.errors);                  // every problem, each starting with its JSON path
```

## Coordinate space

Everything is drawn in a **0..100 box**: x grows to the right, y grows downward, (0,0) is the top-left corner. Use the box generously: the body should span roughly 20..90 and stay inside 8..92.

The engine scales the box by 9.5 and puts the character on the stage: the **lowest point of the body ends up on the ground**, and the **horizontal centre of the body's bounding box is the stage centre**. Where you place the character inside the 0..100 box does not matter; only its shape and the relative positions of the eyes and parts do.

## Top-level keys

| Key | Type | Rule |
|---|---|---|
| `version` | number | Must be `1`. |
| `id` | string | Lowercase slug, 1 to 40 characters from `[a-z0-9-]`, starting with a letter or digit (`/^[a-z0-9][a-z0-9-]{0,39}$/`). |
| `name` | string | 1 to 60 characters after trimming; no control characters, no `<` or `>`. |
| `body` | object | `{ "path": "..." }`, see below. |
| `eyes` | object | `{ "x", "y", "spacing", "scale" }`, see below. |
| `rig` | object, optional | The extension, see below. |

Unknown keys (at any level) are **warnings**, never errors: they are ignored.

## `body.path`

An SVG path string describing the silhouette, filled with the non-zero rule.

- Commands: `M L H V C S Q T A Z`, absolute or relative, implicit repeats allowed (`M0 0 10 0 10 10`), several subpaths allowed (a second subpath wound the opposite way cuts a hole).
- Close every subpath with `Z`. An unclosed subpath is closed automatically (as Open Bot Avatar does) and reported as a warning: `body.path: subpath 1 is not closed; closed automatically`.
- At most 6000 characters, 400 segments (commands), 16 subpaths.
- Every coordinate (including control points) between -20 and 120.
- The outline's bounding box must be at least 30 x 30. It must stay inside 6..94 on every side (error); outside 8..92 is a warning.
- The engine converts it internally to absolute `M`, `L`, `C`, `Z` commands: `Q`, `T`, `S` become exact cubics and arcs become cubic segments of at most 90 degrees. You do not need to do this yourself.

Design tips: a bold flat silhouette reads best. A few cubic curves (`C`) are enough; 20 segments or fewer is typical. The body is the only filled shape (the eyes are drawn on top), and the character stands on its lowest point, so give it a flat or gently rounded bottom.

## `eyes`

The face is two pill-shaped eyes. At `scale` 1 each eye is **5.5 wide x 11 tall** in the 0..100 box; at `scale` s it is `5.5*s x 11*s` (the width is half the height, like the built-in Berry). The height is Open Bot Avatar's, but the pill is deliberately wider than the 4-wide one Open Bot Avatar draws: a thin pill makes eyelids and the happy arc hard to read.

**Make the eyes big.** Eyes are the most expressive part of the engine. Aim for an eye height of **24-28 % of the body's height** (Berry: 28 %), centres **26-32 % of the body's width** apart, set slightly below the vertical middle of the face area. For a body of height H, `scale = 0.26 * H / 11`. The eyes should still sit well inside the body, including in the `big` style, which is wider and taller than the resting pill.

| Key | Rule |
|---|---|
| `x`, `y` | Centre of the pair, numbers 0..100. |
| `spacing` | Distance between the two eye centres, 4..60, and at least `6.05 * scale` (the eye width `5.5 * scale` plus a 10 % gap, so the eyes do not overlap). |
| `scale` | 0.4..3. |

The left eye is centred at `(x - spacing/2, y)`, the right at `(x + spacing/2, y)`.

**Both eyes must lie fully inside the body's filled area**, with a small margin (0.8 units). The check samples a ring around each pill; if it fails you get `eyes: the left eye (...) pokes outside the body near (...)`: move `eyes.x`/`eyes.y` toward the middle of the body, or reduce `spacing` or `scale`. Eyes sitting over a hole in the body fail too.

## `rig` (optional extension)

```text
"rig": {
  "parts":     [ { "role": "C"|"L"|"R", "path": "...", "pivot": [x, y], "tip": [x, y] } ],
  "eyeStyles": { "classic"|"pumpy"|"big": { "w", "h", "tilt", "dx", "dy" } },
  "idle":      { "amp": 1, "freq": 1 },
  "flicker":   0,
  "color":     "#rrggbb"
}
```

### `rig.parts`

Moving appendages (leaves, antennas, ears, flame tongues) attached to the body. At most 3, **one per role**: `C` (middle), `L` (left), `R` (right). Reactions and moods drive them through the fields `partC`, `partL` and `partR`; the idle animation makes them sway.

| Key | Rule |
|---|---|
| `role` | `"C"`, `"L"` or `"R"`, each at most once. |
| `path` | A closed SVG path with the same rules as `body.path`, but a single subpath, and no size or safe-area minimums. |
| `pivot` | `[x, y]`, the hinge. Must be inside the body's bounding box (or within 3 units of it). |
| `tip` | `[x, y]`, the free end. At least 4 units away from `pivot`. |

The part bends along the line from `pivot` to `tip`. **Make the base of every part overlap the body**: draw the part so its lower end sits well inside the body's outline (body and part share the same fill), and put the `pivot` there too. Then bending the part never opens a gap between it and the body. Parts are drawn in the body's colour.

### `rig.eyeStyles`

The engine has three eye shapes: `classic` (the resting pill, derived from `eyes.scale`), `pumpy` (shorter and a bit wider, shifted) and `big` (larger and tilted). They are derived automatically; override only what you need. All keys optional, all numbers:

| Key | Unit | Range |
|---|---|---|
| `w` | width, 0..100 units | 0.5..40 |
| `h` | height, 0..100 units | 0.5..60 |
| `dx` | shift toward the centre (mirrored: positive brings the eyes closer), 0..100 units | -20..20 |
| `dy` | downward shift, 0..100 units | -20..20 |
| `tilt` | tilt in degrees (same direction on both eyes, like italics) | -45..45 |

Overriding `classic` also rescales the derived `pumpy` and `big`; overrides on those two apply afterwards.

### Other `rig` keys

| Key | Rule |
|---|---|
| `idle` | `{ "amp", "freq" }`, each 0..6, default 1. Multipliers of how far and how fast the parts sway at rest. |
| `flicker` | 0..1, default 0. 0 is a firm body; 1 makes the body flicker like fire. |
| `color` | `#rgb` or `#rrggbb`. Informational: a suggested body colour for whoever draws the character. The engine does not use it. |

## What the engine derives (for reference)

With S = 9.5 and the body's flattened bounding box:

- Transform: `x' = 627 + (x - boxCentreX) * S`, `y' = 960 + (y - boxBottom) * S`. Parts, pivots, tips and eyes use the same transform.
- `classic` eye = `5.5*scale*S` wide, `11*scale*S` tall (width = height / 2, Berry's ratio; Open Bot Avatar draws it 4 wide). `pumpy` and `big` keep the same proportions to `classic` that the built-in Berry character has.
- The shadow sits at y = 988 and is 0.41 x the body width wide (radius). The accessory point (light bulb, question mark...) sits near the top-right of the body.
- A warning is issued when the body plus parts would not fit on the stage once scaled.

## Validation summary

Errors (the character is rejected, all are reported at once, each starts with the JSON path): wrong `version`; bad `id` or `name`; missing or non-numeric keys; `eyes.spacing` outside 4..60 or smaller than `5 * scale` (below `6.05 * scale` is only a warning); `eyes.scale` outside 0.4..3; a path that does not parse, is too long, has too many segments or subpaths, or has a coordinate outside -20..120; a body smaller than 30 x 30 or reaching outside 6..94; an eye poking outside the body; a part with a repeated or invalid role, an invalid path, a pivot far from the body or a tip closer than 4 units to the pivot; out-of-range `rig` values.

Warnings (the character is accepted): unknown keys; eyes small for the body (classic eye height under 18 % of the body height: `eyes.scale: eyes are small for this body (N % of body height); expressions read best at 22-30 % - try scale ≈ X`, X giving 26 %); spacing between `5 * scale` and `6.05 * scale`, or an eye that fits Open Bot Avatar's thinner 4-wide pill but touches the outline with the wider one; body reaching outside 8..92; figure too large for the stage.

## Worked example

A round body with three leaves. The leaves start at y = 46 while the body's top is at y = 36, so their bases are inside the body.

```json
{
  "version": 1,
  "id": "sprout",
  "name": "Sprout",
  "body": {
    "path": "M50 36 C70 36 82 50 82 65 C82 80 70 90 50 90 C30 90 18 80 18 65 C18 50 30 36 50 36 Z"
  },
  "eyes": {
    "x": 50,
    "y": 64,
    "spacing": 19,
    "scale": 1.3
  },
  "rig": {
    "parts": [
      {
        "role": "C",
        "path": "M44 46 C42 32 46 18 50 10 C54 18 58 32 56 46 Z",
        "pivot": [
          50,
          43
        ],
        "tip": [
          50,
          10
        ]
      },
      {
        "role": "L",
        "path": "M34 46 C32 36 26 28 18 24 C26 20 36 22 42 30 C45 34 46 40 46 46 Z",
        "pivot": [
          40,
          44
        ],
        "tip": [
          18,
          24
        ]
      },
      {
        "role": "R",
        "path": "M66 46 C68 36 74 28 82 24 C74 20 64 22 58 30 C55 34 54 40 54 46 Z",
        "pivot": [
          60,
          44
        ],
        "tip": [
          82,
          24
        ]
      }
    ],
    "color": "#4fae6a"
  }
}
```

A minimal character (no `rig`):

```json
{"version":1,"id":"blob","name":"Blob","body":{"path":"M50 24 C70 24 86 38 86 58 C86 78 74 90 50 90 C26 90 14 78 14 58 C14 38 30 24 50 24 Z"},"eyes":{"x":50,"y":54,"spacing":21,"scale":1.55},"rig":{"color":"#ff8fb1"}}
```

## Prompt

Copy everything in the block below into any LLM, then add a description of the character you want after the last line.

```text
You design characters for a 2D procedural animation engine. Reply with ONE valid JSON object and nothing else: no markdown fences, no commentary.

FORMAT (all coordinates are in a 0..100 box, x to the right, y downward):
{
  "version": 1,
  "id": "lowercase-slug",            // 1-40 chars of [a-z0-9-], starts with a letter or digit
  "name": "Display Name",            // 1-60 characters, no < or >
  "body": { "path": "..." },         // SVG path of the silhouette
  "eyes": { "x": 50, "y": 55, "spacing": 20, "scale": 1.3 },
  "rig": {                           // optional
    "parts": [ { "role": "C" | "L" | "R", "path": "...", "pivot": [x, y], "tip": [x, y] } ],
    "eyeStyles": { "classic" | "pumpy" | "big": { "w": n, "h": n, "dx": n, "dy": n, "tilt": n } },
    "idle": { "amp": 1, "freq": 1 },
    "flicker": 0,
    "color": "#rrggbb"
  }
}

RULES:
- body.path: closed with Z (every subpath), commands M L H V C S Q T A Z, at most 6000 characters and 400 segments, all coordinates between -20 and 120. Prefer about 8-20 cubic (C) segments. Fill is non-zero.
- The body's bounding box must be at least 30x30 and inside 8..92 on all sides (hard limit 6..94). A bold, flat, simple silhouette with a flat or softly rounded bottom works best: it stands on its lowest point.
- The face is two pill-shaped eyes. At scale 1 each is 5.5 wide x 11 tall; at scale s it is 5.5s x 11s. They are centred at (x - spacing/2, y) and (x + spacing/2, y). eyes.scale 0.4-3. MAKE THE EYES BIG: eye height (11 x scale) should be 24-28% of the body's height, so scale = 0.26 x bodyHeight / 11; eye centres (spacing) 26-32% of the body's width apart, slightly below the vertical middle of the face area. eyes.spacing 4-60 and at least 6.05 x scale. BOTH eyes must lie completely inside the body outline with about 1 unit to spare: put them in the widest, solid part of the body, not near an edge and not over a hole.
- rig.parts (optional, at most 3, roles C = middle, L = left, R = right, each used once): leaves, antennas, ears, tails. Each is a closed single-subpath path. "pivot" is the hinge and must lie inside the body's bounding box; "tip" is the free end and must be at least 4 units from the pivot. IMPORTANT: draw each part so its base reaches well INSIDE the body outline (overlapping it by 5-10 units) and put the pivot in that overlap, so bending never opens a gap. Parts and body should still fit within the 0..100 box, with the whole figure (body plus parts) no taller than about 85 units.
- rig.eyeStyles, rig.idle, rig.flicker, rig.color: leave out unless the description asks for something specific. eyeStyles values are in the same 0..100 units (tilt in degrees); idle.amp and idle.freq 0-6 scale how much and how fast parts sway; flicker 0-1 makes the body flicker like fire; color is a suggested hex colour.
- Use plain numbers in the JSON (no expressions) and do not add other keys.

Before answering, check: every eye pill inside the body, every path closed with Z, every pivot inside the body box, tips far enough from pivots.

THE CHARACTER I WANT:
```
