import { describe, expect, it } from "vitest";
import { GazeEngine } from "../src/gaze.js";
import { mulberry32 } from "../src/rng.js";

describe("GazeEngine", () => {
  it("pursuit converges smoothly to a moving target without overshoot", () => {
    const gaze = new GazeEngine({ pursuitRate: 20, microsaccadeAmplitude: 0 });
    let result = { offset: { x: 0, y: 0 }, attention: 0, boredom: 0 };
    let t = 0;
    for (let i = 0; i < 120; i++) {
      t += 1 / 60;
      result = gaze.update(1 / 60, { point: { x: 0.6, y: -0.2 }, arrival: "pursuit" }, t);
      expect(result.offset.x).toBeLessThanOrEqual(0.6 + 1e-6);
    }
    expect(result.offset.x).toBeCloseTo(0.6, 1);
    expect(result.offset.y).toBeCloseTo(-0.2, 1);
  });

  it("a saccade can overshoot a newly-appeared target before settling", () => {
    const gaze = new GazeEngine({ microsaccadeAmplitude: 0 });
    let maxX = 0;
    let t = 0;
    for (let i = 0; i < 60; i++) {
      t += 1 / 60;
      const r = gaze.update(1 / 60, { point: { x: 0.5, y: 0 }, arrival: "saccade" }, t);
      maxX = Math.max(maxX, r.offset.x);
    }
    expect(maxX).toBeGreaterThan(0.5);
  });

  it("raises attention right after a saccade to a new point", () => {
    const gaze = new GazeEngine({ microsaccadeAmplitude: 0 });
    const first = gaze.update(1 / 60, { point: { x: 0.5, y: 0 }, arrival: "saccade" }, 1 / 60);
    expect(first.attention).toBeGreaterThan(0);
  });

  it("raises boredom after sustained idling with no explicit target", () => {
    const gaze = new GazeEngine({ boredomAfterSeconds: 1, microsaccadeAmplitude: 0, rng: mulberry32(1) });
    let last = { offset: { x: 0, y: 0 }, attention: 0, boredom: 0 };
    let t = 0;
    for (let i = 0; i < 600; i++) {
      t += 1 / 60;
      last = gaze.update(1 / 60, null, t);
    }
    expect(last.boredom).toBeGreaterThan(0);
  });

  it("wanders deterministically with a seeded rng", () => {
    const run = () => {
      const gaze = new GazeEngine({ rng: mulberry32(7) });
      const xs: number[] = [];
      let t = 0;
      for (let i = 0; i < 300; i++) {
        t += 1 / 30;
        xs.push(gaze.update(1 / 30, null, t).offset.x);
      }
      return xs;
    };
    expect(run()).toEqual(run());
  });
});
