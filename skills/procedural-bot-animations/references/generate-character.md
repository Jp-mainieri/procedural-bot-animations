# Generate a character

Turn a user's description into one character JSON that `parseCharacter` accepts with no errors. This file has what you need to do it without any other file. The full contract is [`docs/character-format.md`](../../../docs/character-format.md) in the repo; read it if you can, and use it to settle any doubt.

## 1. What a character is

One JSON object: a silhouette, two pill-shaped eyes and, optionally, up to three moving parts. All coordinates are in a **0..100 box**: x to the right, y downward.

```json
{
  "version": 1,
  "id": "sprout",
  "name": "Sprout",
  "body": { "path": "M50 36 C70 36 82 50 82 65 C82 80 70 90 50 90 C30 90 18 80 18 65 C18 50 30 36 50 36 Z" },
  "eyes": { "x": 50, "y": 64, "spacing": 19, "scale": 1.3 },
  "rig": {
    "parts": [
      { "role": "C", "path": "M44 46 C42 32 46 18 50 10 C54 18 58 32 56 46 Z", "pivot": [50, 43], "tip": [50, 10] },
      { "role": "L", "path": "M34 46 C32 36 26 28 18 24 C26 20 36 22 42 30 C45 34 46 40 46 46 Z", "pivot": [40, 44], "tip": [18, 24] },
      { "role": "R", "path": "M66 46 C68 36 74 28 82 24 C74 20 64 22 58 30 C55 34 54 40 54 46 Z", "pivot": [60, 44], "tip": [82, 24] }
    ],
    "color": "#4fae6a"
  }
}
```

The core keys (`version`, `id`, `name`, `body`, `eyes`) are an Open Bot Avatar definition. The `rig` key is this engine's extension. Unknown keys are warnings, not errors.

## 2. The rules

