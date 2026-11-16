import { type Spring, clamp, substep } from "./motion.js";
import type { Appendage, Point } from "./rig.js";

/*
 * Bending appendages, in the spirit of Rain World: each appendage is a chain
 * of two links. The base link rotates as before (a stiff spring attached to
 * the body); the tip link has its own, softer spring, and lags behind when the
 * base or the body accelerates. When drawing, each point of the path rotates
 * around the base by an angle that grows with the distance to the tip, which
 * curves the appendage.
 */

export type Axis = { pivot: Point; dir: Point; L: number };

/** Axis from the base to the tip of a rig appendage. */
export function axisOf(a: Pick<Appendage, "pivot" | "tip">): Axis {
  const dx = a.tip.x - a.pivot.x;
  const dy = a.tip.y - a.pivot.y;
  const L = Math.hypot(dx, dy);
  return { pivot: a.pivot, dir: { x: dx / L, y: dy / L }, L };
}

/* ---------- tip physics ---------- */

const K_TIP = 190;
const C_TIP = 8;
/** How much the tip lags behind when the base rotates (dimensionless). */
const ROTATION_LAG = 0.55;
/** Degrees/s of impulse on the tip per px/s of change in the body's vertical velocity. */
const VERTICAL_LAG = 0.14;
const MAX_BEND = 38;

/**
 * One step of the tip spring. `dBaseVel` is the change in the base's angular
 * velocity this frame (degrees/s); `dBodyVy`, the change in the body's
 * vertical velocity (px/s, negative = accelerated upward); `side` says where
 * the appendage points (−1 left, 0 up, 1 right).
 */
export function stepTip(p: Spring, dBaseVel: number, dBodyVy: number, side: -1 | 0 | 1, dt: number) {
  // Inertia: the tip "stays" where it was, so it rotates opposite to the base.
  p.v -= dBaseVel * ROTATION_LAG;
  // Body accelerated upward: the side tips stay down (and vice versa).
  // On the left, positive raises; on the right, negative raises. The middle
  // one points up and does not feel vertical acceleration as torque.
  p.v += dBodyVy * VERTICAL_LAG * -side;
  substep(dt, (h) => {
    p.v += (-K_TIP * p.a - C_TIP * p.v) * h;
    p.a = clamp(p.a + p.v * h, -MAX_BEND, MAX_BEND);
  });
}

/* ---------- path deformation ---------- */

export type PathCommand = { c: string; pts: number[] };

/** Reads an absolute path with M, L, C and Z (the rig's format). */
export function parsePath(d: string): PathCommand[] {
  const out: PathCommand[] = [];
  const re = /([MLCZ])([^MLCZ]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = m[2].match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    out.push({ c: m[1].toUpperCase(), pts: nums });
  }
  return out;
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/**
 * Curves the path around the axis pivot: a point at a distance `t·L` from the
 * base (measured along the axis) rotates `bend·t²` degrees. The base, which is
 * hidden inside the body, does not move.
 */
export function bendPath(cmds: readonly PathCommand[], axis: Axis, bend: number): string {
  const { pivot, dir, L } = axis;
  const rad = (bend * Math.PI) / 180;
  return cmds
    .map(({ c, pts }) => {
      const out: string[] = [];
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i] - pivot.x;
        const y = pts[i + 1] - pivot.y;
        const t = clamp((x * dir.x + y * dir.y) / L, 0, 1.2);
        const a = rad * t * t;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        out.push(`${fmt(pivot.x + x * cos - y * sin)},${fmt(pivot.y + x * sin + y * cos)}`);
      }
      return out.length ? `${c}${out.join(" ")}` : c;
    })
    .join(" ");
}

/* ---------- round body (transformations) ---------- */

/**
 * A circle with the same commands as the path (M, n × C, Z), with the end
 * points at the same angles around `c`. Interpolating point by point between
 * the two takes the silhouette to the circle without twisting.
 */
export function circleLike(cmds: readonly PathCommand[], c: Point, R: number): PathCommand[] {
  const ends: Point[] = [];
  for (const { pts } of cmds)
    if (pts.length >= 2) ends.push({ x: pts[pts.length - 2], y: pts[pts.length - 1] });
  // Angles of the end points, unwrapped so they always run the same way round.
  const angs = ends.map((p) => Math.atan2(p.y - c.y, p.x - c.x));
  const direction = Math.sign(
    ends.reduce((acc, p, i) => {
      const q = ends[(i + 1) % ends.length];
      return acc + (p.x - c.x) * (q.y - c.y) - (p.y - c.y) * (q.x - c.x);
    }, 0),
  );
  for (let i = 1; i < angs.length; i++) {
    while (direction * (angs[i] - angs[i - 1]) < 0) angs[i] += direction * 2 * Math.PI;
  }
  const point = (a: number) => [c.x + R * Math.cos(a), c.y + R * Math.sin(a)];
  let j = 0;
  return cmds.map(({ c: k }) => {
    if (k === "M") return { c: k, pts: point(angs[j++]) };
    if (k === "C") {
      const a0 = angs[j - 1];
      const a1 = angs[j++];
      const kappa = (4 / 3) * Math.tan((a1 - a0) / 4) * R;
      const [x0, y0] = point(a0);
      const [x1, y1] = point(a1);
      return {
        c: k,
        pts: [
          x0 - kappa * Math.sin(a0),
          y0 + kappa * Math.cos(a0),
          x1 + kappa * Math.sin(a1),
          y1 - kappa * Math.cos(a1),
          x1,
          y1,
        ],
      };
    }
    if (k === "L") return { c: k, pts: point(angs[j++]) };
    return { c: k, pts: [] };
  });
}

/** Path between `a` and `b` (same commands), at `t` from 0 to 1. */
export function mixPath(a: readonly PathCommand[], b: readonly PathCommand[], t: number): string {
  return a
    .map(({ c, pts }, i) => {
      const q = b[i].pts;
      const nums: string[] = [];
      for (let k = 0; k < pts.length; k += 2)
        nums.push(
          `${fmt(pts[k] + (q[k] - pts[k]) * t)},${fmt(pts[k + 1] + (q[k + 1] - pts[k + 1]) * t)}`,
        );
      return nums.length ? `${c}${nums.join(" ")}` : c;
    })
    .join(" ");
}
