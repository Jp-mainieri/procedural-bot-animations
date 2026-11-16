// @ts-ignore: the project has no @types/node; vitest runs on Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHARACTER_SCALE,
  characterToRig,
  flattenPath,
  normalizePath,
  parseCharacter,
  polyBounds,
  serializePath,
  validateCharacter,
  type CharacterDefinition,
} from "../src/character.js";
import { EXAMPLE_CHARACTERS } from "../src/examples.js";
import { parsePath } from "../src/parts.js";
import { RIG_BERRY } from "../src/characters/berry.js";

/*
 * Fixtures 1-3 are Open Bot Avatar example definitions, copied unchanged
 * (MIT, Copyright (c) Dominik Scholz, https://github.com/dominikscholz/open-bot-avatar).
 */
const OBA_FIXTURES: CharacterDefinition[] = [
  {
    version: 1,
    id: "controller",
    name: "Controller",
    body: {
      path: "M28 22C38 20 44 23 50 23C56 23 62 20 72 22C84 24 90 34 91 48C92 62 91 76 82 80C75 83 69 78 66 72C63 67 58 66 50 66C42 66 37 67 34 72C31 78 25 83 18 80C9 76 8 62 9 48C10 34 16 24 28 22Z",
    },
    eyes: { x: 50, y: 42, spacing: 16, scale: 1.05 },
  },
  {
    version: 1,
    id: "mug",
    name: "Mug",
    body: {
      path:
        "M22 20H62C67 20 70 23 70 28V72C70 80 64 86 56 86H28C20 86 14 80 14 72V28C14 23 17 20 22 20Z" +
        "M68 36C80 34 87 42 87 53C87 64 80 72 68 70Z" +
        "M69 45L69 61C75.5 62 79 58.5 79 53C79 47.5 76 44 69 45Z",
    },
    eyes: { x: 42, y: 49, spacing: 16, scale: 1.15 },
  },
  {
    version: 1,
    id: "lightbulb",
    name: "Lightbulb",
    body: {
      path:
        "M36 72V66C36 60 18 55 18 40A32 32 0 0 1 82 40C82 55 64 60 64 66V72Z" +
        "M36 68H64V77A4 4 0 0 1 60 81H40A4 4 0 0 1 36 77Z" +
        "M43 78H57V84A4 4 0 0 1 53 88H47A4 4 0 0 1 43 84Z",
    },
    eyes: { x: 50, y: 40, spacing: 17, scale: 1.2 },
  },
];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const errorsOf = (input: unknown): string[] => {
  const r = validateCharacter(input);
  return r.ok ? [] : r.errors;
};
const pts = (d: string) => normalizePath(d).map((c) => `${c.c}${c.pts.map((v) => Math.round(v * 1000) / 1000).join(",")}`);

function allNumbers(o: unknown, out: number[] = []): number[] {
  if (typeof o === "number") out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => allNumbers(x, out));
  else if (o && typeof o === "object") Object.values(o).forEach((x) => allNumbers(x, out));
  return out;
}

function pointInPoly(polys: number[][][], x: number, y: number): boolean {
  let c = false;
  for (const poly of polys)
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  return c;
}

describe("Open Bot Avatar definitions", () => {
  for (const f of OBA_FIXTURES)
    it(`${f.id} validates unchanged`, () => {
      const r = validateCharacter(clone(f));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.body.path).toBe(f.body.path);
    });
});

