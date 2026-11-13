import { describe, expect, it } from "vitest";
import { fakeTurn } from "../src/fake3d.js";

describe("fakeTurn", () => {
  it("is a no-op at turn = 0", () => {
    const delta = fakeTurn(0);
    expect(delta.leftEye?.offsetX).toBe(0);
    expect(delta.rightEye?.offsetX).toBe(0);
    expect(delta.leftEye?.scaleX).toBe(1);
    expect(delta.rightEye?.scaleX).toBe(1);
    expect(delta.body?.rotate).toBe(0);
  });

  it("slides both eyes toward the turn direction", () => {
    const delta = fakeTurn(0.5);
    expect(delta.leftEye?.offsetX).toBeGreaterThan(0);
    expect(delta.rightEye?.offsetX).toBeGreaterThan(0);
    expect(delta.leftEye?.offsetX).toBe(delta.rightEye?.offsetX);
  });

  it("shrinks the far eye and grows the near eye when turning right", () => {
    const delta = fakeTurn(1);
    expect(delta.leftEye!.scaleX!).toBeLessThan(1); // far
    expect(delta.rightEye!.scaleX!).toBeGreaterThan(1); // near
  });

  it("mirrors when turning left", () => {
    const delta = fakeTurn(-1);
    expect(delta.rightEye!.scaleX!).toBeLessThan(1); // now far
    expect(delta.leftEye!.scaleX!).toBeGreaterThan(1); // now near
  });

  it("clamps turn beyond ±1", () => {
    expect(fakeTurn(5)).toEqual(fakeTurn(1));
    expect(fakeTurn(-5)).toEqual(fakeTurn(-1));
  });
});
