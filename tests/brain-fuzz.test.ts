import { describe, expect, it } from "vitest";
import { Brain, type BrainConfig, type BrainInput, type EyePose, type Pose } from "../src/brain.js";
import { RIG_BERRY } from "../src/characters/berry.js";
import { RIG_FLAME } from "../src/characters/flame.js";
import { createLibrary, DEFAULT_LIBRARY, type Library } from "../src/library.js";

/*
 * Seeded fuzz over the pure Brain: random operations with nasty frame gaps.
 * Regression for the "body rotation explodes" bug: the gaze spring (K = 900,
 * explicit Euler) diverges for steps above ~38 ms, and the brain's dt clamp
 * was 50 ms, so any slow frame (tab resume, heavy rebuild) fed it energy.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THREE_PARTS: BrainConfig = {
  id: "sprout",
  baseHeight: 440,
  idleAppendage: { amp: 1, freq: 1 },
  flicker: 0,
  appendages: [{ role: "C" }, { role: "L" }, { role: "R" }],
};
const NO_PARTS: BrainConfig = { ...THREE_PARTS, id: "blob", baseHeight: 300, appendages: [] };
const CONFIGS: BrainConfig[] = [RIG_BERRY, RIG_FLAME, THREE_PARTS, NO_PARTS];

const customLibrary = (): Library => {
  const lib = createLibrary();
  lib.reactions.custom = { duration: 1, sample: (t) => ({ bodyRotate: 90 * Math.sin(t * Math.PI), rootY: -50 * t }) };
  lib.activities.custom = (s) => ({ bodyRotate: 10 * Math.sin(s * 3), partL: 20 });
  lib.moods.custom = { eyeSx: 0.2, bodyRotate: 5 };
  return lib;
};

const finite = (path: string, v: unknown) => {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`${path} is not finite: ${v}`);
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) finite(`${path}.${k}`, x);
  }
};

const within = (name: string, v: number, lo: number, hi: number) => {
  if (!(v >= lo && v <= hi)) throw new Error(`${name} = ${v} outside [${lo}, ${hi}]`);
};

function checkEye(name: string, e: EyePose) {
  within(`${name}.x`, e.x, -400, 400);
  within(`${name}.y`, e.y, -300, 300);
  within(`${name}.sx`, e.sx, 0, 4);
  within(`${name}.sy`, e.sy, 0, 4);
  within(`${name}.rot`, e.rot, -200, 200);
  within(`${name}.lidTop`, e.lidTop, 0, 1);
  within(`${name}.lidBottom`, e.lidBottom, 0, 1);
  within(`${name}.happy`, e.happy, 0, 1);
  within(`${name}.lidAngle`, e.lidAngle, -90, 90);
}

function checkPose(p: Pose, where: string) {
  try {
    finite("pose", p);
    within("bodyRotate", p.bodyRotate, -400, 400);
    within("centerRotate", p.centerRotate, -400, 400);
    within("rootY", p.rootY, -1500, 600);
    within("bodySx", p.bodySx, -0.5, 4);
    within("bodySy", p.bodySy, -0.5, 4);
    within("scale", p.scale, 0, 4);
    within("partsX", p.partsX, -80, 80);
    for (const k of ["partC", "partL", "partR"] as const) within(k, p[k], -300, 300);
    for (const k of ["bendC", "bendL", "bendR"] as const) within(k, p[k], -38.001, 38.001);
    within("attention", p.attention, 0, 1);
    within("boredom", p.boredom, 0, 1);
    within("opacity", p.opacity, 0, 1);
    checkEye("leftEye", p.leftEye);
    checkEye("rightEye", p.rightEye);
  } catch (e) {
    throw new Error(`${where}: ${(e as Error).message}`);
  }
}

function neutral(p: Pose, where: string) {
  try {
    within("bodyRotate", p.bodyRotate, -8, 8);
    within("rootY", p.rootY, -2, 2);
    within("bodySx", p.bodySx, 0.9, 1.1);
    within("bodySy", p.bodySy, 0.9, 1.1);
    within("scale", p.scale, 0.95, 1.05);
    for (const k of ["partC", "partL", "partR"] as const) within(k, p[k], -40, 40);
    for (const k of ["bendC", "bendL", "bendR"] as const) within(k, p[k], -12, 12);
    for (const e of [p.leftEye, p.rightEye]) {
      within("eye.x", e.x, -80, 80);
      within("eye.sx", e.sx, 0.5, 1.5);
      within("eye.rot", e.rot, -20, 20);
    }
  } catch (e) {
    throw new Error(`${where}: ${(e as Error).message}`);
  }
}

function pickDt(r: () => number): number {
  const x = r();
  if (x < 0.4) return 16;
  if (x < 0.55) return 4 + r() * 4;
  if (x < 0.8) return 33 + r() * 67;
  if (x < 0.92) return 250 + r() * 4750;
  if (x < 0.94) return 60000;
  if (x < 0.97) return 0;
  return -1; // marker: repeat `now`
}

function fuzz(seed: number, ops: number) {
  const r = mulberry32(seed);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const brain = new Brain(RIG_BERRY, { now: 0, rng });
  let lib: Library = DEFAULT_LIBRARY;
  const reactions = [...Object.keys(DEFAULT_LIBRARY.reactions), "custom", "nope", "__proto__", ""];
  const moods = [...Object.keys(DEFAULT_LIBRARY.moods), "custom", "ghost"];
  const acts = [...Object.keys(DEFAULT_LIBRARY.activities), "custom", "ghost"];
  let input: BrainInput = { gaze: null, hover: false, reduced: false, mood: { neutral: 1 }, activity: null, detail: "full" };
  let now = 0;
  const log: string[] = [];
  const extreme = () => pick([0, 0, 1, -1, 5, -5, 1e3, -1e3, r() * 2 - 1]);

  for (let i = 0; i < ops; i++) {
    const op = r();
    if (op < 0.5) {
      const dt = pickDt(r);
      if (dt >= 0) now += dt;
      log.push(`step dt=${dt.toFixed(1)}`);
      const pose = brain.step(now, input);
      checkPose(pose, `seed ${seed} op ${i} (${log.slice(-6).join(" | ")}) now=${now.toFixed(0)}`);
    } else if (op < 0.6) {
      const n = pick(reactions);
      log.push(`react ${n}`);
      brain.react(n, now);
    } else if (op < 0.65) brain.tap(now), log.push("tap");
    else if (op < 0.68) brain.hoverEnter(now), log.push("hoverEnter");
    else if (op < 0.71) brain.jump(r() < 0.5 ? undefined : -300 - r() * 2500), log.push("jump");
    else if (op < 0.75) (input = { ...input, hover: !input.hover }), log.push("hover");
    else if (op < 0.8) {
      const m: Record<string, number> = {};
      if (r() < 0.7) for (let k = 0; k < 1 + r() * 3; k++) m[pick(moods)] = r();
      input = { ...input, mood: m };
      log.push("mood");
    } else if (op < 0.84) {
      input = { ...input, activity: r() < 0.3 ? null : pick(acts) };
      log.push(`activity ${input.activity}`);
    } else if (op < 0.86) (input = { ...input, reduced: !input.reduced }), log.push("reduced");
    else if (op < 0.88) (input = { ...input, detail: input.detail === "full" ? "simple" : "full" }), log.push("detail");
    else if (op < 0.9) {
      brain.setConfig(pick(CONFIGS));
      log.push("setConfig");
    } else if (op < 0.92) {
      lib = r() < 0.5 ? DEFAULT_LIBRARY : customLibrary();
      brain.setLibrary(lib);
      log.push("setLibrary");
    } else if (op < 0.96) {
      input = { ...input, gaze: r() < 0.2 ? null : { x: extreme(), y: extreme() } };
      log.push("gaze");
    } else if (op < 0.98) {
      input = {
        ...input,
        glide: r() < 0.5 ? undefined : r() * 2,
        interest: r() < 0.5 ? 0 : pick([0, 1, r()]),
        proximity: pick([0, 1, r()]),
        bend: r() < 0.8 ? undefined : false,
      };
      log.push("glide/interest/proximity");
    }
  }

  // Quiet: neutral inputs, 6 s of 16 ms frames, must come back to rest.
  brain.setConfig(RIG_BERRY);
  brain.setLibrary(DEFAULT_LIBRARY);
  input = { gaze: { x: 0, y: 0 }, hover: false, reduced: false, mood: { neutral: 1 }, activity: null, detail: "full" };
  let last: Pose | null = null;
  for (let k = 0; k < 375; k++) {
    now += 16;
    last = brain.step(now, input);
    checkPose(last, `seed ${seed} quiet frame ${k}`);
  }
  neutral(last!, `seed ${seed} after 6 s of quiet`);
}

describe("Brain fuzz", () => {
  for (const seed of [1, 2, 3, 7, 42, 1234, 99999, 2024]) {
    it(`stays finite, bounded and recovers (seed ${seed})`, () => {
      fuzz(seed, 4000);
    });
  }

  it("a sustained 40-50 ms frame rate does not blow up the gaze (the original bug)", () => {
    const brain = new Brain(RIG_BERRY, { now: 0, rng: mulberry32(5) });
    const input: BrainInput = { gaze: { x: 0.4, y: -0.2 }, hover: false, reduced: false, mood: { neutral: 1 }, activity: null, detail: "full" };
    let now = 0;
    for (const dt of [50, 45, 40]) {
      for (let i = 0; i < 400; i++) {
        now += dt;
        checkPose(brain.step(now, input), `dt=${dt} frame ${i}`);
      }
    }
  });

  it("resume() makes the next frame a fresh start, so a long pause advances nothing", () => {
    const brain = new Brain(RIG_BERRY, { now: 0, rng: mulberry32(9) });
    const input: BrainInput = { gaze: { x: 1, y: 0 }, hover: false, reduced: false, mood: { neutral: 1 }, activity: null, detail: "full" };
    for (let t = 0; t < 1000; t += 16) brain.step(t, input);
    brain.resume();
    const p = brain.step(600000, input);
    checkPose(p, "after resume");
    expect(p.bendL).toBe(0);
  });
});
