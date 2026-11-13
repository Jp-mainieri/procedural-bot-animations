/**
 * Ported verbatim from DevBerry's `lib/berry/motor.ts` and
 * `lib/berry/folhas.ts` (branch `feat/berry-simulador-mascote`).
 * Identifiers translated to English; every formula, constant and threshold
 * is unchanged from the original. See `berry-rig.js` for why this lives
 * here instead of in the installable package.
 */

// ---------- from motor.ts ----------

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Smoothstep between a and b: 0 before a, 1 after b, smooth in between. */
export function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Exponential damping toward target, frame-rate independent. */
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));

/* ---------- keyframe tracks ---------- */

export const CURVES = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  smooth: (t) => t * t * (3 - 2 * t),
};

/**
 * Piecewise-interpolates between keyframes `[t 0..1, value, curveName?]`.
 * Before the first keyframe it holds the first value; after the last, the
 * last. Each keyframe's curve applies up to the next one (default `smooth`).
 */
export function track(keyframes) {
  return (t) => {
    if (t <= keyframes[0][0]) return keyframes[0][1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      const [t0, v0, name = "smooth"] = keyframes[i];
      const [t1, v1] = keyframes[i + 1];
      if (t <= t1) return lerp(v0, v1, CURVES[name]((t - t0) / (t1 - t0 || 1)));
    }
    return keyframes[keyframes.length - 1][1];
  };
}

/** Combines several named keyframe tracks into one function returning `{ name: value }` each frame. */
export function fromTracks(tracks) {
  const fns = Object.entries(tracks).map(([k, kf]) => [k, track(kf)]);
  return (t) => {
    const out = {};
    for (const [k, f] of fns) out[k] = f(t);
    return out;
  };
}

/** Damped spring. `m = { a: value, v: velocity }`, mutated in place. */
export function spring(m, target, k, c, dt) {
  m.v += (k * (target - m.a) - c * m.v) * dt;
  m.a += m.v * dt;
}

const BLINK_DURATION_MS = 150;

export const newBlink = (now) => ({ active: false, t0: 0, remaining: 0, next: now + 1500 });

/**
 * Advances the blink and returns how shut the eye is (0 open, 1 shut).
 * Random interval 1.8-6s; 20% chance of a double blink.
 */
export function stepBlink(p, now, rng) {
  if (!p.active && now >= p.next) {
    p.active = true;
    p.t0 = now;
    p.remaining = rng() < 0.2 ? 2 : 1;
  }
  if (!p.active) return 0;
  const phase = (now - p.t0) / BLINK_DURATION_MS;
  if (phase >= 1) {
    p.remaining--;
    if (p.remaining > 0) p.t0 = now + 90;
    else {
      p.active = false;
      p.next = now + 1800 + rng() * 4200;
    }
    return 0;
  }
  return phase > 0 ? Math.sin(phase * Math.PI) : 0;
}

const GRAVITY = 5200;

export const atRest = (p) => p.y === 0 && p.vy === 0;

/** Starts a jump if grounded. Negative vy is up (drawing px/s). */
export function launch(p, vy = -1500) {
  if (atRest(p)) p.vy = vy;
}

/** Gravity, a short bounce (32% of impact velocity), and landing squash. Mutates `p` and `squash` in place. */
export function stepJump(p, squash, dt) {
  if (!atRest(p)) {
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= 0) {
      const impact = Math.abs(p.vy);
      p.y = 0;
      if (impact > 500) {
        p.vy = -impact * 0.32;
        squash.s = Math.min(0.16, impact / 9000);
        squash.v = 0;
      } else p.vy = 0;
    }
  }
  squash.v += (-320 * squash.s - 15 * squash.v) * dt;
  squash.s += squash.v * dt;
}

// ---------- from folhas.ts ----------

/** Axis from an appendage's pivot to its tip. */
export function axisOf(a) {
  const dx = a.tip.x - a.pivot.x;
  const dy = a.tip.y - a.pivot.y;
  const L = Math.hypot(dx, dy);
  return { pivot: a.pivot, dir: { x: dx / L, y: dy / L }, L };
}

const K_TIP = 190;
const C_TIP = 8;
/** How much the tip lags behind when the base rotates (dimensionless). */
const ROTATION_LAG = 0.55;
/** deg/s of tip impulse per px/s of change in the body's vertical velocity. */
const VERTICAL_LAG = 0.14;
const MAX_BEND = 38;

/**
 * One step of the tip spring. `dBaseVel` is this frame's change in the
 * base's angular velocity (deg/s); `dBodyVy`, the change in the body's
 * vertical velocity (px/s, negative = accelerated upward); `side` is which
 * way the leaf points (-1 left, 0 up, 1 right).
 */
export function stepTip(p, dBaseVel, dBodyVy, side, dt) {
  p.v -= dBaseVel * ROTATION_LAG;
  p.v += dBodyVy * VERTICAL_LAG * -side;
  p.v += (-K_TIP * p.a - C_TIP * p.v) * dt;
  p.a = clamp(p.a + p.v * dt, -MAX_BEND, MAX_BEND);
}

/** Parses an absolute path with M, L, C and Z (the rig's format). */
export function parsePath(d) {
  const out = [];
  const re = /([MLCZ])([^MLCZ]*)/gi;
  let m;
  while ((m = re.exec(d))) {
    const nums = m[2].match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    out.push({ c: m[1].toUpperCase(), pts: nums });
  }
  return out;
}

const fmt = (v) => (Math.round(v * 10) / 10).toString();

/**
 * Bends the path around the axis's pivot: a point at distance `t * L` from
 * the base (measured along the axis) rotates `bend * t^2` degrees. The base
 * itself (hidden inside the body) doesn't move.
 */
export function bendPath(cmds, axis, bendDeg) {
  const { pivot, dir, L } = axis;
  const rad = (bendDeg * Math.PI) / 180;
  return cmds
    .map(({ c, pts }) => {
      const next = [];
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i] - pivot.x;
        const y = pts[i + 1] - pivot.y;
        const t = clamp((x * dir.x + y * dir.y) / L, 0, 1.2);
        const a = rad * t * t;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        next.push(`${fmt(pivot.x + x * cos - y * sin)},${fmt(pivot.y + x * sin + y * cos)}`);
      }
      return next.length ? `${c}${next.join(" ")}` : c;
    })
    .join(" ");
}
