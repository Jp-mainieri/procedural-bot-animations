/**
 * Sum of a few incommensurate sine waves so the output never visibly
 * repeats over a normal viewing session, unlike a single `sin(t)`. Give
 * each character instance on a page a different `seed` so they drift apart
 * instead of moving in lockstep.
 */
export function neverRepeating(t: number, seed = 0): number {
  const a = Math.sin(t * 0.9 + seed * 1.7);
  const b = Math.sin(t * 1.53 + seed * 0.4) * 0.6;
  const c = Math.sin(t * 2.31 + seed * 2.9) * 0.35;
  return (a + b + c) / 1.95;
}

export interface BreathingOptions {
  /** Cycles per second. Default 0.26 (~1.65 rad/s, calibrated by ear). */
  frequency?: number;
  /** How much of `amplitude` a full breath moves, 0..1. Default 1. */
  depthAmount?: number;
  seed?: number;
}

/** A squash & stretch breathing multiplier, 1 at rest, oscillating by up to ±2% * `depthAmount`. Multiply directly onto `body.scaleY`/`scaleX`. */
export function breathing(t: number, opts: BreathingOptions = {}): number {
  const { frequency = 0.26, depthAmount = 1, seed = 0 } = opts;
  return 1 + Math.sin(t * frequency * Math.PI * 2 + seed) * 0.02 * depthAmount;
}
