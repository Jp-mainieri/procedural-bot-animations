import { type Rng, clamp, damp, newDamped, smoothDamp, substep } from "./motion.js";

/*
 * A lively gaze, like a real eye: it doesn't glide to the target. When the
 * target jumps, the eye makes a saccade (a fast hop that overshoots a little
 * and settles); when the target moves slowly (the cursor), the eye pursues it
 * smoothly. At rest, it makes microsaccades. On top of that, two slow states:
 *
 * - attention (0 to 1): rises with big saccades, a fast target, something new
 *   on the page and the cursor coming close; the eyes grow and the lids open.
 * - boredom (0 to 1): rises when nothing happens; the lids get heavy.
 *
 * Units: the gaze goes from −1 to 1 on both axes (the brain converts to px).
 */

export type GazeInput = {
  /** Target from −1 to 1. */
  target: { x: number; y: number };
  reduced: boolean;
  /** Something new caught the attention this frame (0 to 1). */
  interest: number;
  /** How close the cursor is to the character (0 far, 1 right on top). */
  proximity: number;
  /**
   * Seconds to glide to the target (the eye wandering across the page,
   * returning to an anchor). 0 or absent: a saccade, the usual fast hop.
   */
  glide?: number;
};

export type GazeOutput = {
  x: number;
  y: number;
  /** Gaze velocity (units/s): deforms and tilts the eyes. */
  vx: number;
  vy: number;
  attention: number;
  boredom: number;
  /** Eyes move closer together (cute cross-eyed look) with the cursor right on top. */
  convergence: number;
  /** Asks for a blink (goes with big saccades, as in the human eye). */
  blink: boolean;
};

const K = 900;
const C = 2 * Math.sqrt(K) * 0.62; // slightly underdamped: overshoots ~8% and comes back
/** Distance from which the eye hops instead of pursuing. */
const SACCADE_THRESHOLD = 0.12;
const MIN_SACCADE_INTERVAL = 220;
/** Fast cursor: the eye pursues instead of hopping, unless it falls far behind. */
const MAX_PURSUIT_LAG = 0.6;

export class Gaze {
  private pos = { x: 0, y: 0, vx: 0, vy: 0 };
  /** Where the eye is heading (the saccade aims here). */
  private goal = { x: 0, y: 0 };
  private prevTarget: { x: number; y: number } | null = null;
  private targetVel = 0;
  private lastSaccade = -Infinity;
  private nextMicro = 0;
  private attention = 0;
  private boredom = 0;
  /** Gliding goal (a spring with no jerk) and the microsaccade added to it. */
  private slide = { x: newDamped(), y: newDamped() };
  private micro = { x: 0, y: 0 };

