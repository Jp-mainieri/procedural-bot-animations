import type { Rng } from "./motion.js";

/*
 * Where the character looks when it isn't following the mouse. Two modes:
 *
 * - `focus`: looks at what matters. A page event (a field got focus, typing,
 *   a click, scrolling) pulls the gaze; with nothing happening, it stays on
 *   the site's anchors and, with no anchors, picks something.
 * - `free`: wanders, with the eye gliding across the page. At any moment
 *   something can catch its attention (an event, an anchor, an element) and it
 *   goes into focus; once the interest passes, it goes back to wandering.
 *
 * Focus anchor: any element with `data-bot-focus` (like the focus of a text
 * box, but declared by the site). The value picks the transition: `fast` (a
 * hop, like noticing something) or `smooth` (the default: the eye glides
 * there). Setting the attribute on an element grabs attention immediately;
 * with several anchors, it alternates between them.
 *
 * Each target change says how the eye arrives: `glide` in seconds (smooth
 * curve) or 0 (a saccade, the fast hop).
 *
 * A single observer (shared, like the ticker) keeps the last event; each
 * character decides with its own state.
 */

export const ANCHOR_ATTRIBUTE = "data-bot-focus";

type Point = { x: number; y: number };
type Kind = "focus" | "key" | "click" | "scroll" | "anchor";
type PageEvent = { point: Point; t: number; kind: Kind; el: Element | null };

export type GazeMode = "free" | "focus";
export type Reason = Kind | "cursor" | "screen" | "text" | "element" | "wander";

export type Decision = {
  /** Window px, `'screen'` (look at whoever is in front) or `null` (the brain wanders). */
  point: Point | "screen" | null;
  /** Attention impulse of this frame. */
  interest: number;
  /** Seconds to glide to the target; 0 = saccade. */
  glide: number;
  /** In focus (something held the gaze) or wandering. */
  mode: GazeMode;
  reason: Reason | null;
};

const WEIGHT: Record<Kind, number> = {
  focus: 0.55,
  key: 0.12,
  click: 0.4,
  scroll: 0.2,
  anchor: 0.35,
};
const DURATION: Record<Kind, number> = {
  focus: 3500,
  key: 1600,
  click: 1800,
  scroll: 1200,
  anchor: 4000,
};
/** How the eye arrives at each event: a hop (0) or a glide (seconds). */
const GLIDE: Record<Exclude<Kind, "anchor">, number> = {
  focus: 0,
  click: 0,
  // Reading the text: the eye follows the text cursor, gliding.
  key: 0.18,
  scroll: 0.35,
};
/** Glide to a `smooth` anchor (and back to it). */
const ANCHOR_GLIDE = 0.55;

let lastEvent: PageEvent | null = null;
let subscribers = 0;
let prevScroll = 0;
let teardown: (() => void) | null = null;

const centerOf = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

const isEditable = (el: Element | null): el is HTMLElement =>
  !!el &&
  (el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el as HTMLElement).isContentEditable);

const isAnchor = (el: Element | null): boolean =>
  !!el && el.isConnected && el.hasAttribute(ANCHOR_ATTRIBUTE);

const anchorGlide = (el: Element) => (el.getAttribute(ANCHOR_ATTRIBUTE) === "fast" ? 0 : ANCHOR_GLIDE);

/** Where the end of the text in a field is (approximate: 8.5 px per character). */
function textCursorPoint(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  const value =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      ? el.value
      : (el.textContent ?? "");
  const width = Math.max(40, r.width - 24);
  const advance = (value.length * 8.5) % width;
  const line = Math.floor((value.length * 8.5) / width);
  const y =
    el instanceof HTMLTextAreaElement ? r.top + 14 + (line % 4) * 20 : r.top + r.height / 2;
  return { x: r.left + 12 + advance, y: Math.min(y, r.bottom - 8) };
}

