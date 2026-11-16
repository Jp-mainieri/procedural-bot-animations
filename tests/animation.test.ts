// @ts-ignore: the project has no @types/node; vitest runs on Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FIELD_INFO,
  addToLibrary,
  closestFields,
  compileAnimation,
  describeAnimation,
  parseAnimation,
  validateAnimation,
  type AnimationDefinition,
} from "../src/animation.js";
import { FIELDS, type DeltaField, type PartialDelta } from "../src/delta.js";
import { EXAMPLE_ANIMATIONS } from "../src/examples.js";
import { MOODS } from "../src/moods.js";
import { ACTIVITIES, REACTIONS } from "../src/reactions.js";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const errorsOf = (input: unknown): string[] => {
  const r = validateAnimation(input);
  return r.ok ? [] : r.errors;
};
const warningsOf = (input: unknown): string[] => {
  const r = validateAnimation(input);
  return r.ok ? r.warnings : [];
};
const reaction = (tracks: unknown, extra: object = {}) => ({ version: 1, kind: "reaction", id: "test", name: "Test", duration: 1, tracks, ...extra });
const activity = (tracks: unknown, extra: object = {}) => ({ version: 1, kind: "activity", id: "test", name: "Test", period: 2, tracks, ...extra });

const inRange = (field: string, v: number) => {
  const i = FIELD_INFO[field as DeltaField];
  return i !== undefined && v >= i.min - 1e-9 && v <= i.max + 1e-9;
};
const outside = (d: PartialDelta): string[] =>
  Object.entries(d)
    .filter(([k, v]) => v !== undefined && !inRange(k, v))
    .map(([k, v]) => `${k}=${v}`);

describe("FIELD_INFO", () => {
  it("covers every field exactly once", () => {
    expect(Object.keys(FIELD_INFO).sort()).toEqual([...FIELDS].sort());
  });
  it("has sane ranges around rest", () => {
    for (const k of FIELDS) {
      const i = FIELD_INFO[k];
      expect(i.rest).toBe(0);
      expect(i.min).toBeLessThanOrEqual(0);
      expect(i.max).toBeGreaterThanOrEqual(0);
      expect(i.max - i.min).toBeGreaterThan(0);
      expect(i.description.length).toBeGreaterThan(10);
    }
  });
  it("every built-in reaction, activity and mood stays inside the ranges", () => {
    const bad: string[] = [];
    for (const [name, r] of Object.entries(REACTIONS))
      for (let i = 0; i <= 400; i++) for (const o of outside(r.sample(i / 400))) bad.push(`reaction ${name} ${o}`);
    for (const [name, a] of Object.entries(ACTIVITIES))
      for (let i = 0; i <= 2000; i++) for (const o of outside(a(i * 0.01))) bad.push(`activity ${name} ${o}`);
    for (const [name, m] of Object.entries(MOODS)) for (const o of outside(m)) bad.push(`mood ${name} ${o}`);
    expect([...new Set(bad)]).toEqual([]);
  });
});

