# procedural-bot-animations

Procedural motion and a typed state machine for [Open Bot Avatar](https://github.com/DominikScholz/open-bot-avatar) — idle wandering gaze, breathing, spring-based bounce with squash & stretch, velocity lean, and bot states (`idle`, `thinking`, `success`, `error`, `loading`, `sleeping`, or a custom set) with timers and interrupt rules.

Open Bot Avatar gives a bot its shape and a renderer that *can* be told a mood, a gaze target, a depth and a view angle. This package is what decides those values frame to frame, and what connects them to real app events, so the avatar reads as alive and reacts — not just looks good in a screenshot.

```
npm install procedural-bot-animations open-bot-avatar
```

```ts
import { mountAvatar } from "open-bot-avatar/dom";
import { getExample } from "open-bot-avatar";
import { createStateMachine, bindBotStateMachine } from "procedural-bot-animations";

const host = document.querySelector("#bot")!;
const avatar = mountAvatar(host, { definition: getExample("mug")!, color: "#ff6a1a" });

const machine = createStateMachine({
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
  ],
});

bindBotStateMachine({
  avatar,
  host,
  machine,
  presets: {
    thinking: { mood: "thinking", freezeGaze: true },
    success: { mood: "happy", bounceOnEnter: true },
  },
}).start();

// elsewhere in your app:
machine.send("ask");
```

A full, running version of this — with buttons, a log, light/dark and reduced-motion support — is in [`examples/states-demo.html`](examples/states-demo.html).

## What's in this repo

| Path | What |
|---|---|
| [`src/`](src) | The library: `spring.ts` (damp/spring math), `rng.ts` (seedable random), `motion.ts` (breathing, gaze, bounce, lean), `state-machine.ts` (generic FSM), `bind.ts` (glue to an avatar + a host element), `scroll-traveler.ts` (character that travels between page sections on scroll) |
| [`skills/procedural-bot-animations/`](skills/procedural-bot-animations) | A [Claude Code](https://claude.com/claude-code) skill that teaches an agent to use this library and Open Bot Avatar together, with a calibrated motion cookbook and a state-machine design guide |
| [`examples/`](examples) | A runnable states demo |
| [`docs/architecture.md`](docs/architecture.md) | How this layers on top of Open Bot Avatar, and how to point it at a different avatar renderer |
| [`tests/`](tests) | Vitest unit tests for the math and the state machine (no DOM required) |

## Relationship to Open Bot Avatar

This is an independent, unofficial companion project — not affiliated with or published by Open Bot Avatar's author. It depends on `open-bot-avatar` as an **optional peer dependency**: the state machine and the spring/noise math have no idea what an avatar is, so they work standalone or with a different renderer that exposes a similar `update()` call (see [`docs/architecture.md`](docs/architecture.md)). `bindBotStateMachine` is the one piece written specifically against Open Bot Avatar's `mood`/`lookAt`/`depth`/`view` API.

Open Bot Avatar is MIT-licensed by Dominik Scholz. This repo is also MIT-licensed; see [LICENSE](LICENSE).

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm run check` runs all three in sequence — the same thing CI runs on every push.

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
