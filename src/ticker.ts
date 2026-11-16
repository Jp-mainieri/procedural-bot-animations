/*
 * A single requestAnimationFrame for every character on the page, and a single
 * pointer listener. Whoever subscribes receives the frame time; when nobody is
 * left, the loop stops. With the tab hidden, the browser already pauses rAF.
 */

type Subscriber = (now: number) => void;

const subscribers = new Set<Subscriber>();
let frame = 0;

/** Last pointer position in the window and when it last moved. */
export const pointer = { x: 0, y: 0, last: -Infinity, inside: true };

function run(now: number) {
  for (const f of subscribers) f(now);
  frame = subscribers.size ? requestAnimationFrame(run) : 0;
}

function onMove(e: PointerEvent) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.last = performance.now();
  pointer.inside = true;
}

function onLeave(e: PointerEvent) {
  if (!e.relatedTarget) pointer.inside = false;
}

export function subscribe(f: Subscriber): () => void {
  if (subscribers.size === 0) {
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }
  subscribers.add(f);
  if (!frame) frame = requestAnimationFrame(run);
  return () => {
    subscribers.delete(f);
    if (subscribers.size === 0) {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