function attach() {
  const mark = (point: Point, kind: Kind, el: Element | null = null) =>
    (lastEvent = { point, t: performance.now(), kind, el });
  const onFocus = (e: FocusEvent) => {
    const el = e.target as Element;
    if (el && el !== document.body) mark(centerOf(el), "focus", el);
  };
  const onKey = () => {
    const el = document.activeElement;
    if (isEditable(el)) requestAnimationFrame(() => mark(textCursorPoint(el), "key"));
  };
  const onClick = (e: PointerEvent) => mark({ x: e.clientX, y: e.clientY }, "click");
  const onScroll = () => {
    const y = window.scrollY;
    const down = y > prevScroll;
    prevScroll = y;
    mark({ x: window.innerWidth / 2, y: down ? window.innerHeight : 0 }, "scroll");
  };
  // New anchor (attribute set or element inserted): grabs attention immediately.
  const mo = new MutationObserver((list) => {
    anchorCache.until = 0;
    for (const m of list) {
      if (m.type === "attributes" && isAnchor(m.target as Element)) {
        mark(centerOf(m.target as Element), "anchor", m.target as Element);
        return;
      }
      for (const n of Array.from(m.addedNodes)) {
        if (!(n instanceof Element)) continue;
        const el = isAnchor(n) ? n : n.querySelector(`[${ANCHOR_ATTRIBUTE}]`);
        if (el) {
          mark(centerOf(el), "anchor", el);
          return;
        }
      }
    }
  });
  mo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [ANCHOR_ATTRIBUTE],
  });
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
export function observePage(): () => void {
  if (subscribers++ === 0) teardown = attach();
  return () => {
    if (--subscribers === 0) {
      teardown?.();
      teardown = null;
      lastEvent = null;
    }
  };
}

const INTERESTING = 'h1,h2,h3,button,a[href],input,textarea,select,img,video,[role="button"]';

const onScreen = (r: DOMRect) =>
  r.width >= 8 &&
  r.height >= 8 &&
  r.bottom >= 0 &&
  r.top <= window.innerHeight &&
  r.right >= 0 &&
  r.left <= window.innerWidth;

const within = (r: DOMRect, outer: DOMRect) =>
  r.left >= outer.left && r.right <= outer.right && r.top >= outer.top && r.bottom <= outer.bottom;

function visibleElement(rng: Rng, awayFrom: DOMRect): Point | null {
  const list = Array.from(document.querySelectorAll(INTERESTING)).slice(0, 120);
  const visible = list.filter((el) => {
    const r = el.getBoundingClientRect();
    // Doesn't look inside itself.
    return onScreen(r) && !within(r, awayFrom);
  });
  if (!visible.length) return null;
  return centerOf(visible[Math.floor(rng() * visible.length)]);
}

