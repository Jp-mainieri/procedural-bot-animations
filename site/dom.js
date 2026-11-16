/* Tiny DOM helpers shared by the Studio modules. No framework. */

/** Creates an element. `props`: class, text, dataset, onClick-style listeners, value/checked/disabled/hidden, anything else becomes an attribute. */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value" || k === "checked") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, kids);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Creates an SVG element with attributes. */
export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.appendChild(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function debounce(fn, ms) {
  let id = 0;
  const wrapped = (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(id);
  return wrapped;
}

export const pretty = (obj) => JSON.stringify(obj, null, 2);

/** "successExercise" -> "success exercise". */
export const humanize = (id) => id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

/* ---------- toggle buttons that stay in sync with state ---------- */

/** A set of buttons whose `aria-pressed` follows a predicate. Call `run()` after any state change. */
export function createSync() {
  const items = [];
  return {
    add(el, isOn) {
      items.push([el, isOn]);
      el.setAttribute("aria-pressed", String(!!isOn()));
      return el;
    },
    run() {
      for (const [el, isOn] of items) el.setAttribute("aria-pressed", String(!!isOn()));
    },
    clear() {
      items.length = 0;
    },
  };
}

/** A chip button. With `sync` and `isOn` it is a toggle; without, a plain action. */
export function chip(label, { onClick, sync, isOn, cls, title, disabled } = {}) {
  const el = h("button", { type: "button", class: `chip${cls ? ` ${cls}` : ""}`, title, disabled, onClick }, label);
  if (sync && isOn) sync.add(el, isOn);
  return el;
}

/* ---------- clipboard ---------- */

async function legacyCopy(text) {
  const ta = h("textarea", { readonly: true, style: "position:fixed;top:0;left:0;opacity:0" });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

/**
 * Copies text that may take a moment to produce (a fetch). Uses the promise form
 * of `ClipboardItem` where it exists, so the user gesture is still valid when the text arrives.
 * Resolves to `{ ok, text?, error? }`: `text` is present whenever it could be produced.
 */
export async function copyLazy(getText) {
  let pending = null;
  const get = () => (pending ??= Promise.resolve().then(getText));
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
    try {
      const blob = get().then((t) => new Blob([t], { type: "text/plain" }));
      await navigator.clipboard.write([new window.ClipboardItem({ "text/plain": blob })]);
      return { ok: true, text: await get() };
    } catch {
      /* fall through to the plain paths */
    }
  }
  let text;
  try {
    text = await get();
  } catch (error) {
    return { ok: false, error };
  }
  return { ok: await copyText(text), text };
}

/** A read-only, auto-selecting text box for when the clipboard is not available. */
export function fallbackBox(text) {
  const ta = h("textarea", { class: "code fallback", readonly: true, rows: 8, wrap: "off", "aria-label": "Text to copy" });
  ta.value = text;
  ta.addEventListener("focus", () => ta.select());
  return ta;
}
