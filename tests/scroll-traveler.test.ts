import { describe, expect, it } from "vitest";
import { findActiveSlot, travelerFrame, type Slot } from "../src/scroll-traveler.js";

const slots: Slot[] = [
  { name: "hero", mood: "idle", rect: { x: 100, y: 0, width: 80, height: 80 } },
  { name: "features", mood: "happy", rect: { x: 100, y: 1000, width: 80, height: 80 } },
  { name: "footer", mood: "idle", rect: { x: 100, y: 2000, width: 80, height: 80 } },
];

describe("travelerFrame", () => {
  it("sits at the current slot's center when progress is 0", () => {
    const frame = travelerFrame(slots, 0, 0);
    expect(frame.x).toBeCloseTo(140, 0);
    expect(frame.y).toBeCloseTo(40, 0);
    expect(frame.flight).toBeCloseTo(0, 2);
  });

  it("arcs upward and shrinks at the midpoint of a flight", () => {
    const rest = travelerFrame(slots, 0, 0);
    const mid = travelerFrame(slots, 0, 0.5, { flightArc: 40, flightShrink: 0.12 });
    expect(mid.y).toBeLessThan(rest.y + 500); // arc pulls it up relative to the straight line
    expect(mid.flight).toBeCloseTo(1, 2);
  });

  it("switches mood partway through the flight", () => {
    const early = travelerFrame(slots, 0, 0.1);
    const late = travelerFrame(slots, 0, 0.9);
    expect(early.mood).toBe("idle");
    expect(late.mood).toBe("happy");
  });

  it("clamps the active index to a valid slot", () => {
    expect(() => travelerFrame(slots, 99, 0.5)).not.toThrow();
  });
});

describe("findActiveSlot", () => {
  it("picks the last slot whose center has crossed the viewport line", () => {
    expect(findActiveSlot(slots, 0, 800, 0.5)).toBe(0);
    expect(findActiveSlot(slots, 950, 800, 0.5)).toBe(1);
    expect(findActiveSlot(slots, 1950, 800, 0.5)).toBe(2);
  });
});
