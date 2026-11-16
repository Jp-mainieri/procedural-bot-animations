/*
 * Timeline view of an animation: one row per field that is ever non-zero, with a
 * sparkline of its value over the whole animation and a playhead that follows playback.
 */

import { FIELD_GROUPS, FIELD_INFO } from "./dist/index.js";
import { h, svg } from "./dom.js";

const POINTS = 120;
const W = 300;
const H = 34;
const PAD = 5;
/** Built-in loops have no fixed period; they are sampled over this many seconds. */
export const DEFAULT_LOOP_SECONDS = 6;

const fieldOrder = Object.keys(FIELD_INFO);
const unitText = (field) => {
  const u = FIELD_INFO[field].unit;
  return u === "px" ? " px" : u === "deg" ? "°" : "";
};
const round = (v) => Number(v.toFixed(Math.abs(v) < 10 ? 3 : 1)).toString();

/** The seconds a loop is shown over: its own period, or a default for the built-ins. */
export const periodOf = (entry) => entry.definition?.period ?? DEFAULT_LOOP_SECONDS;

/** Rows for an animation: every field that is ever non-zero, in catalogue order. */
export function sampleRows(entry, library) {
  const { kind, id } = entry;
  const samplers = [];
  if (kind === "mood") {
    const pose = library.moods[id] ?? {};
    for (const [field, v] of Object.entries(pose)) if (field in FIELD_INFO && Math.abs(v) > 1e-9) samplers.push([field, () => v]);
    return finish(samplers.map(([field, f]) => ({ field, values: [f()] })));
  }
  let fn;
  if (kind === "reaction") {
    const def = library.reactions[id];
    if (!def) return [];
    fn = (i) => def.sample(i / (POINTS - 1));
  } else {
    const def = library.activities[id];
    if (!def) return [];
    const period = periodOf(entry);
    fn = (i) => def((i / (POINTS - 1)) * period);
  }
  const series = new Map();
  for (let i = 0; i < POINTS; i++) {
    const d = fn(i);
    for (const field of fieldOrder) {
      const v = d[field];
      if (v === undefined) continue;
      let arr = series.get(field);
      if (!arr) series.set(field, (arr = new Array(POINTS).fill(0)));
      arr[i] = Number.isFinite(v) ? v : 0;
    }
  }
  const rows = [];
  for (const [field, values] of series) if (values.some((v) => Math.abs(v) > 1e-6)) rows.push({ field, values });
  return finish(rows);

  function finish(list) {
    return list
      .map((r) => {
        const peak = r.values.reduce((p, v) => (Math.abs(v) > Math.abs(p) ? v : p), 0);
        return { ...r, group: FIELD_INFO[r.field].group, peak, keyframes: entry.definition?.tracks?.[r.field] ?? null };
      })
      .sort((a, b) => FIELD_GROUPS.indexOf(a.group) - FIELD_GROUPS.indexOf(b.group) || fieldOrder.indexOf(a.field) - fieldOrder.indexOf(b.field));
  }
}

