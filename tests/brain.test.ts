import { describe, expect, it } from "vitest";
import { Brain, type BrainInput, type Pose } from "../src/brain.js";
import { RIG_BERRY } from "../src/characters/berry.js";
import { RIG_FLAME } from "../src/characters/flame.js";
import { createLibrary } from "../src/library.js";
import { REACTIONS } from "../src/reactions.js";
import { ROUND_RADIUS, type Rig } from "../src/rig.js";

/** Fixed pseudo-random generator, so the tests do not depend on luck. */
function fixedRng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const INPUT: BrainInput = {
  gaze: null,
  hover: false,
  reduced: false,
  mood: { neutral: 1 },
  activity: null,
  detail: "full",
};

const make = (rig: Rig = RIG_BERRY) => new Brain(rig, { now: 0, rng: fixedRng() });

/** Runs the brain at 60 fps for `ms` and returns every pose. */
function run(c: Brain, start: number, ms: number, e: Partial<BrainInput> = {}): Pose[] {
  const poses: Pose[] = [];
  for (let t = start; t <= start + ms; t += 1000 / 60) poses.push(c.step(t, { ...INPUT, ...e }));
  return poses;
}

describe("Brain", () => {
  it("at rest, stays near neutral", () => {
    const c = make();
    const last = run(c, 0, 3000).at(-1)!;
    expect(Math.abs(last.rootY)).toBeLessThan(1);
    expect(Math.abs(last.bodySy - 1)).toBeLessThan(0.05);
    expect(last.leftEye.happy).toBe(0);
  });

  it("success jumps, makes the eyes happy and returns to neutral by itself", () => {
    const c = make();
    run(c, 0, 500);
    c.react("success", 500);
    const poses = run(c, 500, REACTIONS.success.duration * 1000 + 600);
    expect(Math.min(...poses.map((p) => p.rootY))).toBeLessThan(-150);
    expect(Math.max(...poses.map((p) => p.leftEye.happy))).toBeCloseTo(1);
    expect(Math.max(...poses.map((p) => p.sparks))).toBeGreaterThan(0.5);
    expect(c.currentReaction).toBeNull();
    expect(Math.abs(poses.at(-1)!.rootY)).toBeLessThan(1);
    expect(poses.at(-1)!.sparks).toBe(0);
  });

  it("with reduced motion, the reaction changes the expression but does not move the body", () => {
    const c = make();
    c.react("success", 0);
    const poses = run(c, 0, 1600, { reduced: true });
    expect(Math.min(...poses.map((p) => p.rootY))).toBe(0);
    expect(Math.max(...poses.map((p) => p.leftEye.happy))).toBeCloseTo(1);
    expect(Math.max(...poses.map((p) => p.sparks))).toBe(0);
  });

  it("mood changes gradually, with no hard cut", () => {
    const c = make();
    run(c, 0, 500);
    const poses = run(c, 500, 1500, { mood: { suspicious: 1 } });
    // Suspicious closes the top eyelid; it does not flatten the eye.
    const first = poses[1].leftEye.lidTop;
    const last = poses.at(-1)!.leftEye.lidTop;
    expect(last).toBeGreaterThan(0.35);
    expect(first).toBeLessThan(0.1);
  });

  it("sleeping, closes the eyes and shows the z z z", () => {
    const c = make();
    const last = run(c, 0, 2000, { activity: "sleeping" }).at(-1)!;
    expect(last.leftEye.sy).toBeLessThan(0.2);
    expect(last.zzz).toBeGreaterThan(0.9);
  });

  it("successive clicks escalate: huffs on the 3rd, dizzy on the 5th, hides on the 8th", () => {
    const c = make();
    const r = [0, 200, 400, 600, 800, 1000, 1200, 1400].map((t) => c.tap(t));
    expect(r[1]).toBe("hop");
    expect(r[2]).toBe("huff");
    expect(r[4]).toBe("dizzy");
    expect(r[7]).toBe("hide");
    // The reaction in progress is not cut: 'hide' waits its turn and enters.
    expect(c.pendingGesture).toBe("hide");
    run(c, 1400, 4000);
    expect(c.currentReaction === "hide" || c.pendingGesture === null).toBe(true);
  });

  it("fast clicks do not cut the reaction in progress: one ends, the next enters", () => {
    const c = make();
    const switches: { name: string | null; t: number }[] = [];
    let previous: string | null = null;
    for (let t = 0; t <= 6000; t += 1000 / 60) {
      // A click every 150 ms during the first 2 s.
      if (t < 2000 && Math.floor(t / 150) !== Math.floor((t - 1000 / 60) / 150)) c.tap(t);
      c.step(t, { ...INPUT });
      if (c.currentReaction !== previous) {
        switches.push({ name: c.currentReaction, t });
        previous = c.currentReaction;
      }
    }
    // Every switch to another reaction happens after the previous one ended
    // (goes through null) or exactly at its end.
    for (let i = 1; i < switches.length; i++) {
      const a = switches[i - 1];
      const b = switches[i];
      if (a.name && b.name) {
        const dur = REACTIONS[a.name as keyof typeof REACTIONS].duration * 1000;
        expect(b.t - a.t, `${a.name} → ${b.name}`).toBeGreaterThanOrEqual(dur - 20);
      }
    }
  });

  it("the Flame has its own click escalation", () => {
    const c = new Brain(RIG_FLAME, { now: 0, rng: fixedRng() });
    const r = [0, 200, 400].map((t) => c.tap(t));
    expect(r[2]).toBe("heatUp");
  });

  it("spaced clicks do not count as a sequence", () => {
    const c = make();
    const r = [0, 1000, 2000, 3000].map((t) => c.tap(t));
    expect(r).not.toContain("huff");
  });

  it("cursor resting on top: cuddle after 2.5 s and nap after 9 s", () => {
    const c = make();
    const cuddle = run(c, 0, 4000, { hover: true }).at(-1)!;
    expect(cuddle.leftEye.happy).toBeGreaterThan(0.9);
    const nap = run(c, 4000, 8000, { hover: true }).at(-1)!;
    expect(nap.zzz).toBeGreaterThan(0.9);
    expect(c.tap(12100)).toBe("wake");
  });

  it("transformation: at the swap, the round body has the bubble's exact radius, in the same place", () => {
    for (const name of ["morphLoading", "morphCheck", "morphCode", "energy"] as const) {
      const { sample } = REACTIONS[name];
      let before = sample(0);
      let swaps = 0;
      for (let i = 1; i <= 20000; i++) {
        const d = sample(i / 20000);
        if ((before.swap ?? 0) >= 0.5 !== (d.swap ?? 0) >= 0.5) {
          swaps++;
          // Narrows the swap interval down to 1e-9 and compares the two sides.
          let lo = (i - 1) / 20000;
          let hi = i / 20000;
          const sideLo = (sample(lo).swap ?? 0) >= 0.5;
          while (hi - lo > 1e-9) {
            const mid = (lo + hi) / 2;
            if ((sample(mid).swap ?? 0) >= 0.5 === sideLo) lo = mid;
            else hi = mid;
          }
          const [a, b] = [sample(lo), sample(hi)];
          const body = sideLo ? b : a;
          const obj = sideLo ? a : b;
          const bodyRadius = ROUND_RADIUS * (1 + (body.scale ?? 0));
          expect(Math.abs(bodyRadius - (obj.bubbleR ?? 0)), name).toBeLessThan(0.05);
          expect(body.round, name).toBeCloseTo(1, 4);
          expect(body.morph, name).toBeCloseTo(1, 4);
          for (const k of ["bodySx", "bodySy", "bodyRotate", "rootY", "centerRotate"] as const)
            expect(Math.abs(body[k] ?? 0), `${name} ${k}`).toBeLessThan(1e-3);
          for (const k of [
            "bubbleX",
            "bubbleY",
            "dotsDist",
            "bubbleHole",
            "orbitOpen",
            "objScale",
            "bubbleArc",
          ] as const)
            expect(Math.abs(obj[k] ?? 0), `${name} ${k}`).toBeLessThan(1e-3);
        }
        before = d;
      }
      expect(swaps, name).toBe(2);
    }
  });

  it("at the swap, the brain leaves the body still (no breathing, no gaze)", () => {
    const c = make();
    run(c, 0, 400, { gaze: { x: 0.8, y: 0.3 }, hover: true });
    c.react("morphLoading", 400);
    const poses = run(c, 400, 1000, { gaze: { x: 0.8, y: 0.3 }, hover: true });
    const swap = poses.find((p) => p.swap >= 0.5)!;
    expect(swap).toBeDefined();
    expect(Math.abs(swap.bodySx - 1)).toBeLessThan(1e-3);
    expect(Math.abs(swap.bodySy - 1)).toBeLessThan(1e-3);
    expect(Math.abs(swap.bodyRotate)).toBeLessThan(1e-3);
    expect(Math.abs(swap.rootY)).toBeLessThan(1e-3);
  });

  it("a reaction requested in the middle of the transformation waits for it to end", () => {
    const c = make();
    c.react("morphCheck", 0);
    run(c, 0, 1000);
    c.react("success", 1000);
    expect(c.currentReaction).toBe("morphCheck");
    run(c, 1000, REACTIONS.morphCheck.duration * 1000);
    expect(c.currentReaction).toBe("success");
  });

  it("in profile, the far eye vanishes", () => {
    const c = make();
    run(c, 0, 300);
    c.react("profile", 300);
    const poses = run(c, 300, 1400);
    const smallest = Math.min(...poses.map((p) => Math.min(p.leftEye.sx, p.rightEye.sx)));
    expect(smallest).toBeLessThan(0.1);
  });

  it("suspicious lowers the top eyelid, tilted", () => {
    const c = make();
    const last = run(c, 0, 2000, { mood: { suspicious: 1 } }).at(-1)!;
    expect(last.leftEye.lidTop).toBeGreaterThan(0.3);
    expect(Math.abs(last.leftEye.lidAngle)).toBeGreaterThan(10);
    expect(last.leftEye.lidAngle).toBeCloseTo(-last.rightEye.lidAngle, 3);
  });

  it("every reaction ends and returns to neutral", () => {
    for (const name of Object.keys(REACTIONS) as (keyof typeof REACTIONS)[]) {
      const c = make();
      c.react(name, 0);
      const last = run(c, 0, REACTIONS[name].duration * 1000 + 1500).at(-1)!;
      expect(c.currentReaction, name).toBeNull();
      expect(last.scale, name).toBeCloseTo(1, 2);
      expect(Math.abs(last.rootY), name).toBeLessThan(1);
    }
  });

  it("put out, the flame shrinks, goes gray and gives off smoke", () => {
    const c = make();
    const last = run(c, 0, 2000, { activity: "out" }).at(-1)!;
    expect(last.scale).toBeLessThan(0.7);
    expect(last.gray).toBeCloseTo(1, 2);
    expect(last.smoke).toBeGreaterThan(0.3);
  });

  it("blaze lights the core and gives off embers, and then puts everything out", () => {
    const c = make();
    c.react("blaze", 0);
    const poses = run(c, 0, REACTIONS.blaze.duration * 1000 + 300);
    expect(Math.max(...poses.map((p) => p.core))).toBeCloseTo(1, 2);
    expect(Math.max(...poses.map((p) => p.embers))).toBeCloseTo(1, 2);
    expect(poses.at(-1)!.core).toBe(0);
    expect(poses.at(-1)!.embers).toBe(0);
  });

  it("turning the face shrinks the eye on the side it turns toward", () => {
    const c = make();
    const last = run(c, 0, 1500, { gaze: { x: 1, y: 0 } }).at(-1)!;
    expect(last.rightEye.sx).toBeLessThan(last.leftEye.sx);
    expect(last.leftEye.x).toBeGreaterThan(20);
  });

  it("at a small size, hides the accessories", () => {
    const c = make();
    const last = run(c, 0, 1500, { activity: "thinking", detail: "simple" }).at(-1)!;
    expect(last.ellipsis).toBe(0);
  });

  it("an unknown reaction name is ignored", () => {
    const c = make();
    expect(c.react("doesNotExist", 0)).toBe(false);
    expect(c.react("toString", 0)).toBe(false);
    expect(c.currentReaction).toBeNull();
    const poses = run(c, 0, 500);
    expect(poses.every((p) => Number.isFinite(p.rootY))).toBe(true);
    expect(c.react("success", 500)).toBe(true);
  });

  it("a custom reaction added to a library plays and returns to neutral", () => {
    const library = createLibrary();
    library.reactions.nod = {
      duration: 1,
      sample: (t) => ({ partC: 20 * Math.sin(t * Math.PI), eyeSx: 0.5 * Math.sin(t * Math.PI) }),
    };
    const c = new Brain(RIG_BERRY, { now: 0, rng: fixedRng(), library });
    expect(c.react("nod", 0)).toBe(true);
    expect(c.currentReaction).toBe("nod");
    const poses = run(c, 0, 500);
    expect(Math.max(...poses.map((p) => p.leftEye.sx))).toBeGreaterThan(1.2);
    const last = run(c, 500, 1500).at(-1)!;
    expect(c.currentReaction).toBeNull();
    expect(last.leftEye.sx).toBeCloseTo(1, 1);
    // The default library was not touched.
    expect(createLibrary().reactions.nod).toBeUndefined();
  });

  it("a rig with no appendages runs 300 frames without NaN", () => {
    const bare: Rig = { ...RIG_BERRY, appendages: [] };
    const c = new Brain(bare, { now: 0, rng: fixedRng() });
    c.react("success", 100);
    const poses = run(c, 0, 5000, { gaze: { x: 0.5, y: -0.2 }, hover: true });
    expect(poses.length).toBeGreaterThanOrEqual(300);
    for (const p of poses)
      for (const v of Object.values(p))
        if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    expect(poses.at(-1)!.partL).toBe(0);
    expect(poses.at(-1)!.bendR).toBe(0);
  });
});
