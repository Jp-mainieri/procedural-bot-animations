import { chance, mulberry32, randRange, type Rng } from "./rng.js";

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
 * Schedules blinks and reports how shut the eyes should be (0 open, 1 shut)
 * at the current time. Since this engine renders its own eyes instead of
 * going through Open Bot Avatar's runtime (which blinks on its own),
 * driving the blink is this package's job now.
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

  /** Call every frame with the running clock `t` (seconds). Returns shut-ness, 0 (open) to 1 (shut). */
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
      } else if (chance(rng, doubleChance)) {
        this.pendingSecondBlink = true;
        this.nextAt = t + durationSeconds * 1.6;
      } else {
        this.nextAt = t + randRange(rng, ...intervalSeconds);
      }
    }

    if (this.closedUntil < 0) return 0;
    const remaining = this.closedUntil - t;
    const half = durationSeconds / 2;
    return remaining > half ? 1 - (remaining - half) / half : remaining / half;
  }
}