function sparkline(row, kind) {
  const info = FIELD_INFO[row.field];
  const x = (t) => PAD + t * (W - 2 * PAD);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: `spark g-${row.group}`, role: "img", "aria-label": `${row.field}: peak ${round(row.peak)}${unitText(row.field)}` });
  let lo;
  let hi;
  if (kind === "mood") {
    lo = Math.min(0, info.min);
    hi = Math.max(0, info.max);
  } else {
    lo = Math.min(0, ...row.values);
    hi = Math.max(0, ...row.values);
    if (hi - lo < 1e-9) hi = lo + 1;
  }
  const y = (v) => PAD + ((hi - v) / (hi - lo)) * (H - 2 * PAD);
  root.appendChild(svg("line", { class: "spark-zero", x1: PAD, x2: W - PAD, y1: y(0), y2: y(0) }));
  if (kind === "mood") {
    const v = row.values[0];
    const xv = PAD + ((v - lo) / (hi - lo)) * (W - 2 * PAD);
    const x0 = PAD + ((0 - lo) / (hi - lo)) * (W - 2 * PAD);
    root.appendChild(svg("rect", { class: "spark-bar", x: Math.min(x0, xv), y: H / 2 - 5, width: Math.max(2, Math.abs(xv - x0)), height: 10, rx: 3 }));
    return { svg: root, playhead: null };
  }
  const pts = row.values.map((v, i) => `${x(i / (POINTS - 1)).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  root.appendChild(svg("polyline", { class: "spark-line", points: pts }));
  for (const [t, v] of row.keyframes ?? []) root.appendChild(svg("circle", { class: "spark-dot", cx: x(t), cy: y(v), r: 2.4 }));
  const playhead = svg("line", { class: "playhead", x1: x(0), x2: x(0), y1: 1, y2: H - 1, visibility: "hidden", "aria-hidden": "true" });
  root.appendChild(playhead);
  return { svg: root, playhead, x };
}

/**
 * Builds the timeline for an entry `{ kind, id, definition? }` against a library.
 * Returns `{ el, setPlayhead(t | null) }` with `t` in 0..1.
 */
export function createTimeline(entry, library) {
  const rows = sampleRows(entry, library);
  const heads = [];
  const list = h("div", { class: "tl-rows" });
  for (const row of rows) {
    const s = sparkline(row, entry.kind);
    if (s.playhead) heads.push({ line: s.playhead, x: s.x });
    list.appendChild(
      h(
        "div",
        { class: "tl-row" },
        h(
          "div",
          { class: "tl-label" },
          h("span", { class: `tl-field g-${row.group}` }, h("span", { class: "tl-swatch", "aria-hidden": "true" }), row.field),
          h("span", { class: "tl-meta" }, `${row.group}, ${entry.kind === "mood" ? "value" : "peak"} ${round(row.peak)}${unitText(row.field)}`),
        ),
        s.svg,
      ),
    );
  }
  if (!rows.length) list.appendChild(h("p", { class: "note" }, "This animation does not change any field."));

  const axis =
    entry.kind === "mood"
      ? null
      : h(
          "div",
          { class: "tl-axis" },
          h("span", {}, "start"),
          h("span", {}, entry.kind === "reaction" ? `${round(library.reactions[entry.id]?.duration ?? 0)} s` : `${round(periodOf(entry))} s${entry.definition ? "" : ", sampled"}`),
        );

  return {
    el: h("div", { class: "timeline", role: "group", "aria-label": `Timeline of ${entry.name}` }, list, axis),
    rowCount: rows.length,
    setPlayhead(t) {
      for (const { line, x } of heads) {
        if (t === null || t === undefined) line.setAttribute("visibility", "hidden");
        else {
          const px = x(Math.max(0, Math.min(1, t)));
          line.setAttribute("x1", px);
          line.setAttribute("x2", px);
          line.setAttribute("visibility", "visible");
        }
      }
    },
  };
}

/**
 * Drives a playhead while something plays on the stage. A reaction is followed through
 * `currentReaction()`; a loop shares the engine's clock (`performance.now() / 1000`).
 */
export function createPlayer(stage) {
  let w = null;
  let raf = 0;

  function stop() {
    if (w) w.tl?.setPlayhead(null);
    w = null;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function fire() {
    w.started = null;
    w.firedAt = performance.now();
    if (stage.react(w.id)) return true;
    stop();
    return false;
  }

  function tick() {
    if (!w) return;
    const now = performance.now();
    if (w.kind === "activity") {
      w.tl?.setPlayhead(((((now / 1000) % w.period) + w.period) % w.period) / w.period);
    } else {
      const cur = stage.currentReaction();
      if (w.started === null) {
        if (cur === w.id) w.started = now;
        else if (now - w.firedAt > 700) return stop();
      } else if (cur !== w.id) {
        w.tl?.setPlayhead(null);
        if (!w.loop() || !fire()) return stop();
      } else w.tl?.setPlayhead(Math.min(1, (now - w.started) / (w.duration * 1000)));
    }
    raf = requestAnimationFrame(tick);
  }

  return {
    /** Fires a reaction and follows it. `loop()` is asked each time it ends. */
    playReaction(id, duration, tl, loop = () => false) {
      stop();
      w = { kind: "reaction", id, duration, tl, loop, started: null, firedAt: 0 };
      if (!fire()) return false;
      raf = requestAnimationFrame(tick);
      return true;
    },
    /** Follows an activity that is already set on the stage. */
    followActivity(period, tl) {
      stop();
      w = { kind: "activity", period, tl };
      raf = requestAnimationFrame(tick);
    },
    stop,
    get active() {
      return w !== null;
    },
  };
}
