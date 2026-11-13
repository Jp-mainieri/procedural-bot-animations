import { describe, expect, it } from "vitest";
import { Brain } from "../src/brain.js";

describe("Brain", () => {
  it("produces a pose every frame without a mounted renderer (pure, no DOM)", () => {
    const brain = new Brain();
    const pose = brain.update(1 / 60, null);
    expect(typeof pose.body.y).toBe("number");
    expect(typeof pose.leftEye.offsetX).toBe("number");
  });

  it("reflects a set mood in the eyes after it eases in", () => {
    const brain = new Brain({ moods: { rate: 10 } });
    brain.setMood({ proud: 1 });
    let pose;
    for (let i = 0; i < 120; i++) pose = brain.update(1 / 60, null);
    expect(pose!.leftEye.arcAmount).toBeGreaterThan(0.8);
  });

  it("a triggered reaction shows up in the pose while it plays", () => {
    const brain = new Brain();
    brain.react("bounce");
    const mid = brain.update(0.25, null); // partway through bounce's 0.55s
    expect(mid.body.y).toBeLessThan(0);
  });

  it("settles back to a roughly neutral body position once a reaction finishes", () => {
    const brain = new Brain();
    brain.react("bounce");
    let pose;
    for (let i = 0; i < 60; i++) pose = brain.update(1 / 60, null); // 1s, past bounce's 0.55s
    expect(Math.abs(pose!.body.y)).toBeLessThan(1);
  });

  it("looking at a pointer target slides the eyes rather than leaving them centered", () => {
    const brain = new Brain({ gaze: { microsaccadeAmplitude: 0 } });
    let pose;
    for (let i = 0; i < 60; i++) pose = brain.update(1 / 60, { point: { x: 0.8, y: 0 }, arrival: "pursuit" });
    expect(pose!.leftEye.offsetX).toBeGreaterThan(0);
  });
});
