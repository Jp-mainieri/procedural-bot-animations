# State machine guide

`createStateMachine` (`src/state-machine.ts`) is a small, generic, renderer-agnostic FSM. It doesn't know about avatars, moods or reactions at all — you connect a state to the engine yourself, typically in `onEnter`/`subscribe`, by calling `brain.setMood({...})` and/or `brain.react("...")`. This doc is about designing the states themselves.

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
machine.tick(deltaMs);       // advances `after` timers — call every frame
machine.subscribe((s, prev) => { /* ... */ });
```

- **`after`** is for states that should leave on their own after a while (an acknowledgement, a toast-like "success"), without the app having to remember to send an event back.
- **`interruptibleBy`** is for states that matter enough that a user shouldn't be able to accidentally skip past them — most commonly `error`. Leave it unset (interruptible by anything) for everything else.
- **`from: "*"`** transitions apply regardless of current state — useful for a global `sleep`/`wake` or a hard `reset`.
- **`guard`** on a transition lets the same event lead to different states depending on context (e.g. `resolve` going to `success` or straight to a follow-up `thinking` if there's a next step queued).

## Worked examples

**Chat assistant waiting for a model response**
States: `idle → thinking (on "ask") → success/error (on "resolve"/"fail") → idle (after a short delay or on "reset")`.
`thinking`'s `onEnter` calls `brain.setMood({ focused: 1 })` (looking at the input, not wandering — pair with a `getGazeTarget` that returns a fixed point while this state is active). `success`'s `onEnter` calls `brain.setMood({ proud: 1 })` and `brain.react("bounce")`, with a 1.5-2s `after` back to `idle` (whose `onEnter` zeroes every mood weight back out — see the cookbook's note on `setMood` merging, not replacing). `error` is `interruptibleBy: ["idle"]` so a stray click doesn't erase it before the user reads the message.

**Form submission**
States: `idle → loading (on "submit") → success/error (on the request's result) → idle`.
`loading` is a good candidate for a mood (e.g. `focused`) plus periodic `brain.react("bounce")` on a short interval, rather than a one-off reaction — call `setInterval`/`clearInterval` in `onEnter`/`onExit`.

**Background job with progress**
If you need intermediate states (`queued`, `running`, `retrying`, `done`, `failed`), model them as their own states rather than overloading `loading` with a payload — the FSM is cheap, and `subscribe` lets your UI (a status line, a toast) react the same way the avatar does, from one source of truth.

## When not to reach for a full FSM

A single boolean ("isLoading") or a 3-way enum your framework already models doesn't need `createStateMachine` wrapped around it — just call `brain.setMood`/`brain.react` directly from wherever that state changes. Reach for the FSM when you have more than ~4 states, timers, or rules about what can interrupt what; those are the things a plain enum won't enforce for you.
