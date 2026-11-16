# Contributing

```bash
npm install
npm run check   # typecheck + test + build, as CI runs them
```

## Ground rules

- `src/` has no dependency on `open-bot-avatar`. The character format only shares its JSON shape. Do not import anything from that package.
- Keep the brain DOM-free. `src/brain.ts`, `src/gaze.ts`, `src/focus.ts` (except `observePage`), `src/motion.ts`, `src/parts.ts`, `src/reactions.ts` and the rest of the motion code run in Node. Only `src/mount.ts` and `src/ticker.ts` touch the DOM (`observePage` in `src/focus.ts` listens to page events).
- Tests in `tests/` run in Node, with no jsdom. `mount.ts` and `ticker.ts` are checked by hand, by mounting a character in the Studio or in [`examples/minimal.html`](examples/minimal.html). Build first with `npm run build`; the pages import from `dist/`.
- Randomness takes an injectable `Rng` (see `Brain`'s `rng` option and `Gaze.step`), so tests can seed it. New random behaviour should follow the same pattern.
- A change to a value that is documented in [`skills/procedural-bot-animations/references/motion-cookbook.md`](skills/procedural-bot-animations/references/motion-cookbook.md) must update the cookbook in the same change. Every number there should be found with a grep in the file it names.
- The two format contracts, [`docs/character-format.md`](docs/character-format.md) and [`docs/animation-format.md`](docs/animation-format.md), must match the validators in `src/character.ts` and `src/animation.ts`. If you change a limit in the code, change the document, and the Prompt block at its end.

## Where things live

| Path | What |
|---|---|
| `src/` | The engine. Entry point: `src/index.ts` (add an `export *` line for a new module) |
| `src/characters/` | Built-in rigs (`RIG_BERRY`, `RIG_FLAME`) |
| `src/examples.ts` | Original example characters and animations, as data in the two JSON formats |
| `tests/` | Vitest tests |
| `docs/` | Architecture and the two format contracts |
| `skills/procedural-bot-animations/` | The Claude Code skill and its references |
| `site/` | The Studio (static, served from GitHub Pages) |
| `examples/` | `minimal.html` and a pointer to the Studio |

## Adding a built-in reaction

1. In `src/reactions.ts`, write the reaction with `fromTracks({ field: [[t, value, curve?], ...] })`, or as a function of `t` that returns a `PartialDelta`. Keyframe times run from 0 to 1. Use the field names from `src/delta.ts`.
2. Every track must start and end at 0. Squash and stretch should keep volume (`bodySx` about `-bodySy`). Raise `holdGaze` when you move the eyes, and bring it back to 0 before the end.
3. Add it to the `REACTIONS` table with its `duration` in seconds. `ReactionName` and `REACTION_NAMES` follow from the table.
4. If it should be one of a character's hover or click gestures, add it to `INTERACTIONS` in `src/interactions.ts`.
5. If it uses flame effects (`core`, `embers`, `smoke`, `gray`), say so in its doc comment and in [`built-in-characters.md`](skills/procedural-bot-animations/references/built-in-characters.md).
6. Run `npm test`. `tests/brain.test.ts` plays every reaction in `REACTIONS` and checks that it ends and that the scale and height return to rest.
7. Update the reaction count in `README.md`, the lists in `skills/procedural-bot-animations/SKILL.md`, and add a calibrated entry to the cookbook if the reaction introduces a new magnitude.

A new mood goes in `src/moods.ts` (`MOODS`), a new activity in `ACTIVITIES` in `src/reactions.ts`. Activities are functions of time in seconds and should loop.

## Adding an example character or animation

Example characters and animations are plain data in `src/examples.ts`: `EXAMPLE_CHARACTERS` (the character format) and `EXAMPLE_ANIMATIONS` (the animation format).

1. Add the object to the right array. Follow the contract in `docs/`. Add a comment that says what the entry shows.
2. `tests/character.test.ts` and `tests/animation.test.ts` loop over these arrays: every entry must validate with **zero warnings** and must survive a round trip through `parseCharacter` or `parseAnimation`.
3. For a character, keep the whole figure inside 8..92 and make the base of every part overlap the body. For an animation, follow the house style in `docs/animation-format.md`.
4. Run `npm test`.

## Documentation

Write plain, short sentences. State only what is in the code. Code blocks must be copy-paste correct: type-check a snippet by putting it in a temporary `.ts` file under `tests/`, running `npx tsc --noEmit`, and deleting the file.

## Reporting issues

Open an issue with what you expected, what happened, and if possible a minimal repro: a character or animation JSON, or a short snippet that mounts one.