describe("eye size and spacing", () => {
  const base = EXAMPLE_CHARACTERS[0]; // body 72 wide, 66 tall (x 14..86, y 24..90)
  const run = (eyes: CharacterDefinition["eyes"]) => validateCharacter({ ...clone(base), eyes });
  it("valid Open Bot Avatar fixtures are never rejected", () => {
    for (const f of OBA_FIXTURES) expect(validateCharacter(clone(f)).ok).toBe(true);
  });
  it("flags eyes that are small for the body and suggests a scale for 26 %", () => {
    const r = run({ x: 50, y: 56, spacing: 20, scale: 0.9 }); // 9.9 / 66 = 15 %
    expect(r.ok && r.warnings).toEqual([
      "eyes.scale: eyes are small for this body (15 % of body height); expressions read best at 22–30 % — try scale ≈ 1.56",
    ]);
  });
  it("does not flag eyes at 18 % or more", () => {
    const r = run({ x: 50, y: 56, spacing: 20, scale: 1.1 }); // 12.1 / 66 = 18.3 %
    expect(r.ok && r.warnings).toEqual([]);
  });
  it("spacing: error below the old 5*scale rule, warning up to 6.05*scale, clean beyond", () => {
    expect(run({ x: 50, y: 56, spacing: 7, scale: 1.55 }).ok).toBe(false); // < 7.75
    const warn = run({ x: 50, y: 56, spacing: 8, scale: 1.55 }); // 7.75 <= 8 < 9.38
    expect(warn.ok && warn.warnings.some((w) => w.startsWith("eyes.spacing:"))).toBe(true);
    const fine = run({ x: 50, y: 56, spacing: 9.4, scale: 1.55 });
    expect(fine.ok && fine.warnings).toEqual([]);
  });
  it("an eye that only the wider pill pushes onto the outline is a warning, not an error", () => {
    const slim = (scale: number): any => ({
      version: 1,
      id: "slim",
      name: "Slim",
      body: { path: "M35 20 L65 20 L65 80 L35 80 Z" },
      eyes: { x: 50, y: 50, spacing: 20, scale },
    });
    // Left eye centre at 40, 5 from the edge: the 4-wide pill fits up to scale 2.1, the 5.5-wide one only up to 1.53 (margin 0.8).
    const r = validateCharacter(slim(1.8));
    expect(r.ok).toBe(true);
    expect(r.ok && r.warnings.some((w) => /close to the body outline/.test(w))).toBe(true);
    expect(errorsOf(slim(2.6)).some((e) => e.startsWith("eyes: the left eye"))).toBe(true);
  });
});

describe("example characters", () => {
  for (const def of EXAMPLE_CHARACTERS)
    describe(def.id, () => {
      it("validates with zero warnings", () => {
        const r = validateCharacter(clone(def));
        expect(r.ok && r.warnings).toEqual([]);
        expect(r.ok).toBe(true);
      });

      it("compiles to a finite rig standing on the ground, centred", () => {
        const rig = characterToRig(def);
        expect(allNumbers(rig).every(Number.isFinite)).toBe(true);
        const b = polyBounds(flattenPath(parsePath(rig.body)));
        expect(b.maxY).toBeGreaterThan(959.5);
        expect(b.maxY).toBeLessThan(960.5);
        expect((b.minX + b.maxX) / 2).toBeGreaterThan(626.5);
        expect((b.minX + b.maxX) / 2).toBeLessThan(627.5);
        expect(rig.id).toBe(def.id);
        expect(rig.appendages.length).toBe(def.rig?.parts?.length ?? 0);
        expect(rig.ground).toEqual({ x: 627, y: 960 });
      });

      it("round-trips through parseCharacter", () => {
        const r = parseCharacter(JSON.stringify(def));
        expect(r.ok).toBe(true);
      });
    });

  it("eyes are Berry-sized: 24-28 % of the body height, centres 26-32 % of its width, and every style stays inside", () => {
    for (const def of EXAMPLE_CHARACTERS) {
      const bb = polyBounds(flattenPath(normalizePath(def.body.path, true)));
      const H = bb.maxY - bb.minY;
      const W = bb.maxX - bb.minX;
      const h = 11 * def.eyes.scale;
      expect(h / H, def.id).toBeGreaterThanOrEqual(0.24);
      expect(h / H, def.id).toBeLessThanOrEqual(0.28);
      expect(def.eyes.spacing / W, def.id).toBeGreaterThanOrEqual(0.26);
      expect(def.eyes.spacing / W, def.id).toBeLessThanOrEqual(0.32);

      const rig = characterToRig(def);
      const body = flattenPath(parsePath(rig.body));
      for (const name of ["classic", "pumpy", "big"] as const) {
        const st = rig.eyeStyles[name];
        for (const [side, sign] of [[rig.eyes.left, 1], [rig.eyes.right, -1]] as const) {
          const cx = side.x + sign * st.dx;
          const cy = side.y + st.dy;
          const r = st.w / 2;
          const half = st.h / 2 - r;
          const t = (st.tilt * Math.PI) / 180;
          for (let k = 0; k < 48; k++) {
            const a = (k / 48) * 2 * Math.PI;
            const cap = Math.sin(a) >= 0 ? half : -half;
            const lx = r * Math.cos(a);
            const ly = cap + r * Math.sin(a);
            const px = cx + lx * Math.cos(t) - ly * Math.sin(t);
            const py = cy + lx * Math.sin(t) + ly * Math.cos(t);
            expect(pointInPoly(body, px, py), `${def.id} ${name} ${sign > 0 ? "left" : "right"}`).toBe(true);
          }
        }
      }
    }
  });
  it("parts bases overlap the body (pivot inside the body outline)", () => {
    const sprout = EXAMPLE_CHARACTERS.find((c) => c.id === "sprout")!;
    const rig = characterToRig(sprout);
    const body = flattenPath(parsePath(rig.body));
    for (const a of rig.appendages) {
      const poly = flattenPath(parsePath(a.path))[0];
      // The lowest point of every leaf lies below the top of the body.
      const bodyTop = polyBounds(body).minY;
      expect(Math.max(...poly.map((p) => p[1]))).toBeGreaterThan(bodyTop);
    }
  });
});

