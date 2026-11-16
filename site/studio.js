/*
 * Studio entry point: loads the saved state, builds the stage and the four tabs,
 * and wires them together through a small shared context (`ctx`) with a tiny event bus.
 */

import { createAnimations } from "./animations.js";
import { buildAnimations, findCharacter, reservedAnimationIds, reservedCharacterIds } from "./catalog.js";
import { createCharacters } from "./characters.js";
import { h } from "./dom.js";
import { createPlay } from "./play.js";
import { createStage } from "./stage.js";
import { loadState, persist, state } from "./store.js";
import { createUsage } from "./usage.js";

loadState({ characters: reservedCharacterIds(), animations: reservedAnimationIds() });

/* ---------- context ---------- */

const listeners = new Map();
const dark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

const normalizeHex = (c) => {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(c);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : "#e11d2e";
};

const ctx = {
  state,
  /** Things that are not persisted: what the stage is doing right now. */
  session: { moodWeights: {}, activity: null, bend: true, reduced: false },
  persist,
  anim: buildAnimations(state),
  /** A scratch library used while previewing an animation that is not saved yet. */
  libraryOverride: null,
  stage: null,
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
  },
  emit(name) {
    for (const fn of listeners.get(name) ?? []) fn();
  },
  currentCharacter: () => findCharacter(state, state.character) ?? findCharacter(state, "berry"),
  colorOf: (c) => normalizeHex(state.colors[c.id] ?? c.color),
  resolvedTheme: () => (state.theme === "system" ? (dark?.matches ? "dark" : "light") : state.theme),
  selectCharacter(id) {
    state.character = findCharacter(state, id) ? id : "berry";
    persist();
    writeHash();
    ctx.stage.syncAll();
    ctx.emit("character");
  },
  setTheme(theme) {
    state.theme = theme;
    persist();
    applyTheme();
    ctx.stage.syncAll();
  },
  /** After a user animation is saved or deleted: rebuild the working library and tell everyone. */
  rebuildAnimations() {
    ctx.anim = buildAnimations(state);
    ctx.stage.syncAll();
    ctx.emit("library");
  },
};

function applyTheme() {
  if (state.theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", state.theme);
}

function writeHash() {
  try {
    history.replaceState(null, "", `#c=${encodeURIComponent(state.character)}`);
  } catch {
    /* some sandboxes forbid it; the hash is a convenience */
  }
}

function readHash() {
  const m = /^#c=([^&]+)/.exec(location.hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/* ---------- boot ---------- */

applyTheme();
const fromHash = readHash();
if (fromHash && findCharacter(state, fromHash)) state.character = fromHash;
if (!findCharacter(state, state.character)) state.character = "berry";

ctx.stage = createStage(ctx);
writeHash();
dark?.addEventListener?.("change", () => state.theme === "system" && ctx.emit("system-theme"));
window.addEventListener("hashchange", () => {
  const id = readHash();
  if (id && id !== state.character && findCharacter(state, id)) ctx.selectCharacter(id);
});

/* ---------- tabs ---------- */

const tabs = [
  { id: "play", label: "Play", view: createPlay(ctx) },
  { id: "characters", label: "Characters", view: createCharacters(ctx) },
  { id: "animations", label: "Animations", view: createAnimations(ctx) },
  { id: "use", label: "Use it", view: createUsage() },
];
let current = null;

const tablist = h("div", { class: "tablist", role: "tablist", "aria-label": "Studio sections" });
const panels = h("div", { class: "panels" });

for (const t of tabs) {
  t.button = h("button", {
    type: "button",
    role: "tab",
    class: "tab",
    id: `tab-${t.id}`,
    "aria-controls": `panel-${t.id}`,
    "aria-selected": "false",
    tabindex: "-1",
    onClick: () => activate(t.id),
  }, t.label);
  t.panel = h("div", { role: "tabpanel", class: "panel", id: `panel-${t.id}`, "aria-labelledby": `tab-${t.id}`, hidden: true, tabindex: "-1" }, t.view.el);
  tablist.appendChild(t.button);
  panels.appendChild(t.panel);
}

tablist.addEventListener("keydown", (ev) => {
  const i = tabs.findIndex((t) => t.button === document.activeElement);
  if (i < 0) return;
  const step = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
  let next = step !== undefined ? (i + step + tabs.length) % tabs.length : ev.key === "Home" ? 0 : ev.key === "End" ? tabs.length - 1 : -1;
  if (next < 0) return;
  ev.preventDefault();
  activate(tabs[next].id, true);
});

function activate(id, focus = false) {
  if (current === id) return;
  for (const t of tabs) {
    const on = t.id === id;
    if (!on && t.id === current) t.view.onHide?.();
    t.button.setAttribute("aria-selected", String(on));
    t.button.tabIndex = on ? 0 : -1;
    t.panel.hidden = !on;
    if (on) {
      t.view.onShow?.();
      if (focus) t.button.focus();
    }
  }
  current = id;
}

document.getElementById("stage-col").appendChild(ctx.stage.el);
document.getElementById("panel-col").append(tablist, panels);
activate("play");
document.body.dataset.ready = "1";
document.getElementById("loading")?.remove();
