import { clamp, damp, type SpringState } from "./spring.js";
import { chance, mulberry32, randRange, type Rng } from "./rng.js";

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Sum of a few incommensurate sine waves so the output never visibly
 * repeats over a normal viewing session, unlike a single `sin(t)`.
 */
export function neverRepeating(t: number, seed = 0): number {
  const a = Math.sin(t * 0.9 + seed * 1.7);
  const b = Math.sin(t * 1.53 + seed * 0.4) * 0.6;
  const c = Math.sin(t * 2.31 + seed * 2.9) * 0.35;
  return (a + b + c) / 1.95;
}

export interface BreathingOptions {
  /** Cycles per second. Default 0.26 (~1.65 rad/s, calibrated by ear). */
  frequency?: number;
  /** How much the avatar "deepens" per breath, 0..1 of its base depth. */
  depthAmount?: number;
  /** A per-instance phase/seed so several avatars on one page drift apart. */
  seed?: number;
}

/** Depth modulation for idle breathing. Feed the result into `avatar.update({ depth })`. */
export function breathingDepth(t: number, baseDepth: number, opts: BreathingOptions = {}): number {
  const { frequency = 0.26, depthAmount = 0.12, seed = 0 } = opts;
  const wave = Math.sin(t * frequency * Math.PI * 2 + seed);
  return Math.max(0, baseDepth * (1 + wave * depthAmount));
}

export interface GazeControllerOptions {
  /** How fast the gaze eases toward its target, 1/seconds. Default 9. */
  rate?: number;
  /** Seconds of pointer inactivity before autonomous wandering kicks in. Default 2.5. */
  wanderAfterIdleSeconds?: number;
  /** Min/max seconds between new wander targets. Default [1.2, 3.8]. */
  wanderIntervalSeconds?: [number, number];
  /** Chance a new wander target recenters instead of picking a new point. Default 0.3. */
  recenterChance?: number;
  /** Wander target range, each axis in [-range, range]. Default 0.6 (lookAt is -1..1). */
  wanderRange?: number;
  rng?: Rng;
}

/**
 * Drives a `{ x, y }` gaze target (-1..1, matches open-bot-avatar's `lookAt`):
 * follows an external pointer target when present, and wanders on its own
 * once the pointer has been idle for a while.
 */
export class GazeController {
  private current: Point2D = { x: 0, y: 0 };
  private wanderTarget: Point2D = { x: 0, y: 0 };
  private idleSeconds = 0;
  private nextWanderAt = 0;
  private readonly opts: Required<GazeControllerOptions>;

  constructor(opts: GazeControllerOptions = {}) {
    this.opts = {
      rate: opts.rate ?? 9,
      wanderAfterIdleSeconds: opts.wanderAfterIdleSeconds ?? 2.5,
      wanderIntervalSeconds: opts.wanderIntervalSeconds ?? [1.2, 3.8],
      recenterChance: opts.recenterChance ?? 0.3,
      wanderRange: opts.wanderRange ?? 0.6,
      rng: opts.rng ?? mulberry32(),
    };
  }

  /** Call every frame. `pointerTarget` is null when there is no live pointer/gaze target. */
  update(dt: number, pointerTarget: Point2D | null): Point2D {
    const { rate, wanderAfterIdleSeconds, wanderIntervalSeconds, recenterChance, wanderRange, rng } =
      this.opts;

    let target: Point2D;
    if (pointerTarget) {
      this.idleSeconds = 0;
      target = pointerTarget;
    } else {
      this.idleSeconds += dt;
      if (this.idleSeconds >= wanderAfterIdleSeconds) {
        this.nextWanderAt -= dt;
        if (this.nextWanderAt <= 0) {
          this.nextWanderAt = randRange(rng, wanderIntervalSeconds[0], wanderIntervalSeconds[1]);
          this.wanderTarget = chance(rng, recenterChance)
            ? { x: 0, y: 0 }
            : { x: randRange(rng, -wanderRange, wanderRange), y: randRange(rng, -wanderRange, wanderRange) };
        }
      }
      target = this.idleSeconds >= wanderAfterIdleSeconds ? this.wanderTarget : { x: 0, y: 0 };
    }

    this.current = {
      x: damp(this.current.x, target.x, rate, dt),
      y: damp(this.current.y, target.y, rate, dt),
    };
    return this.current;
  }
}

export interface BlinkOptions {
  /** Min/max seconds between blinks. Default [1.8, 6]. */
  intervalSeconds?: [number, number];
  /** Blink duration in seconds. Default 0.15. */
  durationSeconds?: number;
  /** Chance a blink is a double-blink. Default 0.2. */
  doubleChance?: number;
  rng?: Rng;
}

/**
 * Scheduler for an eyelid-style blink that a renderer without a built-in
 * blink can drive by scaling the eyes on the Y axis. Open Bot Avatar blinks
 * on its own, so this is only needed for other renderers; kept here because
 * the timing values are the ones calibrated for this skill's demos.
 */
export class BlinkScheduler {
  private nextAt: number;
  private closedUntil = -1;
  private pendingSecondBlink = false;
  private readonly opts: Required<BlinkOptions>;

