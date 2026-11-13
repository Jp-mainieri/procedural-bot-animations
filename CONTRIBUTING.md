# Contributing

```bash
npm install
npm run check   # typecheck + test + build
```

- Keep `src/` free of a hard dependency on `open-bot-avatar` — it only needs a plain `AvatarDefinitionLike` (`types.ts`), never Open Bot Avatar's own renderer or runtime. Don't import anything from the `open-bot-avatar` package into `src/`.
- New behavior in `moods.ts`/`reactions.ts`/`gaze.ts` should come with a calibrated entry in `skills/procedural-bot-animations/references/motion-cookbook.md`, not just code — the skill is how most users (and agents) will discover it.
- Tests in `tests/` avoid the DOM on purpose (no jsdom dependency) so they stay fast — `render.ts` and `bind.ts` are the only DOM-dependent modules, and are checked by hand (`node --check` on an HTML demo's extracted `<script>`, and opening the page) rather than by the test suite. `brain.ts` is pure, so most of the engine's behavior IS covered by `tests/brain.test.ts` and friends.
- Randomness (`GazeEngine`'s wander, `BlinkScheduler`) takes an injectable `Rng` (see `rng.ts`) specifically so tests can seed it and assert determinism — new randomized behavior should follow the same pattern.
- `examples/berry-live/` is ported code (see its own header comments and `berry-case-study.md`) — changes there should stay traceable to the source file they came from, not drift into original behavior under the same name.

## Reporting issues

Open an issue with: what you expected, what happened, and if possible a minimal repro (a trimmed copy of `examples/states-demo.html` is usually the fastest way).
