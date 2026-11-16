# State machine guide

`createStateMachine` (`src/state-machine.ts`) is a small, generic, renderer-agnostic FSM. It doesn't know about characters, moods or reactions at all. You connect a state to the engine yourself, typically in `onEnter` or `subscribe`, by calling `bot.update({ mood, activity })` and/or `bot.react("...")` on the object returned by `mountCharacter`. This doc is about designing the states themselves.

## Anatomy

```ts
const machine = createStateMachine<MyState, MyEvent>({
  initial: "idle",
  states: {
    idle: { id: "idle" },
    thinking: { id: "thinking" },
    success: { id: "success", after: { ms: 1800, to: "idle" } },
    error: { id: "error", interruptibleBy: ["idle"] },
  },
  transitions: [
    { from: "idle", event: "ask", to: "thinking" },
    { from: "thinking", event: "resolve", to: "success" },
    { from: "thinking", event: "fail", to: "error" },
    { from: "error", event: "reset", to: "idle" },
    { from: "*", event: "sleep", to: "sleeping" }, // any state
  ],
});

machine.send("ask");         // true if a transition matched
machine.tick(deltaMs);       // advances `after` timers: call every frame (the machine has no clock of its own)
machine.subscribe((s, prev) => { /* ... */ });
```

- **`after`** is for states that should leave on their own after a while (an acknowledgement, a toast-like "success"), without the app having to remember to send an event back.
- **`interruptibleBy`** is for states that matter enough that a user shouldn't be able to accidentally skip past them — most commonly `error`. Leave it unset (interruptible by anything) for everything else.
- **`from: "*"`** transitions apply regardless of current state — useful for a global `sleep`/`wake` or a hard `reset`.
- **`guard`** on a transition lets the same event lead to different states depending on context (e.g. `resolve` going to `success` or straight to a follow-up `thinking` if there's a next step queued).

## Wiring a machine to a character

```ts
import { createStateMachine, mountCharacter, RIG_BERRY } from "procedural-bot-animations";

type State = "idle" | "thinking" | "success";
type Event = "ask" | "resolve";

const bot = mountCharacter(host, { rig: RIG_BERRY, label: "Assistant" });

const machine = createStateMachine<State, Event>({
  initial: "idle",
  states: {
    idle: { id: "idle" },
    thinking: { id: "thinking" },
    success: { id: "success", after: { ms: 1800, to: "idle" } },
  },
  transitions: [
    { from: "idle", event: "ask", to: "thinking" },
    { from: "thinking", event: "resolve", to: "success" },
  ],
});

machine.subscribe((state) => {
  if (state === "idle") bot.update({ mood: "neutral", activity: null });
  if (state === "thinking") bot.update({ mood: "focused", activity: "thinking" });
  if (state === "success") {
    bot.update({ mood: "proud", activity: null });
    bot.react("success");
  }
});

let last = performance.now();
function tick(now: number) {
  machine.tick(now - last); // drives the `after` timers
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

## Worked examples

**Chat assistant waiting for a model response**
States: `idle → thinking (on "ask") → success/error (on "resolve"/"fail") → idle (after a short delay or on "reset")`.
`thinking` calls `bot.update({ mood: "focused", activity: "thinking" })`. The built-in `thinking` activity makes the eyes look up and to the sides and shows a `...` accessory. `success` calls `bot.update({ mood: "proud", activity: null })` and `bot.react("success")`, with a 1.5 to 2 s `after` back to `idle`. `idle` calls `bot.update({ mood: "neutral", activity: null })`. Each `update` replaces the previous `mood` and `activity`, so there is nothing to zero out. `error` is `interruptibleBy: ["idle"]` so a stray click doesn't erase it before the user reads the message. Pick its look from the moods (`downcast`, `angry`) or write one with the animation format.

**Form submission**
States: `idle → loading (on "submit") → success/error (on the request's result) → idle`.
`loading` is a good candidate for the built-in `loading` activity (a rhythmic hop), which lasts as long as the state does: `bot.update({ activity: "loading" })` on enter and `activity: null` on exit. Use `bot.react("morphLoading")` instead if you want the character to turn into a loading ring; that reaction cannot be interrupted, so do not use it for short waits.

**Background job with progress**
If you need intermediate states (`queued`, `running`, `retrying`, `done`, `failed`), model them as their own states rather than overloading `loading` with a payload — the FSM is cheap, and `subscribe` lets your UI (a status line, a toast) react the same way the avatar does, from one source of truth.

## When not to reach for a full FSM

A single boolean ("isLoading") or a 3-way enum your framework already models doesn't need `createStateMachine` wrapped around it — just call `bot.update` and `bot.react` directly from wherever that state changes. Reach for the FSM when you have more than ~4 states, timers, or rules about what can interrupt what; those are the things a plain enum won't enforce for you.
