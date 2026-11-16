import type { PartialDelta } from "./delta.js";
import type { Rng } from "./motion.js";

/*
 * How each character responds to the cursor and to clicks. The brain picks a
 * gesture by weighted draw, never repeating the last one, so the same user
 * action does not always get the same answer.
 */

/** A gesture is a reaction name or `"hop"` (the physical jump). */
export type Gesture = string;
type Draw = readonly { gesture: Gesture; weight: number }[];

export type Interactions = {
  /** Cursor entered. */
  hover: Draw;
  /** A single click. */
  click: Draw;
  /** Quick successive clicks (less than 0.7 s apart): on the n-th one, it fires. */
  sequence: readonly { n: number; reaction: string }[];
  /** Cursor resting on top for more than 2.5 s. */
  cuddle: (s: number) => PartialDelta;
  /** Cursor resting on top for more than 9 s: falls asleep. */
  nap: (s: number) => PartialDelta;
};

export const HOVER_CUDDLE_MS = 2500;
export const HOVER_NAP_MS = 9000;
export const CLICK_CHAIN_INTERVAL_MS = 700;

const BERRY: Interactions = {
  hover: [
    { gesture: "hop", weight: 3 },
    { gesture: "peek", weight: 3 },
    { gesture: "shy", weight: 2 },
    { gesture: "doubleHop", weight: 2 },
  ],
  click: [
    { gesture: "hop", weight: 3 },
    { gesture: "laugh", weight: 3 },
    { gesture: "wink", weight: 2 },
    { gesture: "somersault", weight: 1 },
  ],
  sequence: [
    { n: 3, reaction: "huff" },
    { n: 5, reaction: "dizzy" },
    { n: 8, reaction: "hide" },
  ],
  // Petted: arc-shaped eyes, a slow sway, leaves relax.
  cuddle: (s) => ({
    happy: 1,
    bodyRotate: Math.sin(s * 2.1) * 3.5,
    bodySy: 0.015 * Math.sin(s * 4.2),
    partL: -6 + Math.sin(s * 2.1) * 4,
    partR: 6 + Math.sin(s * 2.1) * 4,
    partC: Math.sin(s * 2.1 + 0.6) * 5,
    partAmp: -0.5,
    holdGaze: 0.6,
  }),
  // Dozes off under the cursor.
  nap: (s) => ({
    eyeSy: -0.88,
    lidTop: 0.25,
    eyeY: 10,
    bodySy: 0.03 * Math.sin(s * 1.3),
    bodySx: -0.015 * Math.sin(s * 1.3),
    bodyRotate: -4,
    partL: -10,
    partR: 10,
    zzz: 1,
    holdGaze: 1,
    partAmp: -0.7,
  }),
};

const FLAME: Interactions = {
  hover: [
    { gesture: "warmUp", weight: 3 },
    { gesture: "hop", weight: 2 },
    { gesture: "crackle", weight: 2 },
    { gesture: "peek", weight: 2 },
  ],
  click: [
    { gesture: "hop", weight: 3 },
    { gesture: "crackle", weight: 2 },
    { gesture: "laugh", weight: 2 },
    { gesture: "wink", weight: 2 },
    { gesture: "sneeze", weight: 1 },
  ],
  sequence: [
    { n: 3, reaction: "heatUp" },
    { n: 5, reaction: "dizzy" },
    { n: 8, reaction: "burst" },
  ],
  // Coziness: the core lights up gently, tiny embers, arc-shaped eyes.
  cuddle: (s) => ({
    happy: 1,
    core: 0.45 + 0.1 * Math.sin(s * 3),
    embers: 0.35,
    scale: 0.05,
    bodyRotate: Math.sin(s * 1.8) * 3,
    partAmp: -0.3,
    holdGaze: 0.6,
  }),
  // Nap: crouches, loses a little colour, the tongues almost stop.
  nap: (s) => ({
    eyeSy: -0.88,
    lidTop: 0.25,
    eyeY: 10,
    scale: -0.12,
    bodySy: 0.03 * Math.sin(s * 1.3),
    gray: 0.2,
    zzz: 1,
    holdGaze: 1,
    partAmp: -0.7,
  }),
};

export const INTERACTIONS: Record<string, Interactions> = { berry: BERRY, flame: FLAME };

/** Draws a weighted gesture, avoiding a repeat of `last` when there is a choice. */
export function pickGesture(list: Draw, rng: Rng, last: Gesture | null): Gesture {
  const options = list.length > 1 ? list.filter((o) => o.gesture !== last) : list;
  const total = options.reduce((a, o) => a + o.weight, 0);
  let r = rng() * total;
  for (const o of options) if ((r -= o.weight) < 0) return o.gesture;
  return options[options.length - 1].gesture;
}
