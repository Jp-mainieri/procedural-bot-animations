import { describe, expect, it } from "vitest";
import { Brain, type BrainInput } from "../src/brain.js";
import { RIG_BERRY } from "../src/characters/berry.js";

describe("reactive eyes in the brain", () => {
  const INPUT: BrainInput = {
    gaze: { x: 0, y: 0 },
    hover: false,
    reduced: false,
    mood: { neutral: 1 },
    activity: null,
    detail: "full",
  };
  const last = (e: Partial<BrainInput>, ms = 2500) => {
    const c = new Brain(RIG_BERRY, { now: 0, rng: () => 0.5 });
    let p = c.step(0, { ...INPUT, ...e });
    for (let t = 16; t <= ms; t += 16) p = c.step(t, { ...INPUT, ...e });
    return p;
  };

  it("cursor close makes the eyes bigger", () => {
    const far = last({ proximity: 0 });
    const near = last({ proximity: 0.7 });
    expect(near.leftEye.sx).toBeGreaterThan(far.leftEye.sx * 1.05);
  });

  it("looking down weighs the eyelid; looking up opens it", () => {
    const down = last({ gaze: { x: 0, y: 1 } });
    const up = last({ gaze: { x: 0, y: -1 } });
    expect(down.leftEye.lidTop).toBeGreaterThan(up.leftEye.lidTop + 0.1);
    expect(up.leftEye.sy).toBeGreaterThan(down.leftEye.sy);
  });

  it("in a saccade to the right, the eyes tilt to the right", () => {
    const c = new Brain(RIG_BERRY, { now: 0, rng: () => 0.5 });
    for (let t = 0; t <= 600; t += 16) c.step(t, { ...INPUT, gaze: { x: -1, y: 0 } });
    let maxRot = 0;
    for (let t = 616; t <= 900; t += 16)
      maxRot = Math.max(maxRot, c.step(t, { ...INPUT, gaze: { x: 1, y: 0 } }).leftEye.rot);
    expect(maxRot).toBeGreaterThan(8);
  });
});
