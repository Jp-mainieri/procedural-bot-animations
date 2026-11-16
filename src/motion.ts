/*
 * Basic building blocks of character motion. Pure functions (or ones that
 * only mutate the object they are given), no DOM, so they can be tested in
 * Node and reused by any character.
 */

import type { DeltaField, PartialDelta } from "./delta.js";

export type Rng = () => number;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Number formatter for SVG attributes (which reject exponential notation such as `1e-7`). */
export const fmtNum = (v: number): string => (Number.isFinite(v) ? v.toFixed(4) : "0");

/** Smoothstep between `a` and `b`: 0 before `a`, 1 after `b`, a smooth curve in between. */
export function smooth(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Moves `current` toward `target` independent of frame rate (exponential smoothing). */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

export type Spring = { a: number; v: number };

/**
 * Largest step any explicit-Euler integrator takes. The stiffest spring in the
 * engine (the eye, K = 900, C ≈ 37) diverges above ~38 ms; the others tolerate
 * 75 to 110 ms. At 60 fps (16.7 ms) a frame is a single step, so nothing
 * changes there; a longer frame is split into equal steps of at most 20 ms.
 */
export const MAX_STEP = 0.02;

/** Calls `fn` with equal sub-steps that add up to `dt`, none above `MAX_STEP`. */
export function substep(dt: number, fn: (h: number) => void) {
  if (!(dt > 0)) return;
  const n = Math.ceil(dt / MAX_STEP - 1e-9);
  const h = dt / n;
  for (let i = 0; i < n; i++) fn(h);
}

/** Damped spring: `k` is the stiffness, `c` the damping. Mutates `m` in place. */
export function spring(m: Spring, target: number, k: number, c: number, dt: number) {
  substep(dt, (h) => {
    m.v += (k * (target - m.a) - c * m.v) * h;
    m.a += m.v * h;
  });
}

/* ---------- curves ---------- */

export type Curve = (t: number) => number;

export const CURVES = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t * t,
  easeOut: (t: number) => 1 - (1 - t) ** 3,
  smooth: (t: number) => t * t * (3 - 2 * t),
} satisfies Record<string, Curve>;

export type CurveName = keyof typeof CURVES;

/** A track keyframe: [time from 0 to 1, value, curve up to the next keyframe]. */
export type Keyframe = readonly [number, number, CurveName?];

/**
 * Piecewise interpolation between keyframes. Before the first keyframe the
 * first value holds; after the last, the last. Each keyframe's curve applies
 * up to the next one (default: `smooth`).
 */
export function track(keyframes: readonly Keyframe[]): Curve {
  return (t) => {
    if (t <= keyframes[0][0]) return keyframes[0][1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      const [t0, v0, name = "smooth"] = keyframes[i];
      const [t1, v1] = keyframes[i + 1];
      if (t <= t1) return lerp(v0, v1, CURVES[name]((t - t0) / (t1 - t0 || 1)));
    }
    return keyframes[keyframes.length - 1][1];
  };
}

/** Keyframe tracks per delta field. */
export type Tracks = Partial<Record<DeltaField, readonly Keyframe[]>>;

/** Combines several per-field tracks into one function of progress `t` returning a partial delta. */
export function fromTracks(tracks: Tracks): (t: number) => PartialDelta {
  const fns = Object.entries(tracks).map(([k, c]) => [k, track(c!)] as const);
  return (t: number): PartialDelta => {
    const d: PartialDelta = {};
    for (const [k, f] of fns) d[k as DeltaField] = f(t);
    return d;
  };
}

/* ---------- blink ---------- */

export type Blink = { active: boolean; t0: number; remaining: number; next: number };

const BLINK_DURATION = 150;

export const newBlink = (now: number): Blink => ({
  active: false,
  t0: 0,
  remaining: 0,
  next: now + 1500,
});

/**
 * Advances the blink and returns how closed the eye is (0 open, 1 closed).
 * Random interval of 1.8 to 6 s; 20% of the time it blinks twice in a row.
 */
export function stepBlink(p: Blink, now: number, rng: Rng): number {
  if (!p.active && now >= p.next) {
    p.active = true;
    p.t0 = now;
    p.remaining = rng() < 0.2 ? 2 : 1;
  }
  if (!p.active) return 0;
  const phase = (now - p.t0) / BLINK_DURATION;
  if (phase >= 1) {
    p.remaining--;
    if (p.remaining > 0) p.t0 = now + 90;
    else {
      p.active = false;
      p.next = now + 1800 + rng() * 4200;
    }
    return 0;
  }
  return phase > 0 ? Math.sin(phase * Math.PI) : 0;
}

/* ---------- jump and squash ---------- */

export type Jump = { y: number; vy: number };
export type Squash = { s: number; v: number };

const GRAVITY = 5200;

export const atRest = (p: Jump) => p.y === 0 && p.vy === 0;

/** Starts a jump if on the ground. Negative `vy` is up (drawing px per second). */
export function launch(p: Jump, vy = -1500) {
  if (atRest(p)) p.vy = vy;
}

/**
 * Gravity, a short bounce (32% of the velocity) and a squash on landing.
 * Mutates `p` and `squash` in place.
 */
export function stepJump(p: Jump, squash: Squash, dt: number) {
  substep(dt, (h) => stepJumpOnce(p, squash, h));
}

function stepJumpOnce(p: Jump, squash: Squash, dt: number) {
  if (!atRest(p)) {
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= 0) {
      const impact = Math.abs(p.vy);
      p.y = 0;
      if (impact > 500) {
        p.vy = -impact * 0.32;
        squash.s = Math.min(0.16, impact / 9000);
        squash.v = 0;
      } else p.vy = 0;
    }
  }
  squash.v += (-320 * squash.s - 15 * squash.v) * dt;
  squash.s += squash.v * dt;
}

/* ---------- smoothing without jerks ---------- */

/** A smoothed value with its own velocity (critically damped spring). */
export type Damped = { x: number; v: number };
export const newDamped = (x = 0): Damped => ({ x, v: 0 });

/**
 * Takes `m` to `target` in about `time` seconds, without overshooting and
 * without a jerk: it starts slowly, speeds up and arrives slowly (the
 * velocity is continuous, unlike `damp`). Stable for any `dt` (the SmoothDamp
 * formula).
 */
export function smoothDamp(m: Damped, target: number, time: number, dt: number): number {
  if (dt <= 0) return m.x;
  const w = 2 / Math.max(time, 1e-3);
  const x = w * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const delta = m.x - target;
  const tmp = (m.v + w * delta) * dt;
  m.v = (m.v - w * tmp) * e;
  m.x = target + (delta + tmp) * e;
  return m.x;
}

/** A peak that holds: rises instantly and only starts releasing `holdMs` after the last peak. */
export type Hold = { v: number; until: number };
export const newHold = (): Hold => ({ v: 0, until: 0 });

export function stepHold(
  s: Hold,
  input: number,
  now: number,
  holdMs: number,
  releasePerSecond: number,
  dt: number,
): number {
  if (input >= s.v) {
    s.v = input;
    s.until = now + holdMs;
  } else if (now > s.until) s.v = Math.max(input, s.v - releasePerSecond * dt);
  return s.v;
}
