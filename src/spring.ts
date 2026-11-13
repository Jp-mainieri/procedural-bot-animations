/** Clamp `v` to the [a, b] range. */
export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep of `x` between `a` and `b`. */
export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Exponential damping toward `target` with no overshoot.
 * Frame-rate independent: `rate` is in 1/seconds, `dt` in seconds.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export interface SpringState {
  value: number;
  velocity: number;
}

/**
 * Damped spring (critically-damped when `damping = 2 * sqrt(stiffness)`,
 * overshoots when lower). Mutates and returns `state`.
 */
export function spring(
  state: SpringState,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): SpringState {
  const force = stiffness * (target - state.value) - damping * state.velocity;
  state.velocity += force * dt;
  state.value += state.velocity * dt;
  return state;
}

/** Caps a frame delta so a tab coming back from sleep doesn't blow up springs. */
export function safeDt(rawDtMs: number, maxMs = 50): number {
  return clamp(rawDtMs, 0, maxMs) / 1000;
}