describe("examples", () => {
  for (const def of EXAMPLE_ANIMATIONS)
    describe(def.id, () => {
      it("validates with zero warnings", () => {
        const r = validateAnimation(clone(def));
        expect(r.ok && r.warnings).toEqual([]);
        expect(r.ok).toBe(true);
      });
      it("describes itself", () => {
        const text = describeAnimation(def);
        expect(text).toContain(def.name);
        expect(text.length).toBeGreaterThan(40);
      });
      it("round-trips through parseAnimation", () => {
        expect(parseAnimation(JSON.stringify(def)).ok).toBe(true);
      });
    });

  it("reactions are all-zero at t=0 and t=1 and stay in range", () => {
    for (const def of EXAMPLE_ANIMATIONS) {
      if (def.kind !== "reaction") continue;
      const c = compileAnimation(def);
      if (c.kind !== "reaction") throw new Error("kind");
      expect(c.def.duration).toBe(def.duration);
      for (const t of [0, 1]) for (const v of Object.values(c.def.sample(t))) expect(v).toBe(0);
      for (let i = 0; i <= 100; i++) expect(outside(c.def.sample(i / 100))).toEqual([]);
    }
  });

  it("the activity is continuous across the loop seam", () => {
    const def = EXAMPLE_ANIMATIONS.find((d) => d.kind === "activity")!;
    if (def.kind !== "activity") throw new Error("kind");
    const c = compileAnimation(def);
    if (c.kind !== "activity") throw new Error("kind");
    const start = c.def(0);
    for (const s of [def.period - 1e-6, def.period, def.period * 3, def.period * 7 - 1e-6]) {
      const v = c.def(s);
      for (const k of Object.keys(start) as DeltaField[]) expect(v[k]!).toBeCloseTo(start[k]!, 3);
    }
    expect(c.def(-def.period / 4)).toEqual(c.def((def.period * 3) / 4));
  });

  it("volume is preserved where the example squashes (bodySx ≈ -bodySy)", () => {
    for (const id of ["nod", "stretch"]) {
      const def = EXAMPLE_ANIMATIONS.find((d) => d.id === id)!;
      if (def.kind !== "reaction") throw new Error("kind");
      const sy = def.tracks.bodySy!;
      const sx = def.tracks.bodySx!;
      sy.forEach((k, i) => expect(sx[i][1]).toBeCloseTo(-k[1], 6));
    }
  });
});

describe("validation: structure", () => {
  const ok = () => clone(EXAMPLE_ANIMATIONS.find((d) => d.id === "nod")!) as any;
  it("not an object, bad version, kind, id, name", () => {
    expect(errorsOf("x")[0]).toMatch(/^\(root\)/);
    const d = ok();
    d.version = 2;
    d.kind = "loop";
    d.id = "Bad-Id";
    d.name = "";
    const e = errorsOf(d);
    for (const p of ["version:", "kind:", "id:", "name:"]) expect(e.some((x) => x.startsWith(p))).toBe(true);
  });
  it("duration and period limits", () => {
    const d = ok();
    d.duration = 0.05;
    expect(errorsOf(d)).toContain("duration: must be a number of seconds between 0.2 and 10");
    d.duration = 11;
    expect(errorsOf(d).length).toBe(1);
    const a = activity({ rootY: [[0, 0], [1, 0]] }, { period: 25 });
    expect(errorsOf(a)).toContain("period: must be a number of seconds between 0.3 and 20");
  });
  it("unknown field suggests the closest names", () => {
    const e = errorsOf(reaction({ bodySX: [[0, 0], [1, 0]], eyeXX: [[0, 0], [1, 0]] }));
    expect(e).toHaveLength(2);
    expect(e[0]).toMatch(/^tracks\.bodySX: unknown field; closest valid names: bodySx/);
    expect(e[1]).toContain("eyeX");
  });
  it("too many tracks", () => {
    const tracks: Record<string, unknown> = {};
    for (const k of FIELDS.slice(0, 25)) tracks[k] = [[0, 0], [1, 0]];
    expect(errorsOf(reaction(tracks)).some((e) => /25 tracks, the limit is 24/.test(e))).toBe(true);
  });
  it("no tracks", () => {
    expect(errorsOf(reaction({}))).toContain("tracks: needs at least one track");
    expect(errorsOf(reaction(undefined))[0]).toMatch(/^tracks:/);
  });
  it("collects every error", () => {
    const e = errorsOf(reaction({ rootY: [[0, 1], [1, 1]], bodySy: [[0, 0], [1, 9]], nope: [] }, { duration: 0 }));
    expect(e.length).toBeGreaterThanOrEqual(4);
  });
  it("unknown top-level keys warn", () => {
    expect(warningsOf({ ...ok(), color: "red" })[0]).toMatch(/^color: unknown key/);
  });
});