| Key | Rule |
|---|---|
| `version` | The number `1` |
| `id` | `/^[a-z0-9][a-z0-9-]{0,39}$/` (lowercase slug, at most 40 characters) |
| `name` | 1 to 60 characters, no control characters, no `<` or `>` |
| `body.path` | SVG path. End every subpath with `Z` (a missing one is reported, as an error or as a warning that it was closed for you; always write it). Commands `M L H V C S Q T A Z`. At most 6000 characters, 400 segments, 16 subpaths. Every coordinate between -20 and 120 |
| Body size | The bounding box is at least 30 by 30. It must stay inside 6..94 on every side (error). Staying inside 8..92 avoids a warning |
| `eyes.x`, `eyes.y` | Centre of the pair, 0..100 |
| `eyes.spacing` | 4..60, and at least `6.05 * scale` (an error below `5 * scale`, a warning between) |
| `eyes.scale` | 0.4..3. At scale 1 each eye is 5.5 wide by 11 tall. Make the eyes big: height `11 * scale` = 24 to 28 % of the body's height, so `scale = 0.26 * bodyHeight / 11`. Under 18 % you get a warning |
| Eye placement | Left eye at `(x - spacing/2, y)`, right eye at `(x + spacing/2, y)`. **Both eyes must lie fully inside the body**, with 0.8 units to spare. Not over a hole, not near an edge |
| `rig.parts` | At most 3, one per role: `C` (middle), `L` (left), `R` (right) |
| Each part | `path` (one closed subpath), `pivot` `[x, y]` (inside the body's bounding box, or within 3 units of it), `tip` `[x, y]` (at least 4 units from the pivot) |
| `rig.eyeStyles` | Optional. `classic`, `pumpy`, `big`, each with optional `w` (0.5..40), `h` (0.5..60), `dx` and `dy` (-20..20), `tilt` (-45..45 degrees). Leave it out unless asked |
| `rig.idle` | Optional. `{ "amp", "freq" }`, each 0..6, default 1. How far and how fast parts sway |
| `rig.flicker` | Optional. 0..1, default 0. 1 makes the body flicker like fire |
| `rig.color` | Optional `#rgb` or `#rrggbb`. A suggested colour. The engine does not apply it by itself |

## 3. How to design it

- **Silhouette.** A bold, flat shape reads best. 8 to 20 cubic (`C`) segments are enough. The character stands on its lowest point, so give it a flat or softly rounded bottom.
- **The body is the only filled shape.** The eyes are drawn on top of it.
- **Eyes.** Put them in the widest, solid part of the body. Make them big: eye height 24 to 28 % of the body's height, centres 26 to 32 % of the body's width apart (about 16 to 19 for a body 60 wide), a little below the vertical middle of the face area. Big eyes carry the expressions.
- **Parts.** Draw each part so its **base reaches 5 to 10 units inside the body outline**, and put the `pivot` inside that overlap. Parts are drawn in the body colour, so the overlap is invisible, and bending a part never opens a gap. The part bends along the line from `pivot` to `tip`, and `tip` is the free end.
- **Roles.** Which role to give a part: the one nearest its place on the body. `C` is the one that points up in the middle. `L` and `R` are mirrored: `partL` positive raises the left part, `partR` negative raises the right part. A character with only some roles is fine; animations that name a missing part do nothing for it.
- **Size.** Keep the whole figure (body plus parts) no taller than about 85 units.
- **Plain numbers.** No expressions, no extra keys.

## 4. Self-check (always do this)

Never hand over a character you have not validated. `parseCharacter` never throws and returns every problem at once, each starting with its JSON path.

1. Save the JSON to a file, for example `character.json`.
2. Save this script as `check-character.mjs` next to it:

   ```js
   import { readFileSync } from "node:fs";
   // Inside the package repo, after `npm run build`: "./dist/index.js".
   // In a project that installed the package: "procedural-bot-animations".
   import { parseCharacter } from "procedural-bot-animations";

   const result = parseCharacter(readFileSync(process.argv[2], "utf8"));
   if (!result.ok) {
     console.error("ERRORS:\n" + result.errors.join("\n"));
     process.exit(1);
   }
   console.log("OK");
   if (result.warnings.length) console.log("WARNINGS:\n" + result.warnings.join("\n"));
   ```

3. Run `node check-character.mjs character.json`.
4. Fix **every** error. Typical fixes:

   | Error says | Fix |
   |---|---|
   | `subpath N is not closed` (error, or a warning "closed automatically") | End that subpath with `Z` |
   | `the left eye (...) pokes outside the body` | Move `eyes.x` and `eyes.y` toward the middle of the body, or lower `eyes.spacing` or `eyes.scale` |
   | `eyes.spacing` smaller than `5 * scale` | Raise `spacing` or lower `scale` |
   | `eyes.scale: eyes are small for this body` (warning) | Raise `scale` to the value it suggests |
   | Body outside 6..94 or smaller than 30 by 30 | Rescale the path inside the box |
   | A coordinate outside -20..120 | Pull the control point in |
   | `pivot` far from the body | Move the pivot inside the body's bounding box |
   | `tip` closer than 4 to `pivot` | Move the tip to the free end of the part |
   | Repeated or invalid `role` | Use `C`, `L`, `R`, each once |

5. Run the script again. Repeat until it prints `OK`. Read the warnings and fix the ones that are easy (a body outside 8..92 is the usual one).
6. If the package is not available to run (no `dist/`, nothing installed), say so. Check the list in section 2 by hand, go through each eye and each part, and tell the user the character was not machine-validated.

To see it move, mount it and look: `mountCharacter(host, { rig: result.value.rig })`, or paste the JSON into the Studio (<https://jp-mainieri.github.io/procedural-bot-animations/>).

## 5. Reply format

Give the user the JSON in one code block, the suggested colour in plain words, and one line on each warning you left. If the user will paste the JSON into code, tell them to call `parseCharacter(json)` and use `result.value.rig`.