describe("rig derivation", () => {
  const blob = EXAMPLE_CHARACTERS[0];
  const rig = characterToRig(blob);
  it("eyes and classic style follow the formulas", () => {
    expect(rig.eyeStyles.classic.w).toBeCloseTo(5.5 * 1.55 * CHARACTER_SCALE);
    expect(rig.eyeStyles.classic.h).toBeCloseTo(11 * 1.55 * CHARACTER_SCALE);
    expect(rig.eyeStyles.classic.w * 2).toBeCloseTo(rig.eyeStyles.classic.h);
    expect(rig.eyes.right.x - rig.eyes.left.x).toBeCloseTo(21 * CHARACTER_SCALE);
    expect(rig.eyes.left.y).toBeCloseTo(960 + (54 - 90) * CHARACTER_SCALE);
  });
  it("pumpy and big keep Berry's ratios", () => {
    const c = rig.eyeStyles.classic;
    const bc = RIG_BERRY.eyeStyles.classic;
    expect(rig.eyeStyles.pumpy.w / c.w).toBeCloseTo(RIG_BERRY.eyeStyles.pumpy.w / bc.w);
    expect(rig.eyeStyles.big.h / c.h).toBeCloseTo(RIG_BERRY.eyeStyles.big.h / bc.h);
    expect(rig.eyeStyles.big.tilt).toBe(RIG_BERRY.eyeStyles.big.tilt);
    expect(rig.eyeStyles.pumpy.dy / c.h).toBeCloseTo(RIG_BERRY.eyeStyles.pumpy.dy / bc.h);
  });
  it("eyeStyles overrides convert 0..100 units to engine units", () => {
    const def = clone(blob);
    def.rig = { eyeStyles: { big: { w: 8, tilt: 20 } } };
    const r = characterToRig(def);
    expect(r.eyeStyles.big.w).toBeCloseTo(8 * CHARACTER_SCALE);
    expect(r.eyeStyles.big.tilt).toBe(20);
  });
  it("baseHeight is 0.6 × body height without parts, ground − mean pivot with parts", () => {
    const b = polyBounds(flattenPath(parsePath(rig.body)));
    expect(rig.baseHeight).toBeCloseTo(0.6 * (b.maxY - b.minY), 0);
    const sprout = characterToRig(EXAMPLE_CHARACTERS.find((c) => c.id === "sprout")!);
    const mean = sprout.appendages.reduce((s, a) => s + a.pivot.y, 0) / 3;
    expect(sprout.baseHeight).toBeCloseTo(960 - mean);
  });
  it("shadow, anchor, flicker and idle", () => {
    expect(rig.shadow.y).toBe(988);
    expect(rig.shadow.ry).toBe(22);
    expect(rig.anchor).toEqual({ x: 627, y: 660 });
    expect(rig.flicker).toBe(0);
    expect(rig.idleAppendage).toEqual({ amp: 1, freq: 1 });
    expect(rig.core).toBeUndefined();
  });
});

