/*
 * The "add your own" editor, shared by characters and animations: a JSON textarea
 * (typed, pasted or dropped) validated on every edit, with errors and warnings,
 * a live preview slot and a save button. Plus the "Generate with AI" prompt block.
 */

import { clear, copyLazy, debounce, fallbackBox, h, pretty } from "./dom.js";

const MAX_FILE_BYTES = 256 * 1024;

/**
 * Options:
 *  - label, placeholder: for the textarea
 *  - noun: "character" or "animation" (button text)
 *  - parse(text): the engine's parser
 *  - idOf(value): id of a valid result
 *  - checkId(id): `{ status: "new" | "replace" | "blocked", message? }`
 *  - examples: [{ label, json }]
 *  - renderPreview(value | null, container): draws or clears the preview; called on every validation
 *  - onSave(result): stores it
 */
export function createEditor(opts) {
  let active = true;
  let result = null;
  let blocked = false;

  const ta = h("textarea", {
    class: "code",
    spellcheck: "false",
    autocomplete: "off",
    autocapitalize: "off",
    wrap: "off",
    rows: 14,
    placeholder: opts.placeholder,
    "aria-label": opts.label,
    "aria-describedby": `${opts.noun}-editor-msgs`,
  });

  const select = h(
    "select",
    { class: "select", "aria-label": `Load an example ${opts.noun}`, onChange: () => {
      const ex = opts.examples[Number(select.value)];
      select.value = "";
      if (ex) setText(ex.json);
    } },
    h("option", { value: "" }, "Load an example…"),
    ...opts.examples.map((ex, i) => h("option", { value: String(i) }, ex.label)),
  );

  const fileInput = h("input", {
    type: "file",
    accept: ".json,application/json",
    hidden: true,
    onChange: () => {
      const f = fileInput.files?.[0];
      fileInput.value = "";
      if (f) readFile(f);
    },
  });
  const fileButton = h("button", { type: "button", class: "btn", onClick: () => fileInput.click() }, "Open a .json file");

  const wrap = h("div", { class: "dropzone" }, ta);
  const hint = h("p", { class: "note" }, "Paste JSON, type it, or drop a .json file on the box.");

  const msgs = h("ul", { class: "msgs", id: `${opts.noun}-editor-msgs`, "aria-live": "polite" });
  const preview = h("div", { class: "preview" });
  const status = h("span", { class: "status", role: "status" });
  const saveButton = h("button", { type: "button", class: "btn primary", disabled: true, onClick: save }, `Save to my ${opts.noun}s`);

  const root = h(
    "div",
    { class: `editor ${opts.noun}` },
    h("div", { class: "editor-bar" }, select, fileButton, fileInput),
    wrap,
    hint,
    h("div", { class: "editor-result" }, msgs, preview),
    h("div", { class: "editor-actions" }, saveButton, status),
  );

  /* ---------- input ---------- */

  async function readFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      status.textContent = `That file is ${Math.round(file.size / 1024)} KB; the limit here is ${MAX_FILE_BYTES / 1024} KB.`;
      return;
    }
    try {
      setText(await file.text());
    } catch {
      status.textContent = "Could not read that file.";
    }
  }

  wrap.addEventListener("dragover", (e) => {
    e.preventDefault();
    wrap.classList.add("over");
  });
  wrap.addEventListener("dragleave", () => wrap.classList.remove("over"));
  wrap.addEventListener("drop", (e) => {
    e.preventDefault();
    wrap.classList.remove("over");
    const f = e.dataTransfer?.files?.[0];
    if (f) readFile(f);
  });

  const later = debounce(validate, 200);
  ta.addEventListener("input", () => {
    status.textContent = "";
    later();
  });

  function setText(text) {
    later.cancel();
    ta.value = text;
    status.textContent = "";
    validate();
  }

  /* ---------- validation ---------- */

  function line(kind, text) {
    return h("li", { class: `msg ${kind}` }, h("span", { class: "msg-tag" }, kind === "error" ? "Error" : kind === "warning" ? "Warning" : "Valid"), h("span", { class: "msg-text" }, text));
  }

  function validate() {
    clear(msgs);
    result = null;
    blocked = false;
    if (!ta.value.trim()) {
      msgs.appendChild(h("li", { class: "msg-empty" }, "Nothing to check yet."));
    } else {
      const r = opts.parse(ta.value);
      if (!r.ok) {
        for (const e of r.errors) msgs.appendChild(line("error", e));
      } else {
        const id = opts.idOf(r.value);
        const check = opts.checkId(id);
        blocked = check.status === "blocked";
        if (blocked) msgs.appendChild(line("error", check.message));
        else msgs.appendChild(line("valid", `"${id}" is valid${r.warnings.length ? ` with ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}` : ""}.`));
        for (const w of r.warnings) msgs.appendChild(line("warning", w));
        result = r;
        saveButton.textContent = check.status === "replace" ? `Replace "${id}"` : `Save to my ${opts.noun}s`;
      }
    }
    if (!result) saveButton.textContent = `Save to my ${opts.noun}s`;
    saveButton.disabled = !result || blocked;
    renderPreview();
  }

  function renderPreview() {
    opts.renderPreview(active && result ? result.value : null, preview);
  }

  function save() {
    if (!result || blocked) return;
    const id = opts.idOf(result.value);
    opts.onSave(result);
    status.textContent = `Saved "${id}".`;
    validate();
  }

  validate();

  return {
    el: root,
    setText,
    /** Suspends the preview (a mount) while the tab is hidden; resumes by validating again. */
    setActive(on) {
      active = on;
      if (on) validate();
      else opts.renderPreview(null, preview);
    },
    revalidate: validate,
  };
}

/**
 * "Generate with AI": a three-step explainer and a button that copies the format document
 * plus the user's description, ready to paste into any LLM chat.
 */
export function createPromptBlock({ docUrl, docName, noun, tail, placeholder, extra }) {
  const input = h("input", { type: "text", class: "text-input", placeholder, "aria-label": `Describe your ${noun}`, maxlength: 400 });
  const status = h("p", { class: "status", role: "status" });
  const fallback = h("div", { class: "fallback-wrap" });
  const button = h("button", { type: "button", class: "btn", onClick: copyPrompt }, "Copy prompt");

  async function copyPrompt() {
    clear(fallback);
    const description = input.value.trim();
    if (!description) {
      status.textContent = `Describe your ${noun} first.`;
      input.focus();
      return;
    }
    status.textContent = "Copying…";
    const r = await copyLazy(async () => {
      const res = await fetch(docUrl, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return `${await res.text()}\n\n${tail} ${description}`;
    });
    if (r.ok) status.textContent = `Prompt copied (${r.text.length.toLocaleString("en-US")} characters). Paste it into your LLM chat.`;
    else if (r.text) {
      status.textContent = "The clipboard is not available here. Select and copy the text below.";
      fallback.appendChild(fallbackBox(r.text));
    } else {
      const why = r.error instanceof Error ? r.error.message : "unknown error";
      status.textContent = `Could not load ${docName} (${why}). Open it directly: ${docUrl}`;
    }
  }

  return h(
    "details",
    { class: "disclosure ai" },
    h("summary", {}, `Generate a ${noun} with AI`),
    h(
      "ol",
      { class: "steps" },
      h("li", {}, `Describe the ${noun} below.`),
      h("li", {}, "Copy the prompt and paste it into any LLM chat."),
      h("li", {}, `Paste the JSON it returns into the editor above.`),
    ),
    extra,
    h("div", { class: "ai-row" }, input, button),
    status,
    fallback,
  );
}

export { pretty };
