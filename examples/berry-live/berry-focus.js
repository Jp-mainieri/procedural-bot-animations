/**
 * Ported from DevBerry's `lib/berry/foco.ts`. Where the character looks when
 * it isn't following the mouse. Two modes:
 *
 * - `focus`: looks at what matters. A page event (a field got focus, typing,
 *   a click, scrolling) pulls the gaze; with nothing happening, it holds on
 *   the page's focus anchors, and with no anchors, picks something.
 * - `free`: wanders, the eye drifting across the page. Anything can catch
 *   its attention (an event, an anchor, an element) and pull it into focus;
 *   once the interest passes, it goes back to wandering.
 *
 * A focus anchor: any element with `data-berry-focus`. Its value picks the
 * arrival: `fast` (a hop, as if noticing something) or `smooth` (default:
 * the eye glides there). Setting the attribute grabs attention immediately;
 * with several anchors, it alternates between them.
 */
export const ANCHOR_ATTRIBUTE = "data-berry-focus";

const WEIGHT = { focus: 0.55, key: 0.12, click: 0.4, scroll: 0.2, anchor: 0.35 };
const DURATION_MS = { focus: 3500, key: 1600, click: 1800, scroll: 1200, anchor: 4000 };
const GLIDE = { focus: 0, click: 0, key: 0.18, scroll: 0.35 };
const ANCHOR_GLIDE = 0.55;

let lastEvent = null;
let subscribers = 0;
let prevScroll = 0;
let teardown = null;

const centerOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const isEditable = (el) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable);
const isAnchor = (el) => !!el && el.isConnected && el.hasAttribute(ANCHOR_ATTRIBUTE);
const anchorGlide = (el) => (el.getAttribute(ANCHOR_ATTRIBUTE) === "fast" ? 0 : ANCHOR_GLIDE);

function textCursorPoint(el) {
  const r = el.getBoundingClientRect();
  const value = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? "");
  const width = Math.max(40, r.width - 24);
  const advance = (value.length * 8.5) % width;
  const line = Math.floor((value.length * 8.5) / width);
  const y = el instanceof HTMLTextAreaElement ? r.top + 14 + (line % 4) * 20 : r.top + r.height / 2;
  return { x: r.left + 12 + advance, y: Math.min(y, r.bottom - 8) };
}

function attach() {
  const mark = (point, type, el = null) => (lastEvent = { point, t: performance.now(), type, el });
  const onFocus = (e) => { const el = e.target; if (el && el !== document.body) mark(centerOf(el), "focus", el); };
  const onKey = () => { const el = document.activeElement; if (isEditable(el)) requestAnimationFrame(() => mark(textCursorPoint(el), "key")); };
  const onClick = (e) => mark({ x: e.clientX, y: e.clientY }, "click");
  const onScroll = () => {
    const y = window.scrollY;
    const down = y > prevScroll;
    prevScroll = y;
    mark({ x: window.innerWidth / 2, y: down ? window.innerHeight : 0 }, "scroll");
  };
  const mo = new MutationObserver((list) => {
    anchorCache.until = 0;
    for (const m of list) {
      if (m.type === "attributes" && isAnchor(m.target)) { mark(centerOf(m.target), "anchor", m.target); return; }
      for (const n of Array.from(m.addedNodes)) {
        if (!(n instanceof Element)) continue;
        const el = isAnchor(n) ? n : n.querySelector(`[${ANCHOR_ATTRIBUTE}]`);
        if (el) { mark(centerOf(el), "anchor", el); return; }
      }
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: [ANCHOR_ATTRIBUTE] });
  prevScroll = window.scrollY;
  document.addEventListener("focusin", onFocus);
  document.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onClick, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    mo.disconnect();
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onClick);
    window.removeEventListener("scroll", onScroll);
  };
}

/** Starts observing the page; returns the function that stops it. */
export function observePage() {
  if (subscribers++ === 0) teardown = attach();
  return () => {
    if (--subscribers === 0) { teardown?.(); teardown = null; lastEvent = null; }
  };
}

const INTERESTING = 'h1,h2,h3,button,a[href],input,textarea,select,img,video,[role="button"]';
const onScreen = (r) => r.width >= 8 && r.height >= 8 && r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth;
const within = (r, of) => r.left >= of.left && r.right <= of.right && r.top >= of.top && r.bottom <= of.bottom;

function visibleElement(rng, excludeRect) {
  const list = Array.from(document.querySelectorAll(INTERESTING)).slice(0, 120);
  const visible = list.filter((el) => { const r = el.getBoundingClientRect(); return onScreen(r) && !within(r, excludeRect); });
  if (!visible.length) return null;
  return centerOf(visible[Math.floor(rng() * visible.length)]);
}

