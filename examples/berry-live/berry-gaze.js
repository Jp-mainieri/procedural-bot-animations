/**
 * Ported verbatim from DevBerry's `lib/berry/olhar.ts` — a real-feeling eye:
 * it doesn't glide to the target. When the target jumps, the eye makes a
 * saccade (a fast hop that overshoots slightly and settles); when the target
 * moves slowly (the cursor), it pursues smoothly. At rest it microsaccades.
 * On top of that, two slow states:
 *
 * - attention (0..1): rises with big saccades, a fast target, something new,
 *   and the cursor getting close; widens the eyes and opens the lids.
 * - boredom (0..1): rises when nothing happens; the lids get heavy.
 *
 * Units: gaze is -1..1 on both axes (the caller converts to px).
 */
import { clamp, damp, smoothDamp } from "./berry-motor.js";

const K = 900;
const C = 2 * Math.sqrt(K) * 0.62; // underdamped: overshoots ~8% and settles
const SACCADE_THRESHOLD = 0.12;
const MIN_SACCADE_INTERVAL_MS = 220;
/** A fast-moving target: the eye pursues instead of hopping, unless it falls too far behind. */
const MAX_PURSUIT_LAG = 0.6;

export class Gaze {
  #pos = { x: 0, y: 0, vx: 0, vy: 0 };
  #goal = { x: 0, y: 0 };
  #prevTarget = null;
  #targetVel = 0;
  #lastSaccade = -Infinity;
  #nextMicro = 0;
  #attention = 0;
  #boredom = 0;
  #slide = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 } };
  #micro = { x: 0, y: 0 };

  /**
   * @param input {{ target: {x,y}, reducedMotion?: boolean, interest?: number, proximity?: number, glideSeconds?: number }}
   */
  step(input, now, dt, rng) {
    const { target } = input;
    let blink = false;

    if (this.#prevTarget && dt > 0) {
      const v = Math.hypot(target.x - this.#prevTarget.x, target.y - this.#prevTarget.y) / dt;
      this.#targetVel = damp(this.#targetVel, Math.min(v, 30), 8, dt);
    }
    this.#prevTarget = { ...target };

    if (input.reducedMotion || dt === 0) {
      const k = dt === 0 ? 1 : 1 - Math.exp(-6 * dt);
      this.#pos.x += (target.x - this.#pos.x) * k;
      this.#pos.y += (target.y - this.#pos.y) * k;
      this.#pos.vx = this.#pos.vy = 0;
      this.#goal = { ...target };
    } else if (input.glideSeconds && input.glideSeconds > 0) {
      const mx = smoothDamp(this.#slide.x, target.x, input.glideSeconds, dt);
      const my = smoothDamp(this.#slide.y, target.y, input.glideSeconds, dt);
      const arrived = Math.hypot(target.x - mx, target.y - my) < 0.03;
      if (now > this.#nextMicro) {
        this.#nextMicro = now + 500 + rng() * 1100;
        this.#micro = arrived ? { x: (rng() - 0.5) * 0.04, y: (rng() - 0.5) * 0.034 } : { x: 0, y: 0 };
      }
      if (!arrived) this.#micro = { x: 0, y: 0 };
      this.#goal.x = mx + this.#micro.x;
      this.#goal.y = my + this.#micro.y;
      this.#spring(dt);
    } else {
      const dx = target.x - this.#goal.x;
      const dy = target.y - this.#goal.y;
      const dist = Math.hypot(dx, dy);
      const recent = now - this.#lastSaccade <= MIN_SACCADE_INTERVAL_MS;
      if (this.#targetVel >= 3 && dist < MAX_PURSUIT_LAG) {
        this.#goal.x = damp(this.#goal.x, target.x, 14, dt);
        this.#goal.y = damp(this.#goal.y, target.y, 14, dt);
      } else if (this.#targetVel < 3 && dist < 0.35 && !recent) {
        this.#goal.x = damp(this.#goal.x, target.x, 10, dt);
        this.#goal.y = damp(this.#goal.y, target.y, 10, dt);
      } else if (dist > SACCADE_THRESHOLD && now - this.#lastSaccade > MIN_SACCADE_INTERVAL_MS) {
        // Aim a bit short — the real eye corrects afterward.
        this.#goal.x = target.x - dx * 0.06;
        this.#goal.y = target.y - dy * 0.06;
        this.#lastSaccade = now;
        this.#attention = Math.min(1, this.#attention + Math.min(0.45, dist * 0.35));
        this.#boredom = 0;
        if (dist > 0.9 && rng() < 0.35) blink = true;
      }
      if (now > this.#nextMicro) {
        this.#nextMicro = now + 500 + rng() * 1100;
        if (now - this.#lastSaccade > 400) {
          this.#goal.x += (rng() - 0.5) * 0.04;
          this.#goal.y += (rng() - 0.5) * 0.034;
        }
      }
      this.#spring(dt);
    }

    if (!(input.glideSeconds && input.glideSeconds > 0)) {
      this.#slide.x.x = this.#goal.x;
      this.#slide.y.x = this.#goal.y;
      this.#slide.x.v = this.#slide.y.v = 0;
      this.#micro = { x: 0, y: 0 };
    }

    const interest = input.interest ?? 0;
    const proximity = input.proximity ?? 0;
    this.#attention = clamp(
      this.#attention + interest + (input.glideSeconds ? 0 : clamp(this.#targetVel / 10, 0, 1) * dt * 1.6),
      0,
      1,
    );
    this.#attention = damp(this.#attention, proximity * 0.6, 1.3, dt);

    const calm = this.#targetVel < 0.05 && now - this.#lastSaccade > 3000 && this.#attention < 0.25;
    this.#boredom = calm
      ? Math.min(1, this.#boredom + dt / 7)
      : damp(this.#boredom, 0, this.#attention > 0.3 ? 6 : 1.5, dt);

    const convergence = clamp((proximity - 0.75) / 0.25, 0, 1);
    return this.#output(convergence, blink);
  }

  #spring(dt) {
    const p = this.#pos;
    p.vx += (K * (this.#goal.x - p.x) - C * p.vx) * dt;
    p.vy += (K * (this.#goal.y - p.y) - C * p.vy) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  #output(convergence, blink) {
    return {
      x: this.#pos.x,
      y: this.#pos.y,
      vx: this.#pos.vx,
      vy: this.#pos.vy,
      attention: this.#attention,
      boredom: this.#boredom,
      convergence: convergence * convergence * (3 - 2 * convergence),
      blink,
    };
  }
}
