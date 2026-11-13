import { clamp, lerp } from "./spring.js";
import type { PoseDelta } from "./types.js";

/**
 * One mood's fully-applied (weight = 1) look. Scale-like fields are lerped
 * from neutral (1 or 0) by the mood's weight and then multiplied across
 * active moods, so e.g. `curious` and `sleepy` can be mixed instead of one
 * replacing the other outright — the thing Open Bot Avatar's three-string
 * `mood` can't do.
 */
export interface MoodDefinition {
  eyeScaleX?: number;
  eyeScaleY?: number;
  eyeOffsetY?: number;
  eyeRotate?: number;
  eyeArcAmount?: number;
  eyeShut?: number;
  bodyY?: number;
  bodyScaleY?: number;
  bodyRotate?: number;
}

/** A starting set covering most app states; add your own with the same shape. */
export const builtinMoods: Record<string, MoodDefinition> = {
  neutral: {},
  curious: { eyeScaleY: 1.06, eyeOffsetY: -0.3, bodyRotate: 1.5 },
  focused: { eyeScaleY: 0.9, bodyScaleY: 0.99 },
  suspicious: { eyeScaleY: 0.58, eyeRotate: -8, bodyY: 0.6 },
  sleepy: { eyeScaleY: 0.5, eyeShut: 0.3, bodyY: 1.2 },
  proud: { eyeArcAmount: 1, bodyScaleY: 1.03 },
  sad: { eyeScaleY: 0.8, eyeOffsetY: 1, bodyY: 2 },
};

export type MoodWeights = Record<string, number>;

/**
 * Blends any number of simultaneously-active moods, each 0..1, into one
 * pose delta. Unlisted moods (weight 0 or absent) contribute nothing.
 */
export function blendMoods(weights: MoodWeights, moods: Record<string, MoodDefinition> = builtinMoods): PoseDelta {
  let eyeScaleX = 1;
  let eyeScaleY = 1;
  let eyeOffsetY = 0;
  let eyeRotate = 0;
  let eyeArcAmount = 0;
  let eyeShut = 0;
  let bodyY = 0;
  let bodyScaleY = 1;
  let bodyRotate = 0;

  for (const [name, rawWeight] of Object.entries(weights)) {
    const weight = clamp(rawWeight, 0, 1);
    if (weight <= 0) continue;
    const mood = moods[name];
    if (!mood) continue;

    eyeScaleX *= lerp(1, mood.eyeScaleX ?? 1, weight);
    eyeScaleY *= lerp(1, mood.eyeScaleY ?? 1, weight);
    eyeOffsetY += (mood.eyeOffsetY ?? 0) * weight;
    eyeRotate += (mood.eyeRotate ?? 0) * weight;
    eyeArcAmount = Math.max(eyeArcAmount, (mood.eyeArcAmount ?? 0) * weight);
    eyeShut = Math.max(eyeShut, (mood.eyeShut ?? 0) * weight);
    bodyY += (mood.bodyY ?? 0) * weight;
    bodyScaleY *= lerp(1, mood.bodyScaleY ?? 1, weight);
    bodyRotate += (mood.bodyRotate ?? 0) * weight;
  }

  return {
    eyes: { scaleX: eyeScaleX, scaleY: eyeScaleY, offsetY: eyeOffsetY, rotate: eyeRotate, arcAmount: eyeArcAmount, shut: eyeShut },
    body: { y: bodyY, scaleY: bodyScaleY, rotate: bodyRotate },
  };
}

export interface MoodBlenderOptions {
  /** How fast each mood's weight eases toward its target, 1/seconds. Default 5 (matches DevBerry's calibration). */
  rate?: number;
}

/**
 * Smooths mood weights over time instead of snapping them, so switching
 * which moods are "on" doesn't pop. Set target weights with `set`, read the
 * current smoothed blend with `update`.
 */
export class MoodBlender {
  private current: MoodWeights = {};
  private target: MoodWeights = {};
  private readonly rate: number;
  private readonly moods: Record<string, MoodDefinition>;

  constructor(options: MoodBlenderOptions & { moods?: Record<string, MoodDefinition> } = {}) {
    this.rate = options.rate ?? 5;
    this.moods = options.moods ?? builtinMoods;
  }

  /** Sets (or clears, at weight 0 / omission) target weights for the named moods. Others are left as they are. */
  set(weights: MoodWeights): void {
    Object.assign(this.target, weights);
  }

  update(dt: number): PoseDelta {
    const names = new Set([...Object.keys(this.current), ...Object.keys(this.target)]);
    for (const name of names) {
      const cur = this.current[name] ?? 0;
      const target = this.target[name] ?? 0;
      const next = lerp(cur, target, 1 - Math.exp(-this.rate * dt));
      this.current[name] = Math.abs(next) < 1e-4 && target === 0 ? 0 : next;
    }
    return blendMoods(this.current, this.moods);
  }
}
