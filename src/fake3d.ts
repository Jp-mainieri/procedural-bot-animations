import { clamp } from "./spring.js";
import type { PoseDelta } from "./types.js";

export interface FakeTurnOptions {
  /** Max eye slide, in viewBox units, at `turn = ±1`. Default 6. */
  maxSlide?: number;
  /** How much the far eye shrinks in width at `turn = ±1`, 0..1. Default 0.4. */
  farShrink?: number;
  /** How much the near eye grows in width at `turn = ±1`, 0..1. Default 0.12. */
  nearGrow?: number;
  /** Body lean, degrees at `turn = ±1`. Default 2. */
  bodyLeanDeg?: number;
}

/**
 * The Pumpy/Open-Bot-Avatar-style "fake 3D turn": on a flat silhouette with
 * no real depth, sliding both eyes toward the turn direction and shrinking
 * the eye on the far side (while the near one grows slightly) reads as the
 * head rotating, the same illusion Open Bot Avatar gets from projecting
 * stacked cross-sections — reproduced here directly on the eyes since this
 * engine draws its own flat silhouette instead of that projection.
 */
export function fakeTurn(turn: number, options: FakeTurnOptions = {}): PoseDelta {
  const { maxSlide = 6, farShrink = 0.4, nearGrow = 0.12, bodyLeanDeg = 2 } = options;
  const t = clamp(turn, -1, 1);
  const slide = t * maxSlide;

  // t > 0: turning toward the right eye (near side), away from the left eye (far side).
  const leftScaleX = 1 - Math.max(0, t) * farShrink - Math.max(0, -t) * 0; // left shrinks when turning right
  const rightScaleX = 1 - Math.max(0, -t) * farShrink; // right shrinks when turning left
  const leftGrow = 1 + Math.max(0, -t) * nearGrow; // left grows when turning left (left becomes near)
  const rightGrow = 1 + Math.max(0, t) * nearGrow; // right grows when turning right

  return {
    leftEye: { offsetX: slide, scaleX: leftScaleX * leftGrow },
    rightEye: { offsetX: slide, scaleX: rightScaleX * rightGrow },
    body: { rotate: t * bodyLeanDeg },
  };
}