/** Anchors on screen (DOM query at most every 300 ms). */
const anchorCache: { until: number; list: Element[] } = { until: 0, list: [] };
function visibleAnchors(now: number, awayFrom: DOMRect): Element[] {
  if (now > anchorCache.until) {
    anchorCache.list = Array.from(document.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`));
    anchorCache.until = now + 300;
  }
  return anchorCache.list.filter((el) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return onScreen(r) && !within(r, awayFrom);
  });
}

/** Free/focus gaze state of one character. */
export type FocusState = {
  point: Point | "screen" | null;
  /** Followed element (the position is read every frame: it may move). */
  el: Element | null;
  until: number;
  seen: number;
  nextCursor: number;
  glide: number;
  mode: GazeMode;
  reason: Reason | null;
  anchorIndex: number;
};

export const newFocusState = (): FocusState => ({
  point: null,
  el: null,
  until: 0,
  seen: 0,
  nextCursor: 0,
  glide: 0,
  mode: "free",
  reason: null,
  anchorIndex: 0,
});

function go(
  f: FocusState,
  point: Point | "screen" | null,
  el: Element | null,
  until: number,
  glide: number,
  mode: GazeMode,
  reason: Reason | null,
) {
  f.point = point;
  f.el = el;
  f.until = until;
  f.glide = glide;
  f.mode = mode;
  f.reason = reason;
}

const decision = (f: FocusState, interest: number): Decision => {
  // Following an element: the position is the current one (scrolled, moved, animated).
  if (f.el && f.el.isConnected) f.point = centerOf(f.el);
  return { point: f.point, interest, glide: f.glide, mode: f.mode, reason: f.reason };
};

/** Picks the next anchor (alternates when there is more than one). */
function nextAnchor(f: FocusState, anchors: Element[]): Element {
  if (anchors.length > 1 && f.el && anchors.includes(f.el)) f.anchorIndex++;
  return anchors[f.anchorIndex % anchors.length];
}

/**
 * Where to look right now, in the requested mode. Call every frame.
 */
export function decideGaze(
  f: FocusState,
  now: number,
  rng: Rng,
  myRect: DOMRect,
  cursor: { x: number; y: number; last: number; inside: boolean },
  mode: GazeMode,
): Decision {
  // 1. Something happened on the page: goes into focus, in both modes.
  const ev = lastEvent;
  if (ev && ev.t > f.seen) {
    f.seen = ev.t;
    const glide = ev.kind === "anchor" ? (ev.el ? anchorGlide(ev.el) : 0) : GLIDE[ev.kind];
    go(f, ev.point, ev.el, now + DURATION[ev.kind], glide, "focus", ev.kind);
    return decision(f, WEIGHT[ev.kind]);
  }

  // An anchor that stopped being an anchor (or left the page): let go at once.
  if (f.reason === "anchor" && !isAnchor(f.el)) f.until = 0;

  // 2. Cursor passing nearby and moving: peeks (at most every 3 s).
  const cx = myRect.left + myRect.width / 2;
  const cy = myRect.top + myRect.height / 2;
  const near = Math.hypot(cursor.x - cx, cursor.y - cy) < Math.max(220, myRect.width * 1.6);
  if (cursor.inside && near && now - cursor.last < 300 && now > f.nextCursor) {
    f.nextCursor = now + 3000;
    go(f, { x: cursor.x, y: cursor.y }, null, now + 1100, 0, "focus", "cursor");
    return decision(f, 0.3);
  }

  // 3. Still on the current target.
  if (now <= f.until) return decision(f, 0);

  // 4. Time to pick another one.
  const anchors = visibleAnchors(now, myRect);
  const r = rng();
  if (mode === "focus") {
    if (anchors.length) {
      // Stays on the anchors; now and then, a quick look at whoever is on screen.
      if (f.reason === "anchor" && r < 0.15) {
        go(f, "screen", null, now + 900 + rng() * 600, 0, "focus", "screen");
        return decision(f, 0);
      }
      const el = nextAnchor(f, anchors);
      go(f, null, el, now + 2500 + rng() * 2000, anchorGlide(el), "focus", "anchor");
      return decision(f, 0.1);
    }
    // No anchors: as before (hops between the screen, text and elements).
    const active = document.activeElement;
    if (r < 0.22) go(f, "screen", null, now + 1400 + rng() * 3200, 0, "focus", "screen");
    else if (r < 0.45 && isEditable(active))
      go(f, textCursorPoint(active), null, now + 1400 + rng() * 3200, 0, "focus", "text");
    else {
      const p = visibleElement(rng, myRect);
      go(f, p, null, now + 1400 + rng() * 3200, 0, "focus", p ? "element" : null);
    }
    return decision(f, f.reason === "element" || f.reason === "text" ? 0.12 : 0);
  }

  // Free mode: wanders; sometimes something holds the gaze (goes into focus).
  if (anchors.length && r < 0.15) {
    // Noticed the anchor: goes fast, like someone noticing something.
    const el = nextAnchor(f, anchors);
    go(f, null, el, now + 1800 + rng() * 1400, 0, "focus", "anchor");
    return decision(f, 0.25);
  }
  if (r < 0.25) {
    const p = visibleElement(rng, myRect);
    if (p) {
      go(f, p, null, now + 900 + rng() * 700, 0, "focus", "element");
      return decision(f, 0.15);
    }
  }
  if (r < 0.37) {
    go(f, "screen", null, now + 1200 + rng() * 1200, 0.6, "free", "screen");
    return decision(f, 0);
  }
  // Wander: glides to any point (half of the time, something on the page).
  const p =
    rng() < 0.5
      ? visibleElement(rng, myRect)
      : { x: rng() * window.innerWidth, y: rng() * window.innerHeight };
  go(f, p, null, now + 900 + rng() * 1300, 0.7 + rng() * 0.6, "free", "wander");
  return decision(f, 0);
}
