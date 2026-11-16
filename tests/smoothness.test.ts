import { describe, expect, it } from "vitest";
import { Brain, type BrainInput, type Pose } from "../src/brain.js";

/*
 * State changes without jitter: putting the mouse in and out quickly, the
 * cursor coming close and going away, the cursor running. The shape of the
 * eyes has to go one way and release slowly, never back and forth each frame.
 */

const rng = () => 0.5;
const FRAME = 1000 / 60;

const INPUT: BrainInput = {
  gaze: { x: 0.3, y: 0.2 },
  hover: false,
  reduced: false,
  mood: { neutral: 1 },
  activity: null,
  detail: "full",
};

const make = () => new Brain({ id: "berry", baseHeight: 535, idleAppendage: { amp: 1, freq: 1 }, flicker: 0 }, { now: 0, rng });

function run(
  c: Brain,
  start: number,
  ms: number,
  e: (t: number, i: number) => Partial<BrainInput>,
): Pose[] {
  const poses: Pose[] = [];
  let i = 0;
  for (let t = start; t <= start + ms; t += FRAME) poses.push(c.step(t, { ...INPUT, ...e(t, i++) }));
  return poses;
}

/** How many times the series changes direction (ignores noise below `eps`). */
function reversals(v: number[], eps = 1e-5) {
  let n = 0;
  let sign = 0;
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    if (Math.abs(d) < eps) continue;
    const s = Math.sign(d);
    if (sign && s !== sign) n++;
    sign = s;
  }
  return n;
}

describe("eyes without jitter on state change", () => {
  it("putting the mouse in and out quickly: the eye shape does not go back and forth", () => {
    const c = make();
    run(c, 0, 1500, () => ({}));
    // Toggles hover every 3 frames (~50 ms) for 1.5 s.
    const poses = run(c, 1500, 1500, (_, i) => ({ hover: Math.floor(i / 3) % 2 === 0 }));
    const sx = poses.map((p) => p.leftEye.sx);
    expect(reversals(sx)).toBeLessThanOrEqual(2);
    const maxStep = Math.max(...sx.slice(1).map((v, i) => Math.abs(v - sx[i])));
    expect(maxStep).toBeLessThan(0.006);
  });

  it("the hover expression persists a while after the cursor leaves", () => {
    const c = make();
    run(c, 0, 1000, () => ({}));
    const inside = run(c, 1000, 1000, () => ({ hover: true })).at(-1)!;
    const rest = run(make(), 0, 2000, () => ({})).at(-1)!;
    const after = run(c, 2000, 400, () => ({ hover: false })).at(-1)!;
    const gain = inside.leftEye.sx - rest.leftEye.sx;
    expect(gain).toBeGreaterThan(0.02);
    // 400 ms after leaving, it still has almost all of the effect.
    expect(after.leftEye.sx - rest.leftEye.sx).toBeGreaterThan(gain * 0.8);
  });

  it("cursor coming near and going away: attention does not oscillate", () => {
    const c = make();
    run(c, 0, 1000, () => ({}));
    const poses = run(c, 1000, 2000, (_, i) => ({
      proximity: Math.floor(i / 4) % 2 ? 0.9 : 0.1,
    }));
    expect(reversals(poses.map((p) => p.attention))).toBeLessThanOrEqual(2);
  });

  it("cursor running: the eye pursues without steps and the tilt is continuous", () => {
    const c = make();
    run(c, 0, 600, () => ({ gaze: { x: -0.6, y: 0 } }));
    const poses = run(c, 600, 1000, (t) => ({
      gaze: { x: -0.6 + 1.2 * Math.min(1, (t - 600) / 500), y: 0 },
    }));
    const rot = poses.map((p) => p.leftEye.rot);
    const maxRotStep = Math.max(...rot.slice(1).map((v, i) => Math.abs(v - rot[i])));
    expect(maxRotStep).toBeLessThan(1.2);
    expect(reversals(rot, 0.01)).toBeLessThanOrEqual(2);
    const x = poses.map((p) => p.leftEye.x);
    // Moved to the right without going back (no chain of saccades).
    expect(reversals(x.slice(0, 32), 0.05)).toBe(0);
  });
});
