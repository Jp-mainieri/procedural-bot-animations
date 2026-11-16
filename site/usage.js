/* Tab "Use it": install, mount and extend, with copyable snippets. */

import { copyLazy, fallbackBox, h } from "./dom.js";

const REPO = "https://github.com/Jp-mainieri/procedural-bot-animations";

const MOUNT = `import { mountCharacter, RIG_BERRY } from "procedural-bot-animations";

const bot = mountCharacter(document.querySelector("#bot"), {
  rig: RIG_BERRY,
  size: 240,
  color: "#e11d2e",
  gaze: "pointer", // "free" | "focus" | "none" | { x, y }
  mood: "curious",
  label: "Berry, a friendly bot",
  onEvent: (e) => console.log(e.type, e.name),
});

bot.react("wink");
bot.update({ mood: { curious: 0.6, proud: 0.4 } });
bot.destroy(); // when you remove it`;

const EXTEND = `import {
  addToLibrary, createLibrary, mountCharacter,
  parseAnimation, parseCharacter,
} from "procedural-bot-animations";

const character = parseCharacter(characterJson); // { ok, value: { definition, rig }, warnings } or { ok: false, errors }
const animation = parseAnimation(animationJson); // { ok, value: { definition, compiled }, warnings } or { ok: false, errors }
if (!character.ok || !animation.ok) throw new Error("invalid definition");

const library = createLibrary();
addToLibrary(library, animation.value.compiled);

const bot = mountCharacter(host, { rig: character.value.rig, library });
bot.react(animation.value.definition.id);`;

const link = (href, text) => h("a", { href, target: "_blank", rel: "noopener" }, text);

function snippet(label, code) {
  const note = h("div", { class: "export-note", role: "status" });
  const button = h("button", {
    type: "button",
    class: "btn",
    onClick: async () => {
      const r = await copyLazy(async () => code);
      note.replaceChildren();
      if (r.ok) note.textContent = "Copied.";
      else note.appendChild(fallbackBox(code));
    },
  }, "Copy");
  return h("figure", { class: "snippet" }, h("figcaption", {}, h("span", {}, label), button), h("pre", { tabindex: "0" }, h("code", {}, code)), note);
}

export function createUsage() {
  return {
    el: h(
      "div",
      { class: "tab-body" },
      h("section", { class: "group" }, h("h3", {}, "Install"), snippet("Terminal", "npm install procedural-bot-animations"), h("p", { class: "note" }, "ES modules, no dependencies. It draws plain SVG into any element you give it.")),
      h("section", { class: "group" }, h("h3", {}, "Mount a character"), snippet("JavaScript", MOUNT)),
      h("section", { class: "group" }, h("h3", {}, "Bring your own character and animation"), h("p", { class: "note" }, "Both formats are plain JSON, validated with messages that name the JSON path of every problem."), snippet("JavaScript", EXTEND)),
      h(
        "section",
        { class: "group" },
        h("h3", {}, "Links"),
        h(
          "ul",
          { class: "links" },
          h("li", {}, link(REPO, "Source code and README on GitHub")),
          h("li", {}, link("./docs/character-format.md", "Character format")),
          h("li", {}, link("./docs/animation-format.md", "Animation format")),
          h("li", {}, link("https://github.com/DominikScholz/open-bot-avatar", "Open Bot Avatar")),
        ),
        h("p", { class: "note" }, "The character and eye engine is ported from DevBerry's mascot. The shape format is compatible with Open Bot Avatar (MIT, Dominik Scholz)."),
      ),
    ),
  };
}
