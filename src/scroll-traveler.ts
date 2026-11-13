import { clamp, smooth } from "./spring.js";

export interface Slot {
  name: string;
  mood?: string;
  /** Document-relative coordinates (`getBoundingClientRect()` plus `window.scrollY`/`scrollX`), not viewport-relative. */
  rect: { x: number; y: number; width: number; height: number };
}

export interface TravelerFrame {
  x: number;
  y: number;
  scale: number;
  /** -1..1, which way the character is heading; feed into gaze/lean. */
  directionX: number;
  mood?: string;
  /** 0 at rest near a slot, up to 1 mid-flight between two slots. */
  flight: number;
}

export interface TravelerOptions {
  /** Shrink at the midpoint of a flight, 0..1 of the slot size. Default 0.12. */
  flightShrink?: number;
  /** Upward arc at the midpoint of a flight, in the same units as the slots. Default 40. */
  flightArc?: number;
  /** Portion of each leg spent "parked" vs. flying, via smoothstep easing. Default [0.2, 0.8]. */
  easeWindow?: [number, number];
}

/**
 * Computes one frame of the "character that travels between landing-page
 * slots on scroll" pattern. Caller supplies the slots (e.g. from
 * `getBoundingClientRect()` on `.slot[data-name]` elements, already
 * ordered top to bottom) and which one is "active" (e.g. the last slot
 * whose center has crossed above the viewport's midline) plus a 0..1
 * progress toward the next one. This function has no DOM dependency so it
 * is easy to unit test; wire the DOM reads yourself.
 */
export function travelerFrame(
  slots: Slot[],
  activeIndex: number,
  progress: number,
  opts: TravelerOptions = {},
): TravelerFrame {
  const { flightShrink = 0.12, flightArc = 40, easeWindow = [0.2, 0.8] } = opts;
  const current = slots[clamp(activeIndex, 0, slots.length - 1)];
  const next = slots[clamp(activeIndex + 1, 0, slots.length - 1)];

  const p = clamp(progress, 0, 1);
  const eased = smooth(easeWindow[0], easeWindow[1], p);

  const cx = current.rect.x + current.rect.width / 2;
  const cy = current.rect.y + current.rect.height / 2;
  const nx = next.rect.x + next.rect.width / 2;
  const ny = next.rect.y + next.rect.height / 2;

  const flight = Math.sin(p * Math.PI); // 0 at both ends, 1 at the midpoint
  const arc = -flightArc * flight;
  const scaleBase = current.rect.width / 2 + (next.rect.width / 2 - current.rect.width / 2) * eased;

  return {
    x: cx + (nx - cx) * eased,
    y: cy + (ny - cy) * eased + arc,
    scale: (scaleBase / (current.rect.width / 2)) * (1 - flightShrink * flight),
    directionX: clamp((nx - cx) / 200, -1, 1),
    mood: p > 0.5 ? next.mood : current.mood,
    flight,
  };
}

/** Finds the index of the last slot whose vertical center is above `viewportFraction` of `viewportHeight`. */
export function findActiveSlot(
  slots: Slot[],
  scrollY: number,
  viewportHeight: number,
  viewportFraction = 0.5,
): number {
  const line = scrollY + viewportHeight * viewportFraction;
  let active = 0;
  for (let i = 0; i < slots.length; i++) {
    const center = slots[i].rect.y + slots[i].rect.height / 2;
    if (center <= line) active = i;
  }
  return active;
}