  constructor(opts: BlinkOptions = {}) {
    this.opts = {
      intervalSeconds: opts.intervalSeconds ?? [1.8, 6],
      durationSeconds: opts.durationSeconds ?? 0.15,
      doubleChance: opts.doubleChance ?? 0.2,
      rng: opts.rng ?? mulberry32(),
    };
    this.nextAt = randRange(this.opts.rng, ...this.opts.intervalSeconds);
  }

  /** Call every frame with the running clock `t` (seconds). Returns eyelid openness 0..1. */
  update(t: number): number {
    const { intervalSeconds, durationSeconds, doubleChance, rng } = this.opts;

    if (this.closedUntil < 0 && t >= this.nextAt) {
      this.closedUntil = t + durationSeconds;
    }
    if (this.closedUntil >= 0 && t >= this.closedUntil) {
      this.closedUntil = -1;
      if (this.pendingSecondBlink) {
        this.pendingSecondBlink = false;
        this.nextAt = t + durationSeconds * 1.6;
      } else {
        if (chance(rng, doubleChance)) {
          this.pendingSecondBlink = true;
          this.nextAt = t + durationSeconds * 1.6;
        } else {
          this.nextAt = t + randRange(rng, ...intervalSeconds);
        }
      }
    }

    if (this.closedUntil < 0) return 1;
    const remaining = this.closedUntil - t;
    const half = durationSeconds / 2;
    return remaining > half ? remaining / half - 1 + (1 - (remaining - half) / half) : remaining / half;
  }
}

export interface BounceState {
  /** Vertical offset, in the same units as your host transform (e.g. px). */
  y: SpringState;
  squashX: number;
  squashY: number;
  velocityY: number;
  airborne: boolean;
}

export interface BounceOptions {
  /** Upward impulse on trigger. Default -900 (negative = up). */
  impulse?: number;
  /** Downward acceleration. Default 3200. */
  gravity?: number;
  /** Fraction of impact velocity kept on bounce, 0 = no bounce. Default 0.32. */
  bounceEnergy?: number;
  /** Stops bouncing once |velocity| falls below this. Default 40. */
  restVelocity?: number;
  /** Landing squash spring stiffness/damping. Default k=320, c=15. */
  squashSpring?: { stiffness: number; damping: number };
  /** Max squash amount (0..1 of scale). Default 0.16. */
  maxSquash?: number;
  /** Air stretch per unit of upward velocity, clamped. Default [-0.05, 0.1]. */
  stretchClamp?: [number, number];
}

export function createBounceState(): BounceState {
  return { y: { value: 0, velocity: 0 }, squashX: 0, squashY: 0, velocityY: 0, airborne: false };
}

/**
 * Jump physics for a squash & stretch reaction: call `trigger()` once (e.g.
 * on click, or entering a "success" state), then call `update()` every
 * frame and apply `{ translateY: y.value, scaleX: 1 + squashX, scaleY: 1 + squashY }`
 * to the host element's CSS transform.
 */
export class Bounce {
  readonly state = createBounceState();
  private readonly opts: Required<BounceOptions>;

  constructor(opts: BounceOptions = {}) {
    this.opts = {
      impulse: opts.impulse ?? -900,
      gravity: opts.gravity ?? 3200,
      bounceEnergy: opts.bounceEnergy ?? 0.32,
      restVelocity: opts.restVelocity ?? 40,
      squashSpring: opts.squashSpring ?? { stiffness: 320, damping: 15 },
      maxSquash: opts.maxSquash ?? 0.16,
      stretchClamp: opts.stretchClamp ?? [-0.05, 0.1],
    };
  }

  trigger(impulse = this.opts.impulse): void {
    this.state.velocityY = impulse;
    this.state.airborne = true;
  }

  update(dt: number): BounceState {
    const s = this.state;
    const { gravity, bounceEnergy, restVelocity, squashSpring, maxSquash, stretchClamp } = this.opts;

    if (s.airborne) {
      s.velocityY += gravity * dt;
      s.y.value += s.velocityY * dt;

      if (s.y.value >= 0) {
        s.y.value = 0;
        if (Math.abs(s.velocityY) > restVelocity) {
          s.velocityY = -s.velocityY * bounceEnergy;
          s.squashY = -maxSquash;
          s.squashX = maxSquash * 0.6;
        } else {
          s.velocityY = 0;
          s.airborne = false;
        }
      }
    }

    // Stretch toward the direction of travel while airborne (ignored right
    // after a landing squash, since squashSpring below takes over first).
    const stretch = s.airborne ? clamp(-s.velocityY / 12000, stretchClamp[0], stretchClamp[1]) : 0;
    const squashRate = squashSpring.stiffness / squashSpring.damping;
    s.squashY = damp(s.squashY, s.airborne ? -stretch : 0, squashRate, dt);
    s.squashX = damp(s.squashX, s.airborne ? stretch * 0.5 : 0, squashRate, dt);

    return s;
  }
}

export interface LeanState {
  angle: number;
}

/** Velocity-based lean, e.g. for a character being dragged or auto-scrolled. */
export function velocityLean(velocityX: number, maxAngleDeg = 16, factor = 0.015): number {
  return clamp(velocityX * factor, -maxAngleDeg, maxAngleDeg);
}

/** Appendage/secondary-motion-style lag: how far a trailing part should sit behind the body's motion. */
export function velocityLag(velocityX: number, maxAngleDeg = 25, factor = 0.02): number {
  return clamp(-velocityX * factor, -maxAngleDeg, maxAngleDeg);
}
