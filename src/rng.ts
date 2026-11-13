/**
 * Seedable PRNG (mulberry32). Deterministic by design: pass a fixed seed in
 * tests or demos that need to reproduce a run; omit it for real randomness.
 */
export type Rng = () => number;

export function mulberry32(seed: number = Date.now() >>> 0): Rng {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** True with probability `p` (0..1). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
