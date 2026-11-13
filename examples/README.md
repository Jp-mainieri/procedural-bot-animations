# Examples

`states-demo.html` is a complete, runnable page: an [Open Bot Avatar](https://github.com/DominikScholz/open-bot-avatar) "mug" avatar wired to this repo's state machine and motion library, with buttons that fire the events, a log, and light/dark + `prefers-reduced-motion` support.

It imports Open Bot Avatar from a CDN (`esm.sh`) and this package from the built `../dist`, so:

```bash
npm install
npm run build
npx serve .   # or any static file server — ES module imports need http(s), not file://
```

Then open `http://localhost:<port>/examples/states-demo.html`.
