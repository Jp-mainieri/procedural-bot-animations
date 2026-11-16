import type { PartialDelta } from "./delta.js";

/**
 * Moods are continuous and blend by weight (0 to 1). Each one describes the
 * pose at weight 1; the brain smooths the weights, so switching moods is never
 * a hard cut. The expression comes mostly from the eyelids, not the eye size.
 */
export const MOODS = {
  neutral: {},
  curious: { eyeSy: 0.1, eyeSx: 0.08, partC: 9, bodyRotate: 4, partL: 4, partR: -4, turn: 0.25 },
  focused: { lidTop: 0.22, lidAngle: 6, partAmp: -0.6, bodySy: -0.01 },
  suspicious: {
    lidTop: 0.42,
    lidBottom: 0.12,
    lidAngle: 18,
    partL: -12,
    partR: 12,
    bodyRotate: -3,
    turn: -0.3,
  },
  sleepy: {
    lidTop: 0.58,
    lidAngle: -6,
    eyeY: 10,
    partL: -10,
    partR: 10,
    partC: -6,
    rootY: 6,
    partAmp: -0.5,
  },
  proud: { happy: 1, partL: 12, partR: -12, bodySy: 0.03, eyeY: -6 },
  downcast: {
    lidTop: 0.28,
    lidAngle: -16,
    eyeY: 16,
    eyeSx: -0.06,
    partL: -18,
    partR: 18,
    partC: 10,
    rootY: 10,
    bodySy: -0.04,
    partAmp: -0.6,
  },
  angry: { lidTop: 0.34, lidAngle: 26, eyeSy: -0.05, partL: -6, partR: 6, bodySy: 0.02 },
  smiling: { lidBottom: 0.3, eyeSy: 0.04, partL: 6, partR: -6 },
} satisfies Record<string, PartialDelta>;

export type Mood = keyof typeof MOODS;
export const MOOD_NAMES = Object.keys(MOODS) as Mood[];

export type MoodWeights = Partial<Record<Mood, number>>;

/** Accepts a name (`'curious'`) or a blend (`{ curious: 0.5, focused: 0.5 }`). */
export function normalizeMood(h: Mood | MoodWeights | undefined): MoodWeights {
  if (!h) return { neutral: 1 };
  return typeof h === "string" ? { [h]: 1 } : h;
}
