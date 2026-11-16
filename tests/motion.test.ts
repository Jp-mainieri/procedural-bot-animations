import { describe, expect, it } from "vitest";
import {
  type Damped,
  type Jump,
  type Spring,
  type Squash,
  launch,
  newBlink,
  newDamped,
  newHold,
  smoothDamp,
  spring,
  stepBlink,
  stepHold,
  stepJump,
  track,
} from "../src/motion.js";

/** Fixed pseudo-random generator, so the tests don't depend on luck. */
function fixedRng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("track", () => {
  const f = track([
    [0, 0, "linear"],
    [0.5, 10, "linear"],
    [1, 0],
  ]);
  it("interpolates between keyframes and clamps at the ends", () => {
    expect(f(-1)).toBe(0);
    expect(f(0.25)).toBeCloseTo(5);
    expect(f(0.5)).toBe(10);
    expect(f(2)).toBe(0);
  });
});

describe("spring", () => {
  it("overshoots and settles on the target", () => {
    const m: Spring = { a: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 300; i++) {
      spring(m, 10, 120, 11, 1 / 60);
      max = Math.max(max, m.a);
    }
    expect(max).toBeGreaterThan(10);
    expect(m.a).toBeCloseTo(10, 1);
  });
});

describe("blink", () => {
  it("blinks within 6 s and reopens the eye", () => {
    const rng = fixedRng();
    const p = newBlink(0);
    let closed = false;
    for (let t = 0; t < 6000; t += 16) if (stepBlink(p, t, rng) > 0.9) closed = true;
    expect(closed).toBe(true);
    expect(stepBlink(p, p.next - 1, rng)).toBe(0);
  });
});

describe("jump", () => {
  it("rises, bounces and stops on the ground with a squash", () => {
    const jump: Jump = { y: 0, vy: 0 };
    const a: Squash = { s: 0, v: 0 };
    launch(jump);
    let high = 0;
    let squashed = false;
    for (let i = 0; i < 180; i++) {
      stepJump(jump, a, 1 / 60);
      high = Math.min(high, jump.y);
      if (a.s > 0.05) squashed = true;
    }
    expect(high).toBeLessThan(-150);
    expect(squashed).toBe(true);
    expect(jump).toEqual({ y: 0, vy: 0 });
  });
});

describe("smoothDamp and hold", () => {
  it("smoothDamp reaches the target without overshooting and starts with zero velocity", () => {
    const m: Damped = newDamped(0);
    const xs: number[] = [];
    for (let i = 0; i < 120; i++) xs.push(smoothDamp(m, 1, 0.3, 1 / 60));
    expect(Math.max(...xs)).toBeLessThanOrEqual(1 + 1e-9);
    expect(xs.at(-1)).toBeGreaterThan(0.99);
    // Small first step (no jerk), larger following steps.
    expect(xs[0]).toBeLessThan(xs[3] - xs[2]);
  });

  it("smoothDamp is stable with a large dt", () => {
    const m = newDamped(0);
    for (let i = 0; i < 20; i++) smoothDamp(m, 1, 0.05, 0.05);
    expect(Math.abs(m.x - 1)).toBeLessThan(1e-3);
  });

  it("hold rises at once, holds, and only then releases", () => {
    const s = newHold();
    expect(stepHold(s, 1, 0, 500, 2, 1 / 60)).toBe(1);
    expect(stepHold(s, 0, 400, 500, 2, 1 / 60)).toBe(1);
    expect(stepHold(s, 0, 600, 500, 2, 0.25)).toBeCloseTo(0.5);
  });
});
