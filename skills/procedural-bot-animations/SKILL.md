---
name: procedural-bot-animations
description: Give an Open Bot Avatar (https://github.com/DominikScholz/open-bot-avatar) instance — or any 2D character exposing a similar mood/gaze/depth API — a procedural "alive" layer and a typed state machine: idle wandering gaze, breathing, spring bounce with squash & stretch, velocity lean, and bot states (idle, thinking, success, error, loading, sleeping, or a custom set) with timers and interrupt rules. Not for designing the avatar's shape itself (that is Open Bot Avatar's own `generate-avatar` skill) and not for raster/sprite character animation, which needs a different toolset (Rive, Spine, Lottie).
metadata:
  short-description: Procedural motion + state machine for Open Bot Avatar
---

# Procedural bot animations

Open Bot Avatar gives you a shape (one SVG silhouette path plus eyes) and a renderer that can set its mood, gaze, depth and view — but on its own it is static until you drive those numbers over time. This skill is that driver: a small TypeScript library (`npm install procedural-bot-animations`) plus the motion recipes and state-machine patterns behind it, so a bot reads as alive and reacts to real app events instead of only looking good in a screenshot.

Two layers, used together:

1. **The shape** — Open Bot Avatar's own concern. Get a definition from [the editor](https://dominikscholz.github.io/open-bot-avatar/), from its `generate-avatar` skill, or hand-write one against [its contract](https://github.com/DominikScholz/open-bot-avatar/blob/main/docs/avatar-contract.md). This skill does not design silhouettes.
2. **The life** — this skill's concern. Idle wander, breathing, bounce, lean, and a state machine that ties app events (loading started, request succeeded, request failed, …) to how the avatar moves.

## Workflow

1. **Confirm what exists already.** Ask only what's missing, in one message:
   - Is there an avatar definition yet? If not, point at Open Bot Avatar's editor or `generate-avatar` skill — don't invent a silhouette here.
   - What app events should drive state (e.g. "loading" while a request is in flight, "success"/"error" on its result)? If unspecified, default to the common set below.
   - Context: a fixed widget (chat corner, sidebar), a landing page where the bot travels with scroll, or a full-page demo of states?
2. **Mount the avatar** with `mountAvatar` from `open-bot-avatar/dom` (see its README) inside a host element you control the size and position of.
3. **Design the state machine** using `createStateMachine` from `src/state-machine.ts` — see `references/state-machine-guide.md` for the common states, timers and interrupt rules.
4. **Wire the motion** with `bindBotStateMachine` (`src/bind.ts`), which every frame computes breathing depth, gaze (pointer-follow, falling back to autonomous wander), and optional bounce/lean, then calls `avatar.update(...)`. Give each state a `StatePreset` (mood, whether it bounces on enter, whether gaze freezes). Calibrated values and per-behavior recipes: `references/motion-cookbook.md`.
5. **Scroll-traveling bot?** Use `travelerFrame`/`findActiveSlot` from `src/scroll-traveler.ts` — see the cookbook's section 6. It is DOM-free; you read `.slot` elements' rects yourself and hand it numbers.
6. **Demo as a working page.** `examples/states-demo.html` is a complete, runnable reference (buttons that fire events, a log, light/dark support, `prefers-reduced-motion` handling). Reuse its structure rather than starting from a blank page.

## Common bot states

`idle`, `thinking`, `success`, `error`, `loading`, `sleeping` cover most apps (chat waiting for a reply, a form submitting, a background job). Add custom ones freely — `createStateMachine` is generic over any string union. Rules of thumb:
- `error` should be hard to interrupt accidentally (`interruptibleBy: ["idle"]` or similar) so a user action doesn't visually cancel an error before they've read it.
- `success`/short acknowledgement states should auto-return to `idle` via `after: { ms, to: "idle" }`, not wait for an explicit event.
- `loading`/`thinking` are the only states that usually need `freezeGaze` or a distinct `viewOffset` (a tilt) so they read as "working" rather than "idle with a different mood string".

## Quality checklist

- `prefers-reduced-motion`: stop idle wander/breathing/bounce; keep only the mood/pose change itself.
- Works in light and dark (the avatar takes an explicit `color`; don't hardcode one that disappears on either background).
- Cap the frame delta (`safeDt`, already used inside `bindBotStateMachine`) so a backgrounded tab doesn't make springs explode on return.
- No animation library beyond `open-bot-avatar` and this package — the whole point is that both are dependency-light.

## Reference material

- `references/motion-cookbook.md` — calibrated values (breathing rate, gaze damp rate, wander timing, bounce physics, blink timing) and personality-to-parameter tuning, ported from a production mascot (DevBerry's Berry) to Open Bot Avatar's constrained surface (mood/gaze/depth/view + host-element transform, no per-part rig).
- `references/state-machine-guide.md` — how to design states/transitions/timers/interrupts for a bot, with worked examples (chat assistant, form submit, background job).
- `examples/states-demo.html` — full interactive demo.
- [Open Bot Avatar docs](https://dominikscholz.github.io/open-bot-avatar/#/docs) and [avatar contract](https://github.com/DominikScholz/open-bot-avatar/blob/main/docs/avatar-contract.md) — the shape side of this, referenced but not duplicated here.

## Install for other sessions

Link rather than copy so the skill stays in sync with the repo:

```bash
ln -s "$PWD/skills/procedural-bot-animations" ~/.claude/skills/procedural-bot-animations
```
