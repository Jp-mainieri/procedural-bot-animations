/*
 * Tab "Play": gaze, eyes, mood (single or blended), activity, reactions, physics and accessibility.
 * Reaction groups come from the library keys, so a reaction missing from the named groups lands in "Other".
 */

import { chip, clear, createSync, h, humanize } from "./dom.js";

const NAMED_GROUPS = [
  ["App flow", ["success", "successExercise", "successModule", "almostThere", "fright", "idea", "copiedThat", "welcome"]],
  ["Personality", ["wink", "cheerful", "profile", "flatten", "confused", "somersault", "dizzy", "wake", "peek", "shy", "doubleHop", "laugh", "huff", "hide"]],
  ["Transformations", ["morphLoading", "morphCheck", "morphCode", "energy"]],
];
const FLAME_REACTIONS = ["ignite", "extinguish", "blaze", "gust", "crackle", "sneeze", "tierUp", "warmUp", "heatUp", "burst"];
const FLAME_ACTIVITIES = ["flickering", "out"];

export const REACTION_GROUPS = { named: NAMED_GROUPS, flame: FLAME_REACTIONS };

const ANCHOR_STATES = [null, "smooth", "fast"];

export function createPlay(ctx) {
  const { state, session } = ctx;
  const root = h("div", { class: "tab-body" });
  const sync = createSync();
  let sliders = [];
  const anchors = [
    { label: "Anchor A", mode: null, el: null },
    { label: "Anchor B", mode: null, el: null },
    { label: "Anchor C", mode: null, el: null },
  ];
  let shown = false;
  let anchorBox = null;

  const flame = () => ctx.currentCharacter().rig.flicker > 0;
  const library = () => ctx.anim.library;
  const nameOf = (kind, id) => ctx.anim.entries.find((e) => e.kind === kind && e.id === id)?.name ?? id;
  const labelOf = (kind, id) => {
    const e = ctx.anim.entries.find((x) => x.kind === kind && x.id === id);
    return e && e.origin !== "built-in" ? e.name : humanize(id);
  };

  const group = (title, ...kids) => h("section", { class: "group" }, h("h3", {}, title), ...kids);
  const chips = (...els) => h("div", { class: "chips" }, ...els);

  /* ---------- focus anchors ---------- */

  function applyAnchors() {
    const active = shown && state.gaze !== "pointer";
    for (const a of anchors) {
      if (!a.el) continue;
      if (active && a.mode) a.el.setAttribute("data-bot-focus", a.mode === "fast" ? "fast" : "smooth");
      else a.el.removeAttribute("data-bot-focus");
    }
    if (anchorBox) anchorBox.hidden = state.gaze === "pointer";
  }

  function anchorChip(a) {
    const el = h("button", { type: "button", class: "chip", onClick: () => cycle(a) });
    a.el = el;
    paintAnchor(a);
    return el;
  }
  function paintAnchor(a) {
    a.el.textContent = `${a.label}: ${a.mode ?? "off"}`;
    a.el.setAttribute("aria-pressed", String(!!a.mode));
  }
  function cycle(a) {
    a.mode = ANCHOR_STATES[(ANCHOR_STATES.indexOf(a.mode) + 1) % ANCHOR_STATES.length];
    paintAnchor(a);
    applyAnchors();
  }

  /* ---------- state changes ---------- */

  function setMood(id) {
    session.moodWeights = id === "neutral" ? {} : { [id]: 1 };
    refreshSliders();
    ctx.stage.syncBehaviour();
    ctx.emit("session");
  }
  function setBlend(id, v) {
    if (v > 0) session.moodWeights[id] = v;
    else delete session.moodWeights[id];
    ctx.stage.syncBehaviour();
    sync.run();
    ctx.emit("session");
  }
  function refreshSliders() {
    for (const s of sliders) {
      s.input.value = String(session.moodWeights[s.id] ?? 0);
      s.out.textContent = Number(s.input.value).toFixed(2);
    }
    sync.run();
  }
  const activeMood = () => {
    const keys = Object.keys(session.moodWeights);
    return keys.length === 0 ? "neutral" : keys.length === 1 && session.moodWeights[keys[0]] === 1 ? keys[0] : null;
  };

  /* ---------- rendering ---------- */

  function render() {
    sync.clear();
    sliders = [];
    clear(root);
    const lib = library();

    // Gaze
    const gazeChips = ["pointer", "free", "focus"].map((g) =>
      chip(g, {
        sync,
        isOn: () => state.gaze === g,
        onClick: () => {
          state.gaze = g;
          ctx.persist();
          ctx.stage.syncBehaviour();
          sync.run();
          applyAnchors();
        },
      }),
    );
    anchorBox = h(
      "div",
      { class: "anchors" },
      h("p", { class: "note" }, "Focus anchors: click one to cycle off, smooth, fast. In free and focus modes the character glances at anchors."),
      chips(...anchors.map(anchorChip)),
      h("input", { type: "text", class: "text-input", placeholder: "Type here, it reads along", "aria-label": "Test field for the gaze" }),
    );
    root.appendChild(group("Gaze", chips(...gazeChips), anchorBox));

    // Eyes
    root.appendChild(
      group(
        "Eyes",
        chips(
          ...["classic", "pumpy", "big"].map((s) =>
            chip(s, {
              sync,
              isOn: () => state.eyeStyle === s,
              onClick: () => {
                state.eyeStyle = s;
                ctx.persist();
                ctx.stage.syncAll();
                sync.run();
              },
            }),
          ),
        ),
      ),
    );

    // Mood
    const moodIds = Object.keys(lib.moods);
    const moodChips = moodIds.map((id) => chip(labelOf("mood", id), { sync, isOn: () => activeMood() === id, onClick: () => setMood(id) }));
    const blend = h(
      "details",
      { class: "disclosure" },
      h("summary", {}, "Blend moods"),
      h("p", { class: "note" }, "Mix several moods at once: each slider is a weight from 0 to 1."),
      ...moodIds
        .filter((id) => id !== "neutral")
        .map((id) => {
          const out = h("output", { class: "slider-out" }, "0.00");
          const input = h("input", {
            type: "range",
            min: 0,
            max: 1,
            step: 0.05,
            value: String(session.moodWeights[id] ?? 0),
            "aria-label": `${labelOf("mood", id)} weight`,
            onInput: (e) => {
              out.textContent = Number(e.target.value).toFixed(2);
              setBlend(id, Number(e.target.value));
            },
          });
          out.textContent = Number(input.value).toFixed(2);
          sliders.push({ id, input, out });
          return h("label", { class: "slider-row" }, h("span", { class: "slider-name" }, labelOf("mood", id)), input, out);
        }),
    );
    root.appendChild(group("Mood", chips(...moodChips), blend));

    // Activity
    const activityIds = Object.keys(lib.activities).filter((id) => flame() || !FLAME_ACTIVITIES.includes(id));
    root.appendChild(
      group(
        "Activity",
        chips(
          chip("none", { sync, isOn: () => !session.activity, onClick: () => setActivity(null) }),
          ...activityIds.map((id) => chip(labelOf("activity", id), { sync, isOn: () => session.activity === id, onClick: () => setActivity(id) })),
        ),
      ),
    );

    // Reactions
    const all = Object.keys(lib.reactions);
    const originOf = (id) => ctx.anim.entries.find((e) => e.kind === "reaction" && e.id === id)?.origin;
    const named = new Set([...NAMED_GROUPS.flatMap(([, ids]) => ids), ...FLAME_REACTIONS]);
    const groups = NAMED_GROUPS.map(([title, ids]) => [title, ids.filter((id) => id in lib.reactions)]);
    if (flame()) groups.push(["Flame", FLAME_REACTIONS.filter((id) => id in lib.reactions)]);
    groups.push(["Examples", all.filter((id) => originOf(id) === "example")]);
    groups.push(["Yours", all.filter((id) => originOf(id) === "yours")]);
    groups.push(["Other", all.filter((id) => !named.has(id) && !originOf(id)?.match(/^(example|yours)$/))]);
    const reactionSection = group("Reactions");
    for (const [title, ids] of groups) {
      if (!ids.length) continue;
      reactionSection.appendChild(h("h4", {}, title));
      reactionSection.appendChild(chips(...ids.map((id) => chip(labelOf("reaction", id), { cls: "action", onClick: () => ctx.stage.react(id) }))));
    }
    root.appendChild(reactionSection);
    root.appendChild(h("p", { class: "hint" }, "Hover and click the character: it reacts on its own."));

    // Physics and accessibility
    root.appendChild(
      group(
        "Physics and accessibility",
        chips(
          chip("Part bending", {
            sync,
            isOn: () => session.bend,
            onClick: () => {
              session.bend = !session.bend;
              ctx.stage.syncBehaviour();
              sync.run();
            },
          }),
          chip("Reduced motion", {
            sync,
            isOn: () => session.reduced,
            onClick: () => {
              session.reduced = !session.reduced;
              ctx.stage.syncBehaviour();
              sync.run();
            },
          }),
        ),
        h("p", { class: "note" }, "Without the second one, the engine already follows your system's reduced-motion setting."),
      ),
    );
    applyAnchors();
  }

  function setActivity(id) {
    session.activity = id;
    ctx.stage.syncBehaviour();
    sync.run();
    ctx.emit("session");
  }

  /** A flame-only activity cannot stay selected on a character that does not flicker. */
  function fixSession() {
    if (!flame() && FLAME_ACTIVITIES.includes(session.activity)) session.activity = null;
    if (session.activity && !(session.activity in library().activities)) session.activity = null;
    for (const id of Object.keys(session.moodWeights)) if (!(id in library().moods)) delete session.moodWeights[id];
  }

  ctx.on("character", () => {
    fixSession();
    ctx.stage.syncBehaviour();
    render();
  });
  ctx.on("library", () => {
    fixSession();
    ctx.stage.syncBehaviour();
    render();
  });
  ctx.on("session", () => {
    refreshSliders();
  });

  render();

  return {
    el: root,
    onShow() {
      shown = true;
      applyAnchors();
    },
    onHide() {
      shown = false;
      applyAnchors();
    },
    nameOf,
  };
}
