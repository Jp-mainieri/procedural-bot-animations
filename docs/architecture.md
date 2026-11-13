# Architecture

Three layers, each owned by a different piece:

```
┌─────────────────────────────────────────────────────────┐
│ Your app                                                 │
│ decides WHEN things happen: machine.send("ask"), etc.    │
├─────────────────────────────────────────────────────────┤
│ procedural-bot-animations (this repo)                    │
│ state-machine.ts   — states, transitions, timers         │
│ motion.ts          — spring/damp-driven idle, gaze,      │
│                       breathing, bounce, lean            │
│ bind.ts            — ties the above to an avatar's       │
│                       update() + a host element's        │
│                       CSS transform, every frame         │
│ scroll-traveler.ts — optional: position along scroll     │
├─────────────────────────────────────────────────────────┤
│ open-bot-avatar (github.com/DominikScholz/open-bot-avatar)│
│ a JSON shape (silhouette + eyes) + a renderer that can   │
│ be told a mood, a gaze target, a depth and a view angle  │
└─────────────────────────────────────────────────────────┘
```

## Why a separate repo instead of a fork

Open Bot Avatar is deliberately dependency-free and scoped to shape + rendering; it is not trying to be a behavior engine, and its own docs point at exactly this gap ("The runtime controls color, inferred volume, view, gaze, blinking and animation" — but *driving* those values over time, in response to app state, is left to the consumer). This repo is that consumer-side piece, kept separate so:

- It can version independently and depend on Open Bot Avatar as an **optional peer**, not a hard dependency — `state-machine.ts` and `spring.ts`/`motion.ts`'s math have no idea what an avatar even is.
- `bind.ts` only needs a duck-typed `{ update(options) }` shape (see `UpdatableAvatar` in `src/bind.ts`), so a renderer other than Open Bot Avatar's — a custom SVG rig, a Lottie wrapper exposing similar knobs — can reuse the state machine and motion math too.

## Why the motion operates on four numbers instead of a rig

Open Bot Avatar's definitions are one silhouette path with no bones, joints or named parts — there's nothing to rig. The "aliveness" has to come entirely from what the renderer does expose: `mood`, `lookAt`, `depth`, `view`, plus whatever the *host element* can do in CSS (scale, rotate, translate). `motion.ts` and `bind.ts` are built against exactly that surface — see `skills/procedural-bot-animations/references/motion-cookbook.md` for how each behavior maps onto it.

## Extending to a different avatar renderer

Implement `UpdatableAvatar` (one `update()` method) around your renderer, and reuse everything else unchanged: `createStateMachine`, `GazeController`, `Bounce`, `breathingDepth`, `neverRepeating`, `travelerFrame`. Only `bindBotStateMachine`'s specific choice of which numbers go into `avatar.update(...)` is Open-Bot-Avatar-shaped; it's a small function, read it before assuming you need to fork it.
