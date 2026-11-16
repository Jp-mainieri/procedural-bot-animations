/*
 * Tab "Animations": browse every animation in the working library, see its timeline
 * play in sync with the stage, and add your own as JSON.
 */

import { addToLibrary, describeAnimation, parseAnimation } from "./dist/index.js";
import { EXAMPLE_ANIMATIONS, reservedAnimationIds, scratchLibrary } from "./catalog.js";
import { chip, clear, copyLazy, createSync, fallbackBox, h, humanize, pretty } from "./dom.js";
import { createEditor, createPromptBlock } from "./import.js";
import { createPlayer, createTimeline, periodOf } from "./timeline.js";

const KINDS = [
  ["all", "All"],
  ["reaction", "Reactions"],
  ["activity", "Activities"],
  ["mood", "Moods"],
];
const ORIGINS = [
  ["all", "All"],
  ["built-in", "Built-in"],
  ["example", "Examples"],
  ["yours", "Yours"],
];

export function createAnimations(ctx) {
  const { state, session } = ctx;
  const player = createPlayer(ctx.stage);
  const sync = createSync(); // filters
  const dsync = createSync(); // the selected animation's controls
  let kindFilter = "all";
  let originFilter = "all";
  let selectedKey = "reaction:success";
  let loop = false;
  let shown = false;
  let confirming = false;
  let detailTimeline = null;
  let previewId = null;

  const list = h("ul", { class: "anim-list", "aria-label": "Animations" });
  const count = h("p", { class: "note", role: "status" });
  const detail = h("div", { class: "detail" });
  const exportNote = h("div", { class: "export-note", role: "status" });

  const entries = () => ctx.anim.entries;
  const labelOf = (e) => (e.origin === "built-in" ? humanize(e.name) : e.name);
  const selected = () => entries().find((e) => e.key === selectedKey) ?? entries()[0];
  const visible = () => entries().filter((e) => (kindFilter === "all" || e.kind === kindFilter) && (originFilter === "all" || e.origin === originFilter));

  /* ---------- list ---------- */

  function renderList() {
    clear(list);
    const items = visible();
    count.textContent = `${items.length} animation${items.length === 1 ? "" : "s"}`;
    const sel = selected();
    const focusKey = items.some((e) => e.key === sel.key) ? sel.key : items[0]?.key;
    for (const e of items) {
      list.appendChild(
        h(
          "li",
          {},
          h(
            "button",
            {
              type: "button",
              class: "row",
              dataset: { key: e.key },
              "aria-pressed": String(e.key === sel.key),
              tabindex: e.key === focusKey ? "0" : "-1",
              onClick: () => select(e.key),
            },
            h("span", { class: "row-name" }, labelOf(e)),
            h("span", { class: "tag" }, e.kind),
            h("span", { class: "tag" }, e.origin),
          ),
        ),
      );
    }
    if (!items.length) list.appendChild(h("li", { class: "note" }, "Nothing matches these filters."));
  }

  list.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const rows = [...list.querySelectorAll(".row")];
    const i = rows.indexOf(document.activeElement);
    if (i < 0) return;
    ev.preventDefault();
    const next = rows[Math.max(0, Math.min(rows.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)))];
    rows.forEach((r) => r.setAttribute("tabindex", r === next ? "0" : "-1"));
    next.focus();
  });

  function select(key) {
    if (key !== selectedKey) {
      player.stop();
      loop = false;
      confirming = false;
      clear(exportNote);
    }
    selectedKey = key;
    for (const r of list.querySelectorAll(".row")) r.setAttribute("aria-pressed", String(r.dataset.key === key));
    renderDetail();
  }

  /* ---------- detail ---------- */

  const isOn = (e) => (e.kind === "activity" ? session.activity === e.id : e.kind === "mood" ? isMoodOn(e.id) : false);
  const isMoodOn = (id) => Object.keys(session.moodWeights).length === 1 && session.moodWeights[id] === 1;

  function toggleStage(e) {
    if (e.kind === "activity") {
      session.activity = isOn(e) ? null : e.id;
      ctx.stage.syncBehaviour();
      if (session.activity && e.definition) player.followActivity(periodOf(e), detailTimeline);
      else player.stop();
    } else {
      session.moodWeights = isOn(e) ? {} : { [e.id]: 1 };
      ctx.stage.syncBehaviour();
    }
    ctx.emit("session");
    renderDetail();
  }

  function playReaction(e) {
    const lib = ctx.libraryOverride ?? ctx.anim.library;
    const dur = lib.reactions[e.id]?.duration ?? 1;
    player.playReaction(e.id, dur, detailTimeline, () => loop);
  }

  async function exportEntry(e) {
    clear(exportNote);
    const r = await copyLazy(async () => pretty(e.definition));
    if (r.ok) exportNote.textContent = `Copied the JSON of "${e.name}".`;
    else {
      exportNote.appendChild(h("p", { class: "status" }, "The clipboard is not available here. Select and copy the JSON:"));
      exportNote.appendChild(fallbackBox(pretty(e.definition)));
    }
  }

  function removeEntry(e) {
    state.userAnimations = state.userAnimations.filter((u) => u.id !== e.id);
    ctx.persist();
    confirming = false;
    selectedKey = "reaction:success";
    player.stop();
    ctx.rebuildAnimations();
  }

  function renderDetail() {
    clear(detail);
    dsync.clear();
    const e = selected();
    if (!e) return;
    if (selectedKey !== e.key) selectedKey = e.key;
    const lib = ctx.anim.library;
    detailTimeline = createTimeline(e, lib);

    const controls = h("div", { class: "chips" });
    if (e.kind === "reaction") {
      controls.appendChild(chip("Play", { cls: "primary", onClick: () => playReaction(e) }));
      controls.appendChild(
        chip("Loop", {
          sync: dsync,
          isOn: () => loop,
          onClick: () => {
            loop = !loop;
            dsync.run();
            if (loop && !player.active) playReaction(e);
          },
        }),
      );
    } else {
      controls.appendChild(
        h("button", { type: "button", class: `btn${isOn(e) ? "" : " primary"}`, onClick: () => toggleStage(e) }, e.kind === "activity" ? (isOn(e) ? "Stop" : "Play on stage") : isOn(e) ? "Reset mood" : "Apply to stage"),
      );
    }
    if (e.origin === "yours") {
      controls.appendChild(h("button", { type: "button", class: "btn", onClick: () => exportEntry(e) }, "Export"));
      controls.appendChild(
        confirming
          ? h("span", { class: "inline-confirm" }, h("button", { type: "button", class: "btn danger", onClick: () => removeEntry(e) }, "Delete for good"), h("button", { type: "button", class: "btn", onClick: () => { confirming = false; renderDetail(); } }, "Keep"))
          : h("button", { type: "button", class: "btn", onClick: () => { confirming = true; renderDetail(); } }, "Delete"),
      );
    }

    const facts =
      e.kind === "reaction"
        ? `One-shot, ${Number((lib.reactions[e.id]?.duration ?? 0).toFixed(2))} s.`
        : e.kind === "activity"
          ? e.definition
            ? `Loop, ${e.definition.period} s.`
            : `Loop. Built-in loops have no fixed period, so the timeline samples ${periodOf(e)} s.`
          : "A held pose that blends with other moods.";

    detail.appendChild(h("div", { class: "detail-head" }, h("h4", {}, labelOf(e)), h("span", { class: "tag" }, e.kind), h("span", { class: "tag" }, e.origin)));
    detail.appendChild(h("p", { class: "detail-text" }, e.definition ? describeAnimation(e.definition) : "Built into the engine as code, so there is no JSON for it. The timeline below is sampled from the running function."));
    detail.appendChild(h("p", { class: "note" }, facts));
    detail.appendChild(controls);
    detail.appendChild(exportNote);
    detail.appendChild(detailTimeline.el);
    dsync.run();
    if (e.kind === "activity" && isOn(e) && e.definition) player.followActivity(periodOf(e), detailTimeline);
  }

  /* ---------- editor preview ---------- */

  function restorePreview() {
    if (!ctx.libraryOverride && previewId === null) return;
    player.stop();
    ctx.libraryOverride = null;
    if (previewId !== null) {
      const lib = ctx.anim.library;
      if (session.activity === previewId && !(previewId in lib.activities)) session.activity = null;
      if (session.moodWeights[previewId] !== undefined && !(previewId in lib.moods)) delete session.moodWeights[previewId];
      previewId = null;
      ctx.emit("session");
    }
    ctx.stage.syncBehaviour();
  }

  function renderPreview(value, container) {
    restorePreview();
    clear(container);
    if (!value) {
      container.appendChild(h("p", { class: "note" }, "A description and a preview appear here once the definition is valid."));
      return;
    }
    const def = value.definition;
    const scratch = scratchLibrary(ctx.anim.library);
    addToLibrary(scratch, value.compiled);
    const entry = { kind: def.kind, id: def.id, name: def.name, definition: def };
    const tl = createTimeline(entry, scratch);
    const play = () => {
      player.stop();
      ctx.libraryOverride = scratch;
      previewId = def.id;
      if (def.kind === "reaction") {
        ctx.stage.syncBehaviour();
        player.playReaction(def.id, def.duration, tl, () => false);
      } else if (def.kind === "activity") {
        session.activity = def.id;
        ctx.stage.syncBehaviour();
        player.followActivity(def.period, tl);
      } else {
        session.moodWeights = { [def.id]: 1 };
        ctx.stage.syncBehaviour();
      }
      ctx.emit("session");
    };
    container.appendChild(h("p", { class: "detail-text" }, describeAnimation(def)));
    container.appendChild(h("div", { class: "chips" }, h("button", { type: "button", class: "btn primary", onClick: play }, def.kind === "reaction" ? "Play on the stage" : def.kind === "activity" ? "Loop on the stage" : "Apply on the stage"), h("button", { type: "button", class: "btn", onClick: restorePreview }, "Stop preview")));
    container.appendChild(tl.el);
  }

  const reserved = reservedAnimationIds();
  const editor = createEditor({
    noun: "animation",
    label: "Animation definition (JSON)",
    placeholder: '{ "version": 1, "kind": "reaction", "id": "myNod", "name": "My nod", "duration": 1, "tracks": { … } }',
    examples: EXAMPLE_ANIMATIONS.map((d) => ({ label: `${d.name} (${d.kind})`, json: pretty(d) })),
    parse: parseAnimation,
    idOf: (v) => v.definition.id,
    checkId(id) {
      if (reserved.has(id)) return { status: "blocked", message: `id: "${id}" is already used by a built-in or example animation; choose another id` };
      return { status: state.userAnimations.some((u) => u.id === id) ? "replace" : "new" };
    },
    renderPreview,
    onSave(result) {
      const { definition, compiled } = result.value;
      restorePreview();
      const entry = { id: definition.id, definition, compiled, warnings: result.warnings };
      const i = state.userAnimations.findIndex((u) => u.id === definition.id);
      if (i >= 0) state.userAnimations[i] = entry;
      else state.userAnimations.push(entry);
      ctx.persist();
      selectedKey = `${definition.kind}:${definition.id}`;
      originFilter = "all";
      kindFilter = "all";
      ctx.rebuildAnimations();
    },
  });

  const ai = createPromptBlock({
    docUrl: "./docs/animation-format.md",
    docName: "the animation format",
    noun: "animation",
    tail: "Animation to create:",
    placeholder: "Describe your animation, e.g. a nervous double take",
  });

  /* ---------- assembly ---------- */

  function filterRow(label, options, get, set) {
    return h(
      "div",
      { class: "filter" },
      h("span", { class: "filter-label" }, label),
      h("div", { class: "seg", role: "group", "aria-label": label }, ...options.map(([value, text]) => chip(text, { sync, isOn: () => get() === value, onClick: () => { set(value); sync.run(); renderList(); } }))),
    );
  }

  const root = h(
    "div",
    { class: "tab-body" },
    h(
      "section",
      { class: "group" },
      h("h3", {}, "Library"),
      filterRow("Kind", KINDS, () => kindFilter, (v) => (kindFilter = v)),
      filterRow("Origin", ORIGINS, () => originFilter, (v) => (originFilter = v)),
      count,
      list,
      detail,
    ),
    h("section", { class: "group" }, h("h3", {}, "Add an animation"), editor.el, ai),
  );

  function refresh() {
    if (!shown) return;
    renderList();
    renderDetail();
  }

  ctx.on("library", refresh);
  ctx.on("session", () => shown && renderDetail());

  return {
    el: root,
    onShow() {
      shown = true;
      editor.setActive(true);
      refresh();
    },
    onHide() {
      shown = false;
      player.stop();
      confirming = false;
      restorePreview();
      editor.setActive(false);
    },
  };
}
