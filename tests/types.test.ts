import { describe, expect, it } from "vitest";
import { addPose, neutralPose, resolveDelta } from "../src/types.js";

describe("addPose/resolveDelta", () => {
  it("adding an empty delta leaves the pose at neutral", () => {
    const pose = addPose(neutralPose(), resolveDelta({}));
    expect(pose).toEqual(neutralPose());
  });

  it("`eyes` convenience field applies to both eyes", () => {
    const pose = addPose(neutralPose(), resolveDelta({ eyes: { offsetY: 2 } }));
    expect(pose.leftEye.offsetY).toBe(2);
    expect(pose.rightEye.offsetY).toBe(2);
  });

  it("a per-eye field overrides the shared `eyes` field for that eye only", () => {
    const pose = addPose(neutralPose(), resolveDelta({ eyes: { offsetY: 2 }, leftEye: { offsetY: 9 } }));
    expect(pose.leftEye.offsetY).toBe(9);
    expect(pose.rightEye.offsetY).toBe(2);
  });

  it("scale-like fields multiply across successive deltas", () => {
    let pose = neutralPose();
    pose = addPose(pose, resolveDelta({ eyes: { scaleY: 0.5 } }));
    pose = addPose(pose, resolveDelta({ eyes: { scaleY: 0.5 } }));
    expect(pose.leftEye.scaleY).toBeCloseTo(0.25, 5);
  });

  it("additive fields (offset, rotate) sum across successive deltas", () => {
    let pose = neutralPose();
    pose = addPose(pose, resolveDelta({ body: { rotate: 3 } }));
    pose = addPose(pose, resolveDelta({ body: { rotate: 4 } }));
    expect(pose.body.rotate).toBe(7);
  });

  it("shut/arcAmount take the max across deltas, not the sum", () => {
    let pose = neutralPose();
    pose = addPose(pose, resolveDelta({ eyes: { shut: 0.3 } }));
    pose = addPose(pose, resolveDelta({ eyes: { shut: 0.7 } }));
    expect(pose.leftEye.shut).toBe(0.7);
  });
});
