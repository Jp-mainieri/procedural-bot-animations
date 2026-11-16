# Changelog

## 0.2.0

A new engine. This is a breaking release: there is no compatibility layer. See "Migrating from 0.1" in the [README](README.md).

### Breaking changes

- `src/` now holds a TypeScript port of DevBerry's mascot engine, made generic. The 0.1 engine (one silhouette, two pill eyes) is gone.
- Removed exports: `bindBrain`, `BoundBot`, `BindOptions`, `mountRig`, `MountedRig`, `RenderOptions`, `Bounds`, `AvatarDefinitionLike`, `ReactionPlayer`, `ReactionPlayerOptions`, `ReactionDefinition`, `builtinReactions`, `bounce`, `fright`, `doubleBlink`, `nod`, `MoodBlender`, `MoodBlenderOptions`, `blendMoods`, `builtinMoods`, `MoodDefinition`, `GazeEngine`, `GazeEngineOptions`, `Point2D`, `ArrivalStyle`, `BlinkScheduler`, `BlinkOptions`, `fakeTurn`, `FakeTurnOptions`, `neverRepeating`, `breathing`, `BreathingOptions`, `mulberry32`, `randRange`, `chance`, `safeDt`, `neutralPose`, `neutralEyePose`, `neutralBodyPose`, `addPose`, `addEyePose`, `addBodyPose`, `PoseDelta`, `resolveDelta`, `BodyPose`, `SpringState`.
- Same names, different API: `Brain`, `BrainOptions`, `Pose`, `EyePose`, `GazeTarget`, `GazeOutput`, `MoodWeights`, `spring` (its state is now `{ a, v }` and it returns nothing).
- Removed the optional `peerDependencies` entry for `open-bot-avatar`. Nothing in `src/` imported it.
- `examples/berry-live/` and `examples/states-demo.html` are removed. `references/berry-case-study.md` in the skill is replaced by `references/built-in-characters.md`.

### Added

- `mountCharacter(host, options)`: a plain-DOM SVG renderer with real clip-path eyelids, accessories, flame effects and transformation objects. It returns `{ brain, svg, update, react, jump, currentReaction, getGazeState, destroy }`. One shared `requestAnimationFrame` loop serves every character, and a character pauses when it is off screen or the tab is hidden.
- `Brain`: pure and DOM-free. It sums a base idle, weight-blended moods, looping activities and one-shot reactions into one `Pose` per frame. It has a reaction queue with fade-out and a hover and click gesture picker.
- Eyes: saccades, pursuit and microsaccades, attention, boredom, convergence, blinks tied to saccades, eyes that stretch and tilt with gaze speed, and gaze modes `free` and `focus` with `data-bot-focus` anchors.
- Rigs: a character is a body path, 0 to 3 parts (`C`, `L`, `R`) with two-link tip physics and path bending, and two eyes in three styles (`classic`, `pumpy`, `big`). Built-in characters `RIG_BERRY` and `RIG_FLAME`.
- 9 moods, 5 activities and 36 reactions, including seamless body-to-object transformations (`morphLoading`, `morphCheck`, `morphCode`, `energy`).
- A JSON character format that is a superset of Open Bot Avatar's definition, with an optional `rig` extension: `validateCharacter`, `characterToRig`, `parseCharacter`. Contract in `docs/character-format.md`.
- A JSON animation format for reactions, activities and moods: `validateAnimation`, `compileAnimation`, `parseAnimation`, `addToLibrary`, `describeAnimation`, `FIELD_INFO`. Contract in `docs/animation-format.md`.
- `createLibrary()`: a per-instance registry of reactions, activities and moods, passed as the `library` option.
- `src/examples.ts`: original example characters and animations written as data.
- The Studio (`site/`): a static demo served from GitHub Pages.
- `examples/minimal.html`.
- Skill: `references/generate-character.md` and `references/generate-animation.md`, each with a validate-and-fix procedure; a rewritten motion cookbook with values taken from the code.
- `CHANGELOG.md`.

### Unchanged

- `createStateMachine` (`src/state-machine.ts`) and `travelerFrame` and `findActiveSlot` (`src/scroll-traveler.ts`).

### Changed

- `package.json`: version 0.2.0, new description, keywords `svg`, `character-animation` and `eyes`.
- Docs, README, skill and `CONTRIBUTING.md` rewritten for the new engine.