  step(input: GazeInput, now: number, dt: number, rng: Rng): GazeOutput {
    const { target } = input;
    let blink = false;

    // Target velocity (smoothed): a fast cursor draws attention.
    if (this.prevTarget && dt > 0) {
      const v = Math.hypot(target.x - this.prevTarget.x, target.y - this.prevTarget.y) / dt;
      this.targetVel = damp(this.targetVel, Math.min(v, 30), 8, dt);
    }
    this.prevTarget = { ...target };

    if (input.reduced || dt === 0) {
      // No saccades or springs: the gaze just follows.
      const k = dt === 0 ? 1 : 1 - Math.exp(-6 * dt);
      this.pos.x += (target.x - this.pos.x) * k;
      this.pos.y += (target.y - this.pos.y) * k;
      this.pos.vx = this.pos.vy = 0;
      this.goal = { ...target };
    } else if (input.glide && input.glide > 0) {
      // Gliding: the goal moves along a smooth curve (starts and arrives
      // slowly), with no saccades on the way. On arrival, microsaccades return.
      const mx = smoothDamp(this.slide.x, target.x, input.glide, dt);
      const my = smoothDamp(this.slide.y, target.y, input.glide, dt);
      const arrived = Math.hypot(target.x - mx, target.y - my) < 0.03;
      if (now > this.nextMicro) {
        this.nextMicro = now + 500 + rng() * 1100;
        this.micro = arrived
          ? { x: (rng() - 0.5) * 0.04, y: (rng() - 0.5) * 0.034 }
          : { x: 0, y: 0 };
      }
      if (!arrived) this.micro = { x: 0, y: 0 };
      this.goal.x = mx + this.micro.x;
      this.goal.y = my + this.micro.y;
      this.eyeSpring(dt);
    } else {
      const dx = target.x - this.goal.x;
      const dy = target.y - this.goal.y;
      const dist = Math.hypot(dx, dy);
      const recent = now - this.lastSaccade <= MIN_SACCADE_INTERVAL;
      if (this.targetVel >= 3 && dist < MAX_PURSUIT_LAG) {
        // Fast cursor: pursues firmly, with no chain of saccades (that was what shook).
        this.goal.x = damp(this.goal.x, target.x, 14, dt);
        this.goal.y = damp(this.goal.y, target.y, 14, dt);
      } else if (this.targetVel < 3 && dist < 0.35 && !recent) {
        // Smooth pursuit (the cursor moving slowly).
        this.goal.x = damp(this.goal.x, target.x, 10, dt);
        this.goal.y = damp(this.goal.y, target.y, 10, dt);
      } else if (dist > SACCADE_THRESHOLD && now - this.lastSaccade > MIN_SACCADE_INTERVAL) {
        // Saccade: aims a little short (the human eye corrects afterwards).
        this.goal.x = target.x - dx * 0.06;
        this.goal.y = target.y - dy * 0.06;
        this.lastSaccade = now;
        this.attention = Math.min(1, this.attention + Math.min(0.45, dist * 0.35));
        this.boredom = 0;
        if (dist > 0.9 && rng() < 0.35) blink = true;
      }
      // Microsaccades: at rest, the eye is never 100% still.
      if (now > this.nextMicro) {
        this.nextMicro = now + 500 + rng() * 1100;
        if (now - this.lastSaccade > 400) {
          this.goal.x += (rng() - 0.5) * 0.04;
          this.goal.y += (rng() - 0.5) * 0.034;
        }
      }
      this.eyeSpring(dt);
    }
    if (!(input.glide && input.glide > 0)) {
      // Outside a glide, the gliding goal follows along (with no velocity): the
      // next glide starts from where the eye is.
      this.slide.x.x = this.goal.x;
      this.slide.y.x = this.goal.y;
      this.slide.x.v = this.slide.y.v = 0;
      this.micro = { x: 0, y: 0 };
    }

    // Attention: impulses, a fast cursor and a close cursor; decays slowly.
    this.attention = clamp(
      this.attention + input.interest + (input.glide ? 0 : clamp(this.targetVel / 10, 0, 1) * dt * 1.6),
      0,
      1,
    );
    this.attention = damp(this.attention, input.proximity * 0.6, 1.3, dt);

    // Boredom: grows when nothing moves; anything new gradually zeroes it.
    const calm = this.targetVel < 0.05 && now - this.lastSaccade > 3000 && this.attention < 0.25;
    this.boredom = calm
      ? Math.min(1, this.boredom + dt / 7)
      : damp(this.boredom, 0, this.attention > 0.3 ? 6 : 1.5, dt);

    const convergence = clamp((input.proximity - 0.75) / 0.25, 0, 1);
    return this.output(convergence, blink);
  }

  private eyeSpring(dt: number) {
    const p = this.pos;
    // K = 900 is the stiffest spring in the engine: explicit Euler diverges above ~38 ms.
    substep(dt, (h) => {
      p.vx += (K * (this.goal.x - p.x) - C * p.vx) * h;
      p.vy += (K * (this.goal.y - p.y) - C * p.vy) * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
    });
  }

  private output(convergence: number, blink: boolean): GazeOutput {
    return {
      x: this.pos.x,
      y: this.pos.y,
      vx: this.pos.vx,
      vy: this.pos.vy,
      attention: this.attention,
      boredom: this.boredom,
      convergence: convergence * convergence * (3 - 2 * convergence),
      blink,
    };
  }
}
