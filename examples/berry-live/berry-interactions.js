/**
 * Ported verbatim from DevBerry's `lib/berry/interacoes.ts` (Berry's table
 * only — the Chama's isn't included; Chama isn't ported here). A gesture is
 * picked by weighted random, never repeating the last one, so the same user
 * gesture doesn't always get the same response.
 */
export const HOVER_CUDDLE_MS = 2500;
export const HOVER_NAP_MS = 9000;
export const CLICK_CHAIN_INTERVAL_MS = 700;

export const INTERACTIONS = {
  hover: [
    { gesture: "jump", weight: 3 },
    { gesture: "peek", weight: 3 },
    { gesture: "shy", weight: 2 },
    { gesture: "doubleHop", weight: 2 },
  ],
  click: [
    { gesture: "jump", weight: 3 },
    { gesture: "laugh", weight: 3 },
    { gesture: "wink", weight: 2 },
    { gesture: "somersault", weight: 1 },
  ],
  chain: [
    { n: 3, reaction: "huff" },
    { n: 5, reaction: "dizzy" },
    { n: 8, reaction: "hide" },
  ],
  // Being petted: eyes arc, sways slowly, leaves relax.
  cuddle: (s) => ({
    happy: 1,
    bodyRotate: Math.sin(s * 2.1) * 3.5,
    bodySy: 0.015 * Math.sin(s * 4.2),
    leafL: -6 + Math.sin(s * 2.1) * 4,
    leafR: 6 + Math.sin(s * 2.1) * 4,
    leafC: Math.sin(s * 2.1 + 0.6) * 5,
    leafAmp: -0.5,
    holdGaze: 0.6,
  }),
  // Napping under the cursor.
  nap: (s) => ({
    eyeSy: -0.88,
    lidTop: 0.25,
    eyeY: 10,
    bodySy: 0.03 * Math.sin(s * 1.3),
    bodySx: -0.015 * Math.sin(s * 1.3),
    bodyRotate: -4,
    leafL: -10,
    leafR: 10,
    zzz: 1,
    holdGaze: 1,
    leafAmp: -0.7,
  }),
};

/** Picks a weighted gesture, avoiding a repeat of `last` when there's a choice. */
export function pickGesture(list, rng, last) {
  const options = list.length > 1 ? list.filter((o) => o.gesture !== last) : list;
  const total = options.reduce((a, o) => a + o.weight, 0);
  let r = rng() * total;
  for (const o of options) if ((r -= o.weight) < 0) return o.gesture;
  return options[options.length - 1].gesture;
}
