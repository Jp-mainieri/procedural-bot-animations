import { describe, expect, it } from "vitest";
import { Bounce, GazeController, breathingDepth, neverRepeating } from "../src/motion.js";
import { mulberry32 } from "../src/rng.js";

describe("neverRepeating", () => {
  it("stays within a bounded range", () => {
    for (let t = 0; t < 100; t += 0.37) {
      const v = neverRepeating(t);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("gives different instances different phases via `seed`", () => {
    const a = neverRepeating(3.14, 0);
    const b = neverRepeating(3.14, 5);
    expect(a).not.toBeCloseTo(b, 3);
  });
});

describe("breathingDepth", () => {
  it("oscillates around the base depth without going negative", () => {
    const base = 6;
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t < 10; t += 0.05) {
      const d = breathingDepth(t, base, { depthAmount: 0.12 });
      min = Math.min(min, d);
      max = Math.max(max, d);
      expect(d).toBeGreaterThanOrEqual(0);
    }
    expect(max).toBeGreaterThan(base);
    expect(min).toBeLessThan(base);
  });
});

describe("GazeController", () => {
  it("follows a live pointer target", () => {
    const gaze = new GazeController({ rate: 20 });
    let result = { x: 0, y: 0 };
    for (let i = 0; i < 60; i++) result = gaze.update(1 / 60, { x: 0.5, y: -0.3 });
    expect(result.x).toBeCloseTo(0.5, 1);
    expect(result.y).toBeCloseTo(-0.3, 1);
  });

  it("wanders deterministically with a seeded rng once idle", () => {
    const make = () => new GazeController({ rng: mulberry32(42), wanderAfterIdleSeconds: 0.1 });
    const run = (g: GazeController) => {
      const samples: number[] = [];
      for (let i = 0; i < 300; i++) samples.push(g.update(1 / 30, null).x);
      return samples;
    };
    expect(run(make())).toEqual(run(make()));
  });
});

describe("Bounce", () => {
  it("stays grounded until triggered", () => {
    const b = new Bounce();
    for (let i = 0; i < 30; i++) b.update(1 / 60);
    expect(b.state.y.value).toBe(0);
    expect(b.state.airborne).toBe(false);
  });

  it("goes airborne then settles back to rest after a trigger", () => {
    const b = new Bounce();
    b.trigger();
    expect(b.state.airborne).toBe(true);
    let wentUp = false;
    for (let i = 0; i < 600; i++) {
      const s = b.update(1 / 60);
      if (s.y.value < 0) wentUp = true;
    }
    expect(wentUp).toBe(true);
    expect(b.state.airborne).toBe(false);
    expect(b.state.y.value).toBe(0);
  });
});