describe("validation: keyframes", () => {
  it("shape, order, first t, value range, curve, count", () => {
    const e = (kfs: unknown) => errorsOf(reaction({ rootY: kfs }));
    expect(e("x")[0]).toMatch(/^tracks\.rootY: must be an array/);
    expect(e([[0, 0]])[0]).toMatch(/at least 2 keyframes/);
    expect(e([[0, 0], [1]])[0]).toMatch(/^tracks\.rootY\[1\]: must be \[t, value\]/);
    expect(e([[0, 0], [2, 0]])[0]).toMatch(/^tracks\.rootY\[1\]: t must be a number between 0 and 1/);
    expect(e([[0.1, 0], [1, 0]])[0]).toMatch(/^tracks\.rootY\[0\]: the first keyframe must have t = 0/);
    expect(e([[0, 0], [0.6, 5], [0.4, 0], [1, 0]]).join()).toMatch(/rootY\[2\].*must not decrease/);
    expect(e([[0, 0], [0.5, 9999], [1, 0]])[0]).toMatch(/^tracks\.rootY\[1\]: value for rootY must be a number between -400 and 650/);
    expect(e([[0, 0], [0.5, "a"], [1, 0]])[0]).toMatch(/value for rootY/);
    expect(e([[0, 0], [0.5, 1, "bounce"], [1, 0]])[0]).toMatch(/curve must be one of "linear", "easeIn", "easeOut", "smooth"/);
    const many = Array.from({ length: 41 }, (_, i) => [i / 40, 0]);
    expect(e(many)[0]).toMatch(/41 keyframes, the limit is 40/);
    expect(e(many.slice(0, 40))).toEqual([]);
  });
  it("accepts every curve name and equal times", () => {
    for (const c of ["linear", "easeIn", "easeOut", "smooth"]) expect(errorsOf(reaction({ rootY: [[0, 0], [0.5, -10, c], [1, 0]] }))).toEqual([]);
    expect(errorsOf(reaction({ rootY: [[0, 0], [0.5, -10], [0.5, 10], [1, 0]] }))).toEqual([]);
  });
});

describe("validation: reactions", () => {
  it("must start and end at 0", () => {
    expect(errorsOf(reaction({ rootY: [[0, 5], [0.5, -10], [1, 0]] }))[0]).toMatch(/^tracks\.rootY: must start and end at 0/);
    expect(errorsOf(reaction({ rootY: [[0, 0], [0.5, -10], [1, 3]] }))[0]).toMatch(/last value 3/);
  });
  it("a track that ends early at 0 is fine", () => {
    expect(errorsOf(reaction({ rootY: [[0, 0], [0.3, -10], [0.6, 0]] }))).toEqual([]);
  });
  it("morph fields warn", () => {
    const w = warningsOf(reaction({ rootY: [[0, 0], [0.5, -10], [1, 0]], round: [[0, 0], [0.5, 1], [1, 0]] }));
    expect(w.some((x) => /morph-group fields \(round\)/.test(x))).toBe(true);
  });
  it("holdGaze for most of the duration warns", () => {
    const tracks = (end: number) => ({ rootY: [[0, 0], [0.5, -10], [1, 0]], holdGaze: [[0, 0], [0.1, 1], [end, 1], [end + 0.05, 0], [1, 0]] });
    expect(warningsOf(reaction(tracks(0.9))).some((x) => /holdGaze/.test(x))).toBe(true);
    expect(warningsOf(reaction(tracks(0.4)))).toEqual([]);
  });
  it("no body, eyes or lids track warns", () => {
    const w = warningsOf(reaction({ partC: [[0, 0], [0.5, 10], [1, 0]] }));
    expect(w.some((x) => /no body, eyes or lids track/.test(x))).toBe(true);
  });
});

