/**
 * Ported verbatim from DevBerry's `lib/berry/humores.ts`. Moods are
 * continuous and blend by weight (0..1) — the brain smooths the weights, so
 * switching moods is never a hard cut. The expression comes mostly from the
 * eyelids, not eye size.
 */
export const MOODS = {
  neutral: {},
  curious: { eyeSy: 0.1, eyeSx: 0.08, leafC: 9, bodyRotate: 4, leafL: 4, leafR: -4, turn: 0.25 },
  focused: { lidTop: 0.22, lidAngle: 6, leafAmp: -0.6, bodySy: -0.01 },
  suspicious: { lidTop: 0.42, lidBottom: 0.12, lidAngle: 18, leafL: -12, leafR: 12, bodyRotate: -3, turn: -0.3 },
  sleepy: { lidTop: 0.58, lidAngle: -6, eyeY: 10, leafL: -10, leafR: 10, leafC: -6, rootY: 6, leafAmp: -0.5 },
  proud: { happy: 1, leafL: 12, leafR: -12, bodySy: 0.03, eyeY: -6 },
  sad: { lidTop: 0.28, lidAngle: -16, eyeY: 16, eyeSx: -0.06, leafL: -18, leafR: 18, leafC: 10, rootY: 10, bodySy: -0.04, leafAmp: -0.6 },
  angry: { lidTop: 0.34, lidAngle: 26, eyeSy: -0.05, leafL: -6, leafR: 6, bodySy: 0.02 },
  smiling: { lidBottom: 0.3, eyeSy: 0.04, leafL: 6, leafR: -6 },
};

export const MOOD_NAMES = Object.keys(MOODS);
