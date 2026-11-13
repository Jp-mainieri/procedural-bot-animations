import { describe, expect, it } from "vitest";
import { MoodBlender, blendMoods, builtinMoods } from "../src/moods.js";

describe("blendMoods", () => {
  it("returns a no-op delta with no active moods", () => {
    const delta = blendMoods({});
    expect(delta.eyes?.scaleY).toBe(1);
    expect(delta.body?.y).toBe(0);
  });

  it("scales a single mood's effect by its weight", () => {
    const half = blendMoods({ sleepy: 0.5 });
    const full = blendMoods({ sleepy: 1 });
    expect(half.eyes?.scaleY).toBeGreaterThan(full.eyes!.scaleY!);
    expect(half.eyes?.scaleY).toBeLessThan(1);
  });

  it("combines two simultaneously-active moods instead of one replacing the other", () => {
    const curiousOnly = blendMoods({ curious: 1 });
    const mixed = blendMoods({ curious: 1, sleepy: 0.5 });
    // sleepy also shrinks eyeScaleY, so mixing it in should shrink further than curious alone.
    expect(mixed.eyes!.scaleY!).toBeLessThan(curiousOnly.eyes!.scaleY!);
  });

  it("ignores an unknown mood name", () => {
    expect(() => blendMoods({ madeUpMood: 1 }, builtinMoods)).not.toThrow();
  });

  it("clamps out-of-range weights", () => {
    const over = blendMoods({ proud: 5 });
    const atOne = blendMoods({ proud: 1 });
    expect(over.eyes?.arcAmount).toBe(atOne.eyes?.arcAmount);
  });
});

describe("MoodBlender", () => {
  it("eases toward the target instead of snapping", () => {
    const blender = new MoodBlender({ rate: 5 });
    blender.set({ proud: 1 });
    const first = blender.update(1 / 60);
    expect(first.eyes?.arcAmount).toBeGreaterThan(0);
    expect(first.eyes?.arcAmount).toBeLessThan(1);
  });

  it("converges to the target weight given enough time", () => {
    const blender = new MoodBlender({ rate: 8 });
    blender.set({ proud: 1 });
    let last;
    for (let i = 0; i < 300; i++) last = blender.update(1 / 60);
    expect(last!.eyes?.arcAmount).toBeCloseTo(1, 2);
  });

  it("eases back out when the target is cleared", () => {
    const blender = new MoodBlender({ rate: 8 });
    blender.set({ proud: 1 });
    for (let i = 0; i < 200; i++) blender.update(1 / 60);
    blender.set({ proud: 0 });
    for (let i = 0; i < 200; i++) blender.update(1 / 60);
    const settled = blender.update(1 / 60);
    expect(settled.eyes?.arcAmount).toBeCloseTo(0, 2);
  });
});
