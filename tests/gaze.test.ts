import { describe, expect, it } from "vitest";
import { Gaze } from "../src/gaze.js";

const rng = () => 0.5;
const DT = 1 / 60;

function run(g: Gaze, target: (t: number) => { x: number; y: number }, ms: number, extra = {}) {
  const outputs = [];
  for (let t = 0; t <= ms; t += 1000 * DT)
    outputs.push(
      g.step(
        { target: target(t), reduced: false, interest: 0, proximity: 0, ...extra },
        t,
        DT,
        rng,
      ),
    );
  return outputs;
}

describe("Gaze", () => {
  it("a target jump becomes a saccade: fast, overshoots and settles", () => {
    const g = new Gaze();
    run(g, () => ({ x: 0, y: 0 }), 500);
    const s = run(g, () => ({ x: 0.8, y: 0 }), 600);
    const goal = 0.8 * 0.94;
    // In 120 ms it is already close; it overshoots the goal; it ends near it.
    expect(s[7].x).toBeGreaterThan(goal * 0.85);
    expect(Math.max(...s.map((p) => p.x))).toBeGreaterThan(goal + 0.02);
    expect(Math.abs(s.at(-1)!.x - goal)).toBeLessThan(0.05);
    // In the saccade, velocity is high (that is what stretches and tilts the eyes).
    expect(Math.max(...s.map((p) => p.vx))).toBeGreaterThan(5);
  });

  it("slow-moving target: pursues without hops", () => {
    const g = new Gaze();
    const s = run(g, (t) => ({ x: Math.sin(t / 1000) * 0.5, y: 0 }), 3000);
    const maxV = Math.max(...s.slice(30).map((p) => Math.abs(p.vx)));
    expect(maxV).toBeLessThan(3);
    const end = s.at(-1)!;
    expect(Math.abs(end.x - Math.sin(3) * 0.5)).toBeLessThan(0.12);
  });

  it("a big saccade draws attention; nothing happening brings boredom", () => {
    const g = new Gaze();
    run(g, () => ({ x: -0.9, y: 0 }), 200);
    // (`run`'s clock restarts at 0: the saccade waits for the minimum interval)
    const s = run(g, () => ({ x: 0.9, y: 0 }), 400);
    expect(Math.max(...s.map((p) => p.attention))).toBeGreaterThan(0.3);
    const idle = run(g, () => ({ x: 0.9, y: 0 }), 14000);
    expect(idle.at(-1)!.boredom).toBeGreaterThan(0.6);
    expect(idle.at(-1)!.attention).toBeLessThan(0.1);
  });

  it("cursor right on top: high attention and the eyes converge", () => {
    const g = new Gaze();
    const s = run(g, () => ({ x: 0, y: 0 }), 2000, { proximity: 1 });
    expect(s.at(-1)!.attention).toBeGreaterThan(0.5);
    expect(s.at(-1)!.convergence).toBeCloseTo(1, 2);
  });

  it("reduced motion: no saccade, no overshoot", () => {
    const g = new Gaze();
    const s = run(g, () => ({ x: 0.8, y: 0 }), 1500, { reduced: true });
    expect(Math.max(...s.map((p) => p.x))).toBeLessThanOrEqual(0.8 + 1e-9);
    expect(Math.max(...s.map((p) => Math.abs(p.vx)))).toBe(0);
  });
});

describe("Gaze gliding", () => {
  it("glides to the target with no hop: low velocity, no going back, arrives", () => {
    const g = new Gaze();
    run(g, () => ({ x: -0.6, y: 0 }), 600);
    const s = run(g, () => ({ x: 0.6, y: 0.2 }), 2500, { glide: 0.7 });
    const xs = s.map((p) => p.x);
    // Never moves backwards (apart from the microsaccade noise on arrival).
    for (let i = 1; i < 60; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-3);
    // Much slower than a saccade (which goes past 5 units/s).
    expect(Math.max(...s.map((p) => Math.abs(p.vx)))).toBeLessThan(3.5);
    expect(Math.abs(xs.at(-1)! - 0.6)).toBeLessThan(0.05);
  });

  it("switching from saccade to glide does not jerk", () => {
    const g = new Gaze();
    const a = run(g, () => ({ x: 0.5, y: 0 }), 300);
    const b = run(g, () => ({ x: -0.5, y: 0 }), 300, { glide: 0.6 });
    expect(Math.abs(b[0].x - a.at(-1)!.x)).toBeLessThan(0.05);
  });
});
