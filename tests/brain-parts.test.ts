import { describe, expect, it } from "vitest";
import { Brain, type BrainInput } from "../src/brain.js";
import { RIG_BERRY } from "../src/characters/berry.js";

const INPUT: BrainInput = {
  gaze: null,
  hover: false,
  reduced: false,
  mood: { neutral: 1 },
  activity: null,
  detail: "full",
};

describe("leaf tips in the brain", () => {
  function hop(e: Partial<BrainInput> = {}) {
    const c = new Brain(RIG_BERRY, { now: 0, rng: () => 0.5 });
    const bends: number[] = [];
    for (let t = 0; t < 300; t += 1000 / 60) c.step(t, { ...INPUT, ...e });
    c.jump();
    for (let t = 300; t < 3000; t += 1000 / 60) bends.push(c.step(t, { ...INPUT, ...e }).bendL);
    return bends;
  }

  it("the hop makes the tip whip and then settle", () => {
    const bends = hop();
    expect(Math.max(...bends.map(Math.abs))).toBeGreaterThan(5);
    expect(Math.abs(bends.at(-1)!)).toBeLessThan(1.5);
  });

  it("turns off with reduced motion or with bend turned off", () => {
    expect(Math.max(...hop({ reduced: true }).map(Math.abs))).toBe(0);
    expect(Math.max(...hop({ bend: false }).map(Math.abs))).toBe(0);
  });
});
