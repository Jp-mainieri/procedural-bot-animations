# Examples

The main demo is the **Studio**, a static site in [`site/`](../site). It is served from GitHub Pages at <https://jp-mainieri.github.io/procedural-bot-animations/>. To run it locally, serve the `site/` folder with any static file server. If the Studio imports the built package, run `npm run build` first.

[`minimal.html`](minimal.html) is the smallest working page: it imports the built package, mounts Berry, and has three buttons that fire reactions. The character looks at the pointer. ES module imports need `http(s)`, not `file://`, so serve it:

```bash
npm install
npm run build
npx serve .   # or any static file server
```

Then open `http://localhost:<port>/examples/minimal.html`.
