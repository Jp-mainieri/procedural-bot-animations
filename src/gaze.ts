import { damp, spring, type SpringState } from "./spring.js";
import { neverRepeating } from "./noise.js";
import { chance, mulberry32, randRange, type Rng } from "./rng.js";

export interface Point2D {
  x: number;
  y: number;
}

export type ArrivalStyle = "saccade" | "pursuit";

export interface GazeTarget {
  point: Point2D;
  /** How the eye should get there. Default "pursuit" (smooth, no overshoot) for a moving target, "saccade" (snap + settle) for a newly-appeared one — pass explicitly when you know which. */
  arrival?: ArrivalStyle;
}

export interface GazeOutput {
  offset: Point2D;
  /** 0..1: recently had a big saccade or a fast-moving target. Widens the eyes. */
  attention: number;
  /** 0..1: no target/motion for a while. Heavies the eyelids. */
  boredom: number;
}

export interface GazeEngineOptions {
  /** Damp rate for smooth pursuit. Default 9. */
  pursuitRate?: number;
  /** Spring for a saccade — the default slightly overshoots, then settles. */
  saccadeSpring?: { stiffness: number; damping: number };
  /** Constant small jitter amplitude so the eye never looks perfectly frozen. Default 0.015. */
  microsaccadeAmplitude?: number;
  /** Seconds with no target before boredom starts rising. Default 4. */
  boredomAfterSeconds?: number;
  /** Seconds between autonomous wander targets, used when no explicit target is given. Default [1.2, 3.8]. */
  wanderIntervalSeconds?: [number, number];
  wanderRange?: number;
  recenterChance?: number;
  rng?: Rng;
}

const DEFAULT_SACCADE_SPRING = { stiffness: 260, damping: 16 };

/**
 * Drives one `(x, y)` gaze offset (-1..1 ish) from either an explicit target
 * (pointer position, a focus anchor) or autonomous wandering, with two
 * distinct arrival feels — `pursuit` (critically damped, used for a target
 * that is itself moving, like a cursor) and `saccade` (slightly
 * underdamped, used for a target that just appeared) — plus a constant
 * microsaccade jitter and an attention/boredom scalar a caller can map onto
 * eye size and eyelid openness.
 */
export class GazeEngine {
  private pos: SpringState = { value: 0, velocity: 0 }; // x, driven by whichever arrival style is active
  private posY: SpringState = { value: 0, velocity: 0 };
  private pursuit: Point2D = { x: 0, y: 0 };
  private usingSaccade = false;
  private lastTargetPoint: Point2D | null = null;
  private attention = 0;
  private idleSeconds = 0;
  private wanderTarget: Point2D = { x: 0, y: 0 };
  private nextWanderAt = 0;
  private readonly opts: Required<Omit<GazeEngineOptions, "saccadeSpring">> & { saccadeSpring: { stiffness: number; damping: number } };

  constructor(options: GazeEngineOptions = {}) {
    this.opts = {
      pursuitRate: options.pursuitRate ?? 9,
      saccadeSpring: options.saccadeSpring ?? DEFAULT_SACCADE_SPRING,
      microsaccadeAmplitude: options.microsaccadeAmplitude ?? 0.015,
      boredomAfterSeconds: options.boredomAfterSeconds ?? 4,
      wanderIntervalSeconds: options.wanderIntervalSeconds ?? [1.2, 3.8],
      wanderRange: options.wanderRange ?? 0.6,
      recenterChance: options.recenterChance ?? 0.3,
      rng: options.rng ?? mulberry32(),
    };
  }

  /** Call every frame. Pass `null` for an explicit target to fall back to autonomous wandering. */
  update(dt: number, explicitTarget: GazeTarget | null, t: number): GazeOutput {
    const { rng, wanderIntervalSeconds, wanderRange, recenterChance, boredomAfterSeconds } = this.opts;

    let target = explicitTarget;
    if (!target) {
      this.idleSeconds += dt;
      this.nextWanderAt -= dt;
      if (this.nextWanderAt <= 0) {
        this.nextWanderAt = randRange(rng, wanderIntervalSeconds[0], wanderIntervalSeconds[1]);
        const newTarget = chance(rng, recenterChance)
          ? { x: 0, y: 0 }
          : { x: randRange(rng, -wanderRange, wanderRange), y: randRange(rng, -wanderRange, wanderRange) };
        this.wanderTarget = newTarget;
        target = { point: newTarget, arrival: "saccade" };
      } else {
        target = { point: this.wanderTarget, arrival: "pursuit" };
      }
    } else {
      this.idleSeconds = 0;
    }

    const isNewPoint =
      !this.lastTargetPoint || this.lastTargetPoint.x !== target.point.x || this.lastTargetPoint.y !== target.point.y;
    this.lastTargetPoint = target.point;

    const arrival = target.arrival ?? "pursuit";
    this.usingSaccade = arrival === "saccade" && isNewPoint ? true : this.usingSaccade;

    let x: number;
    let y: number;
    if (arrival === "saccade") {
      spring(this.pos, target.point.x, this.opts.saccadeSpring.stiffness, this.opts.saccadeSpring.damping, dt);
      spring(this.posY, target.point.y, this.opts.saccadeSpring.stiffness, this.opts.saccadeSpring.damping, dt);
      x = this.pos.value;
      y = this.posY.value;
      if (isNewPoint) this.attention = Math.min(1, this.attention + 0.6);
    } else {
      this.pursuit = { x: damp(this.pursuit.x, target.point.x, this.opts.pursuitRate, dt), y: damp(this.pursuit.y, target.point.y, this.opts.pursuitRate, dt) };
      // Keep the saccade spring following too, at rest, so a later saccade doesn't jump from a stale position.
      this.pos.value = this.pursuit.x;
      this.pos.velocity = 0;
      this.posY.value = this.pursuit.y;
      this.posY.velocity = 0;
      x = this.pursuit.x;
      y = this.pursuit.y;
    }

    this.attention = damp(this.attention, 0, 1.5, dt);
    const boredom = this.idleSeconds > boredomAfterSeconds ? Math.min(1, (this.idleSeconds - boredomAfterSeconds) / 3) : 0;

    const jitter = this.opts.microsaccadeAmplitude;
    x += neverRepeating(t, 7) * jitter;
    y += neverRepeating(t, 13) * jitter * 0.6;

    return { offset: { x, y }, attention: this.attention, boredom };
  }
}
