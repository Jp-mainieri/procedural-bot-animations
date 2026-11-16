/*
 * The stage: one large character on a ground line, a quiet toolbar, a readout of
 * the live gaze state and the last events, and the same character at three small sizes.
 * It owns the single main `mountCharacter`; characters are swapped with `update({ rig })`.
 */

import { mountCharacter } from "./dist/index.js";
import { SWATCHES, interactionsFor } from "./catalog.js";
import { chip, clear, createSync, h } from "./dom.js";

const SIZES = [32, 48, 96];
const LOG_LINES = 6;

export function createStage(ctx) {
  const { state, session } = ctx;
  const sync = createSync();

  /* ---------- toolbar ---------- */

  const nameEl = h("h2", { class: "stage-name", id: "stage-name" });
  const sourceEl = h("span", { class: "tag" });

  const swatches = SWATCHES.map((s) =>
    sync.add(
      h("button", {
        type: "button",
        class: "swatch",
        style: `--swatch:${s.value}`,
        title: s.name,
        "aria-label": `Body colour: ${s.name}`,
        onClick: () => setColor(s.value),
      }),
      () => currentColor().toLowerCase() === s.value,
    ),
  );
  const colorInput = h("input", {
    type: "color",
    class: "color-input",
    "aria-label": "Custom body colour",
    title: "Custom colour",
    onInput: (e) => setColor(e.target.value),
  });

  const eyeSeg = h(
    "div",
    { class: "seg", role: "group", "aria-label": "Eye colour" },
    chip("Dark eyes", { sync, isOn: () => !state.eyeLight, onClick: () => setEyes(false) }),
    chip("Light eyes", { sync, isOn: () => state.eyeLight, onClick: () => setEyes(true) }),
  );
  const themeSeg = h(
    "div",
    { class: "seg", role: "group", "aria-label": "Theme" },
    ...["light", "dark", "system"].map((t) =>
      chip(t[0].toUpperCase() + t.slice(1), { sync, isOn: () => state.theme === t, onClick: () => ctx.setTheme(t) }),
    ),
  );

  const toolbar = h(
    "div",
    { class: "stage-toolbar" },
    h("div", { class: "stage-title" }, nameEl, sourceEl),
    h("div", { class: "stage-controls" }, h("div", { class: "swatches", role: "group", "aria-label": "Body colour" }, ...swatches, colorInput), eyeSeg, themeSeg),
  );

  /* ---------- canvas ---------- */

  const charHost = h("div", { class: "stage-char" });
  const canvas = h("div", { class: "stage-canvas" }, charHost);

  /* ---------- readout ---------- */

  const attentionFill = h("span", { class: "meter-fill" });
  const boredomFill = h("span", { class: "meter-fill" });
  const meter = (label, fill) =>
    h(
      "div",
      { class: "meter-row" },
      h("span", { class: "meter-label" }, label),
      h("span", { class: "meter", role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 1, "aria-valuenow": 0 }, fill),
    );
  const attentionMeter = meter("Attention", attentionFill);
  const boredomMeter = meter("Boredom", boredomFill);
  const gazeText = h("span", { class: "readout-text" });
  const reactionText = h("span", { class: "readout-text" });
  const logList = h("ol", { class: "log", "aria-label": "Event log" });
  const log = [];

  const readout = h(
    "div",
    { class: "readout" },
    h("div", { class: "readout-top" }, h("div", { class: "meters" }, attentionMeter, boredomMeter), h("div", { class: "readout-texts" }, gazeText, reactionText)),
    logList,
  );

  /* ---------- sizes row ---------- */

  const sizeHosts = SIZES.map(() => h("div", { class: "size-host" }));
  const sizes = h(
    "div",
    { class: "sizes" },
    h(
      "div",
      { class: "sizes-row" },
      ...SIZES.map((px, i) => h("figure", { class: "size" }, sizeHosts[i], h("figcaption", {}, `${px} px`))),
    ),
    h("p", { class: "note" }, "Below 48 px the engine switches to a simpler drawing."),
  );

  const root = h("section", { class: "stage", "aria-labelledby": "stage-name" }, toolbar, canvas, readout, sizes);

  /* ---------- engine ---------- */

  function currentColor() {
    return ctx.colorOf(ctx.currentCharacter());
  }

  /** Everything about how the current character looks (not what it is doing). */
  function look() {
    const c = ctx.currentCharacter();
    return {
      rig: c.rig,
      color: ctx.colorOf(c),
      eyeColor: state.eyeLight ? "#ffffff" : "#0a0a0a",
      eyeStyle: state.eyeStyle,
      inkColor: ctx.resolvedTheme() === "dark" ? "#ecebe6" : "#0a0a0a",
      interactions: interactionsFor(c.rig),
    };
  }

  const moodValue = () => (Object.keys(session.moodWeights).length ? { ...session.moodWeights } : "neutral");

  function behaviour() {
    return {
      gaze: state.gaze,
      mood: moodValue(),
      activity: session.activity,
      bend: session.bend,
      reducedMotion: session.reduced ? true : "auto",
      library: ctx.libraryOverride ?? ctx.anim.library,
    };
  }

  const first = ctx.currentCharacter();
  const mounted = mountCharacter(charHost, {
    ...look(),
    ...behaviour(),
    label: `${first.name}, an animated character`,
    onEvent: (e) => pushEvent(`${e.type} · ${e.name}`),
  });

  const smalls = SIZES.map((size, i) =>
    mountCharacter(sizeHosts[i], { ...look(), size, interactive: false, gaze: "pointer", label: `${first.name} at ${size} pixels` }),
  );

  function pushEvent(text) {
    log.unshift(text);
    if (log.length > LOG_LINES) log.length = LOG_LINES;
    renderLog();
  }

  function renderLog() {
    clear(logList);
    if (!log.length) logList.appendChild(h("li", { class: "log-empty" }, "Hover or click the character to see events."));
    for (const line of log) logList.appendChild(h("li", {}, line));
  }

  /* ---------- changes ---------- */

  function header() {
    const c = ctx.currentCharacter();
    nameEl.textContent = c.name;
    sourceEl.textContent = c.source;
    colorInput.value = ctx.colorOf(c);
  }

  /** Pushes the whole look + behaviour into the engine (after the character, colours or library change). */
  function syncAll() {
    const l = look();
    mounted.update({ ...l, ...behaviour(), label: `${ctx.currentCharacter().name}, an animated character` });
    smalls.forEach((m) => m.update(l));
    ctx.emit("look");
    header();
    sync.run();
  }

  function setColor(value) {
    state.colors[state.character] = value;
    ctx.persist();
    syncAll();
  }

  function setEyes(light) {
    state.eyeLight = light;
    ctx.persist();
    syncAll();
  }

  function updateReadout() {
    if (document.hidden) return;
    const g = mounted.getGazeState();
    const set = (fill, wrap, v) => {
      const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
      fill.style.width = `${pct}%`;
      wrap.querySelector(".meter").setAttribute("aria-valuenow", (pct / 100).toFixed(2));
    };
    set(attentionFill, attentionMeter, g.attention);
    set(boredomFill, boredomMeter, g.boredom);
    gazeText.textContent = `Gaze: ${g.mode ?? state.gaze}${g.reason ? ` · ${g.reason}` : ""}${g.gliding ? " · gliding" : ""}`;
    reactionText.textContent = `Reaction: ${mounted.currentReaction() ?? "none"}`;
  }

  renderLog();
  header();
  sync.run();
  updateReadout();
  setInterval(updateReadout, 120);

  ctx.on("system-theme", syncAll);

  return {
    el: root,
    syncAll,
    /** Only the behaviour (mood, activity, gaze, bend, reduced motion, library). */
    syncBehaviour: () => mounted.update(behaviour()),
    update: (patch) => mounted.update(patch),
    react: (name) => mounted.react(name),
    currentReaction: () => mounted.currentReaction(),
    syncControls: () => sync.run(),
  };
}