describe("validation: activities", () => {
  it("first and last values must match and last t must be 1", () => {
    expect(errorsOf(activity({ rootY: [[0, 0], [0.5, -10], [1, -5]] }))[0]).toMatch(/^tracks\.rootY: the first and last values must be equal/);
    expect(errorsOf(activity({ rootY: [[0, 0], [0.5, -10], [0.9, 0]] }))[0]).toMatch(/^tracks\.rootY: the last keyframe must have t = 1/);
    expect(errorsOf(activity({ rootY: [[0, -3], [0.5, -10], [1, -3]] }))).toEqual([]);
  });
  it("has no reaction-only warnings", () => {
    expect(warningsOf(activity({ partC: [[0, 0], [0.5, 10], [1, 0]] }))).toEqual([]);
  });
});

describe("validation: moods", () => {
  const mood = (pose: unknown) => ({ version: 1, kind: "mood", id: "calm", name: "Calm", pose });
  it("accepts a normal pose", () => {
    expect(errorsOf(mood({ lidTop: 0.3, partL: 8 }))).toEqual([]);
  });
  it("rejects morph group, sparks, opacity and scale", () => {
    for (const k of ["round", "bubbleR", "sparks", "opacity", "scale"]) expect(errorsOf(mood({ [k]: 0.1 }))[0]).toMatch(new RegExp(`^pose\\.${k}: not allowed in a mood`));
  });
  it("range, unknown field, empty, not an object", () => {
    expect(errorsOf(mood({ lidTop: 5 }))[0]).toMatch(/^pose\.lidTop: must be a number between 0 and 1/);
    expect(errorsOf(mood({ lidTopp: 0.2 }))[0]).toMatch(/closest valid names: lidTop/);
    expect(errorsOf(mood({}))[0]).toMatch(/at least one field/);
    expect(errorsOf(mood([]))[0]).toMatch(/^pose:/);
  });
});

describe("parseAnimation", () => {
  it("not json never throws", () => {
    expect(parseAnimation("not json").ok).toBe(false);
    for (const s of ["null", "[]", "{}", '{"kind":"mood"}']) expect(() => parseAnimation(s)).not.toThrow();
  });
});

describe("addToLibrary", () => {
  it("puts each kind in its table", () => {
    const lib = { reactions: {} as Record<string, any>, activities: {} as Record<string, any>, moods: {} as Record<string, any> };
    for (const d of EXAMPLE_ANIMATIONS as AnimationDefinition[]) addToLibrary(lib, compileAnimation(d));
    expect(Object.keys(lib.reactions).sort()).toEqual(["nod", "shake", "sideEye", "stretch"]);
    expect(Object.keys(lib.activities)).toEqual(["humming"]);
    expect(lib.moods.dreamy.lidTop).toBe(0.3);
    expect(typeof lib.reactions.nod.sample).toBe("function");
    expect(typeof lib.activities.humming).toBe("function");
  });
});

describe("closestFields", () => {
  it("finds near matches", () => {
    expect(closestFields("bodysx")[0]).toBe("bodySx");
    expect(closestFields("lid")).toContain("lidTop");
  });
});

describe("docs/animation-format.md", () => {
  const md = readFileSync(new URL("../docs/animation-format.md", import.meta.url), "utf8");
  it("every json example validates with zero warnings", () => {
    const blocks = [...md.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
    expect(blocks.length).toBe(3);
    for (const b of blocks) {
      const r = parseAnimation(b);
      expect(r.ok && r.warnings).toEqual([]);
    }
  });
  it("the field table matches FIELD_INFO", () => {
    for (const k of FIELDS) {
      const i = FIELD_INFO[k];
      expect(md).toContain(`| \`${k}\` | ${i.group} | ${i.unit} | ${i.min} | ${i.max} | ${i.description} |`);
    }
  });
  it("ends with a prompt section naming every field", () => {
    const prompt = md.slice(md.indexOf("## Prompt"));
    expect(prompt).toContain("THE ANIMATION I WANT:");
    for (const k of FIELDS) expect(prompt).toContain(`- ${k} [`);
  });
});
