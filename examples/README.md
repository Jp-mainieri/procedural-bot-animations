# Examples

`states-demo.html` is a complete, runnable page: Open Bot Avatar example shapes (used only as JSON input) rendered and driven by this repo's own engine, with a character picker, mood toggles, reaction buttons, a log, and light/dark + `prefers-reduced-motion` support.

[`berry-live/`](berry-live) is a separate, faithful port of DevBerry's actual mascot — see its own demo (`berry-live/berry-demo.html`) and [the case study](../skills/procedural-bot-animations/references/berry-case-study.md). It does not use this package's engine; it's standalone.

`states-demo.html` imports Open Bot Avatar from a CDN (`esm.sh`) and this package from the built `../dist`, so:

```bash
npm install
npm run build
npx serve .   # or any static file server — ES module imports need http(s), not file://
```

Then open `http://localhost:<port>/examples/states-demo.html` or `.../examples/berry-live/berry-demo.html`.