describe("path normalisation", () => {
  it("relative commands, H/V and implicit repeats", () => {
    expect(pts("m10 10 h20 v20 h-20 z")).toEqual(["M10,10", "L30,10", "L30,30", "L10,30", "Z"]);
    expect(pts("M10 10 l5 0 5 0 z")).toEqual(["M10,10", "L15,10", "L20,10", "Z"]);
    expect(pts("M0 0 20 0 20 20 Z")).toEqual(["M0,0", "L20,0", "L20,20", "Z"]);
  });
  it("Q becomes an exact cubic, T and S reflect", () => {
    expect(pts("M0 0 Q30 0 30 30")).toEqual(["M0,0", "C20,0,30,10,30,30"]);
    expect(pts("M0 0 C0 10 10 20 20 20 S40 10 40 0")[2]).toBe("C30,20,40,10,40,0");
    // T after Q: control reflected through the current point.
    expect(pts("M0 0 Q10 10 20 0 T40 0")[2]).toBe("C26.667,-6.667,33.333,-6.667,40,0");
  });
  it("a quarter arc is one cubic with the circle constant", () => {
    const [m, c] = normalizePath("M10 0 A10 10 0 0 1 0 10");
    expect(m.pts).toEqual([10, 0]);
    expect(c.c).toBe("C");
    const k = 10 * 0.5522847;
    expect(c.pts[0]).toBeCloseTo(10, 4);
    expect(c.pts[1]).toBeCloseTo(k, 3);
    expect(c.pts[2]).toBeCloseTo(k, 3);
    expect(c.pts[3]).toBeCloseTo(10, 4);
    expect(c.pts.slice(4)).toEqual([0, 10]);
  });
  it("a half arc becomes two cubics passing through the far point", () => {
    const cmds = normalizePath("M0 0 a10 10 0 0 1 20 0");
    expect(cmds.map((c) => c.c)).toEqual(["M", "C", "C"]);
    expect(cmds[1].pts[4]).toBeCloseTo(10, 4);
    expect(cmds[1].pts[5]).toBeCloseTo(-10, 4);
    expect(cmds[2].pts.slice(4)).toEqual([20, 0]);
  });
  it("output only uses M, L, C, Z and survives parsePath", () => {
    const d = "M10 10 H50 V30 Q60 40 50 50 T30 50 A8 8 0 1 0 20 40 S12 30 10 20 z m5 5 l5 0 0 5z";
    const cmds = normalizePath(d);
    expect(cmds.every((c) => "MLCZ".includes(c.c))).toBe(true);
    const back = parsePath(serializePath(cmds));
    expect(back.length).toBe(cmds.length);
    for (let i = 0; i < back.length; i++) back[i].pts.forEach((v, k) => expect(v).toBeCloseTo(cmds[i].pts[k], 1));
  });
  it("rejects malformed paths", () => {
    expect(() => normalizePath("L10 10")).toThrow();
    expect(() => normalizePath("M10 10 L5")).toThrow();
    expect(() => normalizePath("M0 0 X5 5")).toThrow();
    expect(() => normalizePath("")).toThrow();
  });
});

