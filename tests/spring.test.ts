import { describe, expect, it } from "vitest";
import { clamp, damp, lerp, safeDt, smooth, spring } from "../src/spring.js";

describe("clamp/lerp/smooth", () => {
  it("clamps into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it("lerps linearly", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it("smoothsteps with zero slope at both ends", () => {
    expect(smooth(0, 10, -5)).toBe(0);
    expect(smooth(0, 10, 15)).toBe(1);
    expect(smooth(0, 10, 5)).toBeCloseTo(0.5, 5);
  });
});

describe("damp", () => {
  it("never overshoots the target", () => {
    let v = 0;
    for (let i = 0; i < 200; i++) {
      v = damp(v, 10, 8, 1 / 60);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("converges to the target", () => {
    let v = 0;
    for (let i = 0; i < 300; i++) v = damp(v, 10, 8, 1 / 60);
    expect(v).toBeCloseTo(10, 2);
  });

  it("is a no-op at dt = 0", () => {
    expect(damp(3, 10, 8, 0)).toBe(3);
  });
});

describe("spring", () => {
  it("settles at the target with enough damping", () => {
    const state = { value: 0, velocity: 0 };
    for (let i = 0; i < 600; i++) spring(state, 10, 120, 22, 1 / 60);
    expect(state.value).toBeCloseTo(10, 1);
    expect(state.velocity).toBeCloseTo(0, 1);
  });

  it("can overshoot when underdamped", () => {
    const state = { value: 0, velocity: 0 };
    let maxValue = 0;
    for (let i = 0; i < 120; i++) {
      spring(state, 10, 200, 4, 1 / 60);
      maxValue = Math.max(maxValue, state.value);
    }
    expect(maxValue).toBeGreaterThan(10);
  });
});

describe("safeDt", () => {
  it("converts ms to seconds", () => {
    expect(safeDt(16)).toBeCloseTo(0.016, 5);
  });

  it("caps runaway deltas", () => {
    expect(safeDt(5000, 50)).toBeCloseTo(0.05, 5);
  });

  it("floors negative deltas to zero", () => {
    expect(safeDt(-100)).toBe(0);
  });
});
