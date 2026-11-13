# Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Your app                                                 │
│ decides WHEN things happen: machine.send("ask"),         │
│ brain.setMood({...}), brain.react("bounce")              │
├─────────────────────────────────────────────────────────┤
│ procedural-bot-animations (this repo, src/)              │
│ render.ts   — mounts a definition as THIS package's own  │
│               SVG: one body path, two independently      │
│               posable eye groups                         │
│ moods.ts    — weighted/blended named moods                │
│ reactions.ts— one-shot closed-form curves, priority queue │
│ gaze.ts     — pursuit/saccade/microsaccade, autonomous    │
│               wander                                      │
│ fake3d.ts   — flat-silhouette "head turn" illusion         │
│ blink.ts    — this engine's own blink scheduler            │
│ brain.ts    — composes all of the above into one Pose      │
│               per frame; pure, no DOM                      │
│ bind.ts     — the rAF/DOM loop: Brain + render.ts           │
│ state-machine.ts, scroll-traveler.ts — generic, DOM-free     │
├─────────────────────────────────────────────────────────┤
│ A definition: { body: { path }, eyes: {x,y,spacing,scale} }│
│ Get one from Open Bot Avatar's editor/skill, hand-write    │
│ one, or generate it any other way. Open Bot Avatar's own    │
│ renderer/runtime is never called by this package.           │
└─────────────────────────────────────────────────────────┘
```

## Why render the shape ourselves instead of using Open Bot Avatar's renderer

Open Bot Avatar's own `mountAvatar`/`update()` exposes three things: `mood` (a 3-string enum), `lookAt`, and `depth`/`view`. That's deliberately minimal — it's a renderer, not a behavior engine — but it means moods can't blend, there's no reaction system, and nothing can deform the eyes beyond what its own internal animator does.

`src/render.ts` instead draws the body path and two eye groups directly, each a plain SVG element this package fully controls (position, scale, rotation, a pill↔arc crossfade for "happy"). That's what makes `moods.ts`'s weighted blending and `reactions.ts`'s per-eye/per-body deltas possible at all — they're just numbers added onto a `Pose`, applied straight to real SVG attributes every frame.

## Why Berry (`examples/berry-live/`) isn't part of the package

Berry's rig has three leaves, each an independent two-link spring chain (see [`berry-case-study.md`](../skills/procedural-bot-animations/references/berry-case-study.md)) — fundamentally more than "one silhouette, two eyes." Bending that into the single-silhouette `src/` API would mean inventing a different, incompatible shape of API just to accommodate one character. Instead, Berry gets its own small, honest, faithfully-ported module that reuses nothing from `src/` and claims nothing it doesn't do.

If your own character has separate moving parts, copy `berry-live.js`'s pattern (described in the case study) rather than trying to force it through `src/`.

## Extending to a different single-silhouette renderer

`Brain` (`brain.ts`) is pure and DOM-free: `brain.update(dt, gazeTarget)` returns a `Pose` and nothing else. `bindBrain` is a thin convenience that owns a `requestAnimationFrame` loop, a `Brain`, and a `MountedRig` from `mountRig`, applying one to the other every frame. If you want a different rendering strategy for the same `Pose` data (canvas instead of SVG, for instance), write your own small loop calling `brain.update()` directly and apply the `Pose` however you like — `MountedRig`'s shape (`{ bounds, applyPose(pose), destroy() }`) is a reasonable one to copy, but `bindBrain` itself isn't pluggable; it's meant to be read and forked for this case, not configured.