describe("validation errors", () => {
  const base = EXAMPLE_CHARACTERS[0];
  it("not an object", () => {
    expect(errorsOf(42)[0]).toMatch(/^\(root\)/);
  });
  it("missing key", () => {
    const d: any = clone(base);
    delete d.eyes;
    expect(errorsOf(d).some((e) => e.startsWith("eyes:"))).toBe(true);
  });
  it("bad id, version and name", () => {
    const d: any = clone(base);
    d.id = "Bad Id";
    d.version = 2;
    d.name = "";
    const e = errorsOf(d);
    expect(e.some((x) => x.startsWith("id:"))).toBe(true);
    expect(e.some((x) => x.startsWith("version:"))).toBe(true);
    expect(e.some((x) => x.startsWith("name:"))).toBe(true);
  });
  it("collects all errors", () => {
    const d: any = clone(base);
    d.id = "!";
    d.eyes.spacing = 1;
    d.eyes.scale = 9;
    expect(errorsOf(d).length).toBeGreaterThanOrEqual(3);
  });
  it("eye outside the body names the eye", () => {
    const d: any = clone(base);
    d.eyes.x = 20;
    const e = errorsOf(d);
    expect(e.some((x) => x.startsWith("eyes: the left eye"))).toBe(true);
  });
  it("open path is closed automatically, with a warning", () => {
    const d: any = clone(base);
    d.body.path = "M20 20 L80 20 L80 80 L20 80";
    expect(errorsOf(d)).toEqual([]);
    const r = validateCharacter(d);
    expect(r.ok && r.warnings).toContain("body.path: subpath 1 is not closed; closed automatically");
    expect(normalizePath(d.body.path, true).at(-1)?.c).toBe("Z");
  });
  it("unparseable path, too many coordinates out of range, too small, off the safe area", () => {
    const d: any = clone(base);
    d.body.path = "M20 20 Q";
    expect(errorsOf(d).some((e) => e.startsWith("body.path:"))).toBe(true);
    d.body.path = "M20 20 L200 20 L80 80 Z";
    expect(errorsOf(d).some((e) => /coordinates must stay/.test(e))).toBe(true);
    d.body.path = "M40 40 L60 40 L60 60 L40 60 Z";
    expect(errorsOf(d).some((e) => /at least 30/.test(e))).toBe(true);
    d.body.path = "M2 20 L80 20 L80 80 L2 80 Z";
    expect(errorsOf(d).some((e) => /safe area/.test(e))).toBe(true);
  });
  it("path length and segment limits", () => {
    const d: any = clone(base);
    d.body.path = "M20 20" + " L30 30 L20 20".repeat(220) + " Z";
    expect(errorsOf(d).some((e) => /segments/.test(e))).toBe(true);
    d.body.path = "M20 20 " + "L21 21 ".repeat(1000) + "Z";
    expect(errorsOf(d).some((e) => /6000/.test(e))).toBe(true);
  });
  it("near the edge only warns", () => {
    const d: any = clone(base);
    d.body.path = "M7 20 L85 20 L85 85 L7 85 Z";
    d.eyes = { x: 46, y: 50, spacing: 20, scale: 1 };
    const r = validateCharacter(d);
    expect(r.ok && r.warnings.some((w) => /outside 8\.\.92/.test(w))).toBe(true);
  });
  it("unknown top-level keys warn", () => {
    const d: any = clone(base);
    d.mood = "x";
    const r = validateCharacter(d);
    expect(r.ok && r.warnings[0]).toMatch(/^mood: unknown key/);
  });
  it("eye ranges", () => {
    const d: any = clone(base);
    d.eyes.spacing = "wide";
    expect(errorsOf(d)).toContain("eyes.spacing: must be a number between 4 and 60");
    d.eyes.spacing = 20;
    d.eyes.scale = 0.1;
    expect(errorsOf(d)).toContain("eyes.scale: must be a number between 0.4 and 3");
  });
  describe("rig.parts", () => {
    const sprout = () => clone(EXAMPLE_CHARACTERS.find((c) => c.id === "sprout")!) as any;
    it("duplicate role", () => {
      const d = sprout();
      d.rig.parts[1].role = "C";
      expect(errorsOf(d).some((e) => e.startsWith("rig.parts[1].role"))).toBe(true);
    });
    it("tip equal to pivot", () => {
      const d = sprout();
      d.rig.parts[0].tip = [50, 43];
      expect(errorsOf(d).some((e) => e.startsWith("rig.parts[0].tip"))).toBe(true);
    });
    it("pivot far from the body", () => {
      const d = sprout();
      d.rig.parts[2].pivot = [95, 5];
      expect(errorsOf(d).some((e) => e.startsWith("rig.parts[2].pivot"))).toBe(true);
    });
    it("bad part path, more than 3 parts, bad role", () => {
      const d = sprout();
      d.rig.parts[0].path = "M1 1 L5 5";
      d.rig.parts[1].role = "Q";
      d.rig.parts.push(d.rig.parts[0]);
      const e = errorsOf(d);
      expect(e.some((x) => x.startsWith("rig.parts[0].path"))).toBe(true);
      expect(e.some((x) => x.startsWith("rig.parts[1].role"))).toBe(true);
      expect(e.some((x) => x.startsWith("rig.parts:"))).toBe(true);
    });
  });
  it("rig options", () => {
    const d: any = clone(base);
    d.rig = { flicker: 3, color: "red", idle: { amp: -1 }, eyeStyles: { big: { w: 500 }, huge: {} } };
    const r = validateCharacter(d);
    expect(r.ok).toBe(false);
    const e = errorsOf(d);
    expect(e.some((x) => x.startsWith("rig.flicker"))).toBe(true);
    expect(e.some((x) => x.startsWith("rig.color"))).toBe(true);
    expect(e.some((x) => x.startsWith("rig.idle.amp"))).toBe(true);
    expect(e.some((x) => x.startsWith("rig.eyeStyles.big.w"))).toBe(true);
  });
});

describe("parseCharacter", () => {
  it("not json", () => {
    const r = parseCharacter("not json");
    expect(r.ok).toBe(false);
  });
  it("valid json gives the definition and the rig", () => {
    const r = parseCharacter(JSON.stringify(OBA_FIXTURES[1]));
    expect(r.ok && r.value.rig.id).toBe("mug");
  });
  it("never throws on odd input", () => {
    for (const s of ["null", "[]", "42", '"x"', "{}", '{"version":1}']) expect(() => parseCharacter(s)).not.toThrow();
  });
});

describe("docs/character-format.md", () => {
  const md = readFileSync(new URL("../docs/character-format.md", import.meta.url), "utf8");
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  it("has worked examples and every one validates with zero warnings", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of blocks) {
      const r = parseCharacter(b);
      expect(r.ok && r.warnings).toEqual([]);
    }
  });
  it("ends with a prompt section", () => {
    expect(md).toMatch(/## Prompt[\s\S]*```text[\s\S]*THE CHARACTER I WANT:/);
  });
});
