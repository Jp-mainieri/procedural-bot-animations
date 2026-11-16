/*
 * Tab "Characters": a gallery of live mini characters (built-in, examples, yours)
 * and the editor to add your own as JSON.
 */

import { mountCharacter, parseCharacter } from "./dist/index.js";
import { EXAMPLE_CHARACTERS, BUILTIN_IDS, EXAMPLE_IDS, allCharacters } from "./catalog.js";
import { clear, copyLazy, fallbackBox, h, pretty } from "./dom.js";
import { createEditor, createPromptBlock } from "./import.js";

export function createCharacters(ctx) {
  const { state } = ctx;
  let shown = false;
  let minis = [];
  let confirming = null;
  let focusId = null;

  const grid = h("ul", { class: "gallery", "aria-label": "Characters" });
  const exportNote = h("div", { class: "export-note", role: "status" });

  /* ---------- gallery ---------- */

  function destroyMinis() {
    for (const m of minis) m.mount.destroy();
    minis = [];
  }

  const eyeColor = () => (state.eyeLight ? "#ffffff" : "#0a0a0a");
  const inkColor = () => (ctx.resolvedTheme() === "dark" ? "#ecebe6" : "#0a0a0a");

  function mini(host, c) {
    const mount = mountCharacter(host, {
      rig: c.rig,
      size: 72,
      color: ctx.colorOf(c),
      eyeColor: eyeColor(),
      inkColor: inkColor(),
      interactive: false,
      gaze: "none",
    });
    minis.push({ c, mount });
  }

  /** Marks the card of the character on the stage without rebuilding (keeps keyboard focus). */
  function markSelected() {
    for (const li of grid.children) {
      const on = li.dataset.id === state.character;
      li.classList.toggle("selected", on);
      li.querySelector(".card-main")?.setAttribute("aria-pressed", String(on));
    }
  }

  function refreshLook() {
    for (const { c, mount } of minis) mount.update({ color: ctx.colorOf(c), eyeColor: eyeColor(), inkColor: inkColor() });
    if (shown) editor.revalidate();
  }

  async function exportChar(c) {
    clear(exportNote);
    const r = await copyLazy(async () => pretty(c.definition));
    if (r.ok) exportNote.textContent = `Copied the JSON of "${c.name}".`;
    else {
      exportNote.appendChild(h("p", { class: "status" }, "The clipboard is not available here. Select and copy the JSON:"));
      exportNote.appendChild(fallbackBox(pretty(c.definition)));
    }
  }

  function removeChar(id) {
    state.userCharacters = state.userCharacters.filter((u) => u.id !== id);
    confirming = null;
    ctx.persist();
    if (state.character === id) ctx.selectCharacter("berry");
    else ctx.emit("characters");
    renderGallery();
  }

  function actions(c) {
    if (c.source !== "yours") return null;
    if (confirming === c.id)
      return h(
        "div",
        { class: "card-actions" },
        h("button", { type: "button", class: "btn danger", "data-act": `confirm-${c.id}`, onClick: () => removeChar(c.id) }, "Delete for good"),
        h("button", { type: "button", class: "btn", "data-act": `keep-${c.id}`, onClick: () => { confirming = null; focusId = `del-${c.id}`; renderGallery(); } }, "Keep"),
      );
    return h(
      "div",
      { class: "card-actions" },
      h("button", { type: "button", class: "btn", onClick: () => exportChar(c) }, "Export"),
      h("button", { type: "button", class: "btn", "data-act": `del-${c.id}`, onClick: () => { confirming = c.id; focusId = `confirm-${c.id}`; renderGallery(); } }, "Delete"),
    );
  }

  function renderGallery() {
    destroyMinis();
    clear(grid);
    if (!shown) return;
    for (const c of allCharacters(state)) {
      const host = h("div", { class: "mini" });
      const selected = c.id === state.character;
      grid.appendChild(
        h(
          "li",
          { class: `card${selected ? " selected" : ""}`, dataset: { id: c.id } },
          h(
            "button",
            { type: "button", class: "card-main", "aria-pressed": String(selected), "aria-label": `Show ${c.name} on the stage`, onClick: () => ctx.selectCharacter(c.id) },
            host,
            h("span", { class: "card-name" }, c.name),
            h("span", { class: "tag" }, c.source),
          ),
          actions(c),
        ),
      );
      mini(host, c);
    }
    if (focusId) grid.querySelector(`[data-act="${focusId}"]`)?.focus();
    focusId = null;
  }

  /* ---------- editor ---------- */

  let previewMount = null;
  let previewKey = null;

  function destroyPreview() {
    previewMount?.destroy();
    previewMount = null;
    previewKey = null;
  }

  const editor = createEditor({
    noun: "character",
    label: "Character definition (JSON)",
    placeholder: '{ "version": 1, "id": "my-bot", "name": "My bot", "body": { "path": "M…Z" }, "eyes": { … } }',
    examples: EXAMPLE_CHARACTERS.map((d) => ({ label: d.name, json: pretty(d) })),
    parse: parseCharacter,
    idOf: (v) => v.definition.id,
    checkId(id) {
      if (BUILTIN_IDS.has(id)) return { status: "blocked", message: `id: "${id}" is a built-in character; choose another id` };
      if (EXAMPLE_IDS.has(id)) return { status: "blocked", message: `id: "${id}" is an example character; choose another id` };
      return { status: state.userCharacters.some((u) => u.id === id) ? "replace" : "new" };
    },
    renderPreview(value, container) {
      if (!value) {
        destroyPreview();
        clear(container);
        container.appendChild(h("p", { class: "note" }, "A live preview appears here once the definition is valid."));
        return;
      }
      const key = JSON.stringify(value.definition) + eyeColor() + inkColor();
      if (previewMount && previewKey === key) return;
      const color = value.definition.rig?.color ?? "#6c8cff";
      const opts = { rig: value.rig, color, eyeColor: eyeColor(), inkColor: inkColor() };
      if (previewMount) previewMount.update(opts);
      else {
        clear(container);
        const host = h("div", { class: "preview-char" });
        container.appendChild(host);
        container.appendChild(h("p", { class: "note" }, "Live preview"));
        previewMount = mountCharacter(host, { ...opts, size: 140, interactive: false, gaze: "none", label: `Preview of ${value.definition.name}` });
      }
      previewKey = key;
    },
    onSave(result) {
      const { definition, rig } = result.value;
      const entry = { id: definition.id, definition, rig, warnings: result.warnings };
      const i = state.userCharacters.findIndex((u) => u.id === definition.id);
      if (i >= 0) state.userCharacters[i] = entry;
      else state.userCharacters.push(entry);
      ctx.persist();
      ctx.emit("characters");
      ctx.selectCharacter(definition.id);
    },
  });

  const ai = createPromptBlock({
    docUrl: "./docs/character-format.md",
    docName: "the character format",
    noun: "character",
    tail: "Character to create:",
    placeholder: "Describe your character, e.g. a shy cloud with two tiny wings",
    extra: h(
      "p",
      { class: "note" },
      "Definitions from ",
      h("a", { href: "https://github.com/DominikScholz/open-bot-avatar", target: "_blank", rel: "noopener" }, "Open Bot Avatar"),
      " paste in unchanged.",
    ),
  });

  const root = h(
    "div",
    { class: "tab-body" },
    h("section", { class: "group" }, h("h3", {}, "Gallery"), grid, exportNote),
    h("section", { class: "group" }, h("h3", {}, "Add a character"), editor.el, ai),
  );

  ctx.on("characters", () => shown && renderGallery());
  ctx.on("character", () => shown && markSelected());
  ctx.on("look", refreshLook);

  return {
    el: root,
    onShow() {
      shown = true;
      renderGallery();
      editor.setActive(true);
    },
    onHide() {
      shown = false;
      confirming = null;
      destroyMinis();
      editor.setActive(false);
    },
  };
}
