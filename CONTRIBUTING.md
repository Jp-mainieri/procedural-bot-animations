# Contributing

```bash
npm install
npm run check   # typecheck + test + build
```

- Keep `src/` free of a hard dependency on `open-bot-avatar` — it should stay usable with any renderer exposing a compatible `update()`. `bind.ts`'s `UpdatableAvatar` interface is the contract; don't import `open-bot-avatar`'s own types into it.
- New behavior in `motion.ts` should come with a calibrated entry in `skills/procedural-bot-animations/references/motion-cookbook.md`, not just code — the skill is how most users (and agents) will discover it.
- Tests in `tests/` avoid the DOM on purpose (no jsdom dependency) so they stay fast; `bind.ts` and the HTML demo are the parts that need a browser, and are checked by hand (`node --check` on the extracted `<script>`, and opening the page) rather than by the test suite.
- Randomness (`GazeController`'s wander, `BlinkScheduler`) takes an injectable `Rng` (see `rng.ts`) specifically so tests can seed it and assert determinism — new randomized behavior should follow the same pattern.

## Reporting issues

Open an issue with: what you expected, what happened, and if possible a minimal repro (a trimmed copy of `examples/states-demo.html` is usually the fastest way).