const anchorCache = { until: 0, list: [] };
function visibleAnchors(now, excludeRect) {
  if (now > anchorCache.until) {
    anchorCache.list = Array.from(document.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`));
    anchorCache.until = now + 300;
  }
  return anchorCache.list.filter((el) => { if (!el.isConnected) return false; const r = el.getBoundingClientRect(); return onScreen(r) && !within(r, excludeRect); });
}

export function newFocusState() {
  return { point: null, el: null, until: 0, seen: 0, nextCursor: 0, glide: 0, mode: "free", reason: null, anchorIndex: 0 };
}

function go(f, point, el, until, glide, mode, reason) {
  f.point = point; f.el = el; f.until = until; f.glide = glide; f.mode = mode; f.reason = reason;
}
function decisionFrom(f, interest) {
  if (f.el && f.el.isConnected) f.point = centerOf(f.el);
  return { point: f.point, interest, glide: f.glide, mode: f.mode, reason: f.reason };
}
function nextAnchor(f, anchors) {
  if (anchors.length > 1 && f.el && anchors.includes(f.el)) f.anchorIndex++;
  return anchors[f.anchorIndex % anchors.length];
}

/** Decides where to look right now, in the requested mode. Call every frame. */
export function decideGaze(f, now, rng, myRect, cursor, mode) {
  const ev = lastEvent;
  if (ev && ev.t > f.seen) {
    f.seen = ev.t;
    const glide = ev.type === "anchor" ? (ev.el ? anchorGlide(ev.el) : 0) : GLIDE[ev.type];
    go(f, ev.point, ev.el, now + DURATION_MS[ev.type], glide, "focus", ev.type);
    return decisionFrom(f, WEIGHT[ev.type]);
  }

  if (f.reason === "anchor" && !isAnchor(f.el)) f.until = 0;

  const cx = myRect.left + myRect.width / 2;
  const cy = myRect.top + myRect.height / 2;
  const near = Math.hypot(cursor.x - cx, cursor.y - cy) < Math.max(220, myRect.width * 1.6);
  if (cursor.inside && near && now - cursor.last < 300 && now > f.nextCursor) {
    f.nextCursor = now + 3000;
    go(f, { x: cursor.x, y: cursor.y }, null, now + 1100, 0, "focus", "cursor");
    return decisionFrom(f, 0.3);
  }

  if (now <= f.until) return decisionFrom(f, 0);

  const anchors = visibleAnchors(now, myRect);
  const r = rng();
  if (mode === "focus") {
    if (anchors.length) {
      if (f.reason === "anchor" && r < 0.15) { go(f, "screen", null, now + 900 + rng() * 600, 0, "focus", "screen"); return decisionFrom(f, 0); }
      const el = nextAnchor(f, anchors);
      go(f, null, el, now + 2500 + rng() * 2000, anchorGlide(el), "focus", "anchor");
      return decisionFrom(f, 0.1);
    }
    const active = document.activeElement;
    if (r < 0.22) go(f, "screen", null, now + 1400 + rng() * 3200, 0, "focus", "screen");
    else if (r < 0.45 && isEditable(active)) go(f, textCursorPoint(active), null, now + 1400 + rng() * 3200, 0, "focus", "text");
    else { const p = visibleElement(rng, myRect); go(f, p, null, now + 1400 + rng() * 3200, 0, "focus", p ? "element" : null); }
    return decisionFrom(f, f.reason === "element" || f.reason === "text" ? 0.12 : 0);
  }

  if (anchors.length && r < 0.15) { const el = nextAnchor(f, anchors); go(f, null, el, now + 1800 + rng() * 1400, 0, "focus", "anchor"); return decisionFrom(f, 0.25); }
  if (r < 0.25) { const p = visibleElement(rng, myRect); if (p) { go(f, p, null, now + 900 + rng() * 700, 0, "focus", "element"); return decisionFrom(f, 0.15); } }
  if (r < 0.37) { go(f, "screen", null, now + 1200 + rng() * 1200, 0.6, "free", "screen"); return decisionFrom(f, 0); }
  const p = rng() < 0.5 ? visibleElement(rng, myRect) : { x: rng() * window.innerWidth, y: rng() * window.innerHeight };
  go(f, p, null, now + 900 + rng() * 1300, 0.7 + rng() * 0.6, "free", "wander");
  return decisionFrom(f, 0);
}
