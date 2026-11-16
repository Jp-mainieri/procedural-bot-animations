import { describe, expect, it } from "vitest";
import { RIG_BERRY } from "../src/characters/berry.js";
import { RIG_FLAME } from "../src/characters/flame.js";
import { axisOf, bendPath, circleLike, mixPath, parsePath } from "../src/parts.js";
import { ROUND_RADIUS } from "../src/rig.js";

const LEAF_L = RIG_BERRY.appendages.find((a) => a.role === "L")!;
const AXIS_L = axisOf(LEAF_L);

const numbers = (d: string) => d.match(/-?\d*\.?\d+/g)!.map(Number);

describe("bendPath", () => {
  const cmds = parsePath(LEAF_L.path);

  it("with no bend, returns the same points", () => {
    const a = numbers(LEAF_L.path);
    const b = numbers(bendPath(cmds, AXIS_L, 0));
    expect(b).toHaveLength(a.length);
    b.forEach((v, i) => expect(v).toBeCloseTo(a[i], 0));
  });

  it("bends the tip and leaves the base in place", () => {
    const d = bendPath(cmds, AXIS_L, 30);
    // The base hidden in the body (565,430) does not move; the tip (425,342) rises.
    expect(d).toContain("565,430");
    const tip = numbers(d).slice(6, 8); // end of the 1st C = tip (425,342)
    expect(tip[1]).toBeLessThan(342);
  });
});

describe("flame rig", () => {
  it("each tongue has a valid axis and a path the parser understands", () => {
    for (const a of RIG_FLAME.appendages) {
      expect(axisOf(a).L).toBeGreaterThan(50);
      expect(parsePath(a.path).length).toBeGreaterThan(2);
    }
  });
});

describe("round body", () => {
  for (const rig of [RIG_BERRY, RIG_FLAME]) {
    it(`${rig.id}: the circle has the same commands and is truly round`, () => {
      const body = parsePath(rig.body);
      const circ = circleLike(body, rig.anchor, ROUND_RADIUS);
      expect(circ.map((c) => c.c)).toEqual(body.map((c) => c.c));
      expect(circ.map((c) => c.pts.length)).toEqual(body.map((c) => c.pts.length));
      // Samples each cubic: every point within 0.1% of the radius.
      let p0 = circ[0].pts;
      for (const { c, pts } of circ.slice(1)) {
        if (c !== "C") continue;
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          const u = 1 - t;
          const x =
            u ** 3 * p0[0] + 3 * u * u * t * pts[0] + 3 * u * t * t * pts[2] + t ** 3 * pts[4];
          const y =
            u ** 3 * p0[1] + 3 * u * u * t * pts[1] + 3 * u * t * t * pts[3] + t ** 3 * pts[5];
          const r = Math.hypot(x - rig.anchor.x, y - rig.anchor.y);
          expect(Math.abs(r - ROUND_RADIUS) / ROUND_RADIUS).toBeLessThan(0.001);
        }
        p0 = pts.slice(4);
      }
    });

    it(`${rig.id}: the mix goes from the body (0) to the circle (1)`, () => {
      const body = parsePath(rig.body);
      const circ = circleLike(body, rig.anchor, ROUND_RADIUS);
      const nums = (d: string) => d.match(/-?\d*\.?\d+/g)!.map(Number);
      nums(mixPath(body, circ, 0)).forEach((v, i) =>
        expect(v).toBeCloseTo(nums(rig.body)[i], 0),
      );
    });
  }
});
