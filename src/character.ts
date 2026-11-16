/*
 * Character definitions: plain JSON that describes a silhouette, two eyes and
 * (optionally) a few moving parts, compiled into the engine's `Rig`.
 *
 * The base of the format (`version`, `id`, `name`, `body`, `eyes`) is the
 * Open Bot Avatar definition, accepted unchanged. The optional `rig` key is
 * this engine's extension.
 *
 * The path grammar, the arc handling and the point-in-outline test are adapted
 * from open-bot-avatar (MIT, Copyright (c) Dominik Scholz,
 * https://github.com/dominikscholz/open-bot-avatar). No code is imported.
 */

import { RIG_BERRY } from "./characters/berry.js";
import type { PathCommand } from "./parts.js";
import type { Appendage, EyeShape, EyeStyle, Rig, Role } from "./rig.js";

/* ---------- public types ---------- */

export interface CharacterDefinition {
  version: 1;
  /** Lowercase slug, 1 to 40 chars: `[a-z0-9-]`, starting with a letter or digit. */
  id: string;
  name: string;
  /** Outline in a 0..100 box. */
  body: { path: string };
  eyes: { x: number; y: number; spacing: number; scale: number };
  /** Optional extension (ignored by Open Bot Avatar itself). All coordinates in the same 0..100 box. */
  rig?: {
    parts?: Array<{
      role: "C" | "L" | "R";
      path: string;
      pivot: [number, number];
      tip: [number, number];
    }>;
    /** w/h/dx/dy in 0..100 units, tilt in degrees. */
    eyeStyles?: Partial<Record<EyeStyle, Partial<EyeShape>>>;
    /** Part sway multipliers, default 1/1. */
    idle?: { amp?: number; freq?: number };
    /** 0..1, default 0. */
    flicker?: number;
    /** Suggested body colour (#rgb or #rrggbb), informational. */
    color?: string;
  };
}

export type ValidationResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: string[] };

/** Scale from the 0..100 box to the engine's drawing space (Flame was made with the same 9.5). */
export const CHARACTER_SCALE = 9.5;

/** Where the character stands in engine space: ground line and horizontal centre of every rig. */
const GROUND = { x: 627, y: 960 } as const;

/* ---------- limits ---------- */

export const CHARACTER_LIMITS = {
  pathChars: 6000,
  pathSegments: 400,
  pathSubpaths: 16,
  coordMin: -20,
  coordMax: 120,
  /** Hard limits for the body bounding box (error). */
  bodyHardMin: 6,
  bodyHardMax: 94,
  /** Soft limits (warning). */
  bodySoftMin: 8,
  bodySoftMax: 92,
  bodyMinSize: 30,
  eyeScale: [0.4, 3],
  eyeSpacing: [4, 60],
  eyeMargin: 0.8,
  nameMax: 60,
  pivotSlack: 3,
  minPartLength: 4,
} as const;

/**
 * Classic eye at scale 1, in the 0..100 box. The height is Open Bot Avatar's (11); the width is NOT:
 * Open Bot Avatar draws a 4-wide pill, which is too thin for the eyelid and happy-arc expressions to read.
 * This engine deliberately draws Berry's ratio instead, width = height / 2 (5.5). Open Bot Avatar's own
 * 4-wide pill is kept (EYE_W_OBA) only to decide whether a definition that was valid there stays accepted.
 */
const EYE_H = 11;
const EYE_W = EYE_H / 2;
const EYE_W_OBA = 4;
/** Eyes must not overlap: spacing >= EYE_W * scale * (1 + EYE_GAP), i.e. 6.05 * scale (a 10 % gap). */
const EYE_GAP = 0.1;
/** Classic eye height below this share of the body height is flagged as small; 26 % is the suggested target. */
const EYE_SMALL_RATIO = 0.18;
const EYE_TARGET_RATIO = 0.26;

/* ======================================================================== */
/* Path handling                                                             */
/* ======================================================================== */

export class PathError extends Error {}

const ARG_COUNT: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const NUMBER_RE = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

type Scanner = { d: string; i: number };

function skipSep(s: Scanner) {
  while (s.i < s.d.length && /[\s,]/.test(s.d[s.i])) s.i++;
}

function readNumber(s: Scanner): number | null {
  skipSep(s);
  NUMBER_RE.lastIndex = s.i;
  const m = NUMBER_RE.exec(s.d);
  if (!m) return null;
  s.i = NUMBER_RE.lastIndex;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

/** Arc flags may be written glued together ("a1 1 0 01 5 5"): read exactly one digit. */
function readFlag(s: Scanner): number | null {
  skipSep(s);
  const ch = s.d[s.i];
  if (ch === "0" || ch === "1") {
    s.i++;
    return Number(ch);
  }
  return null;
}

const cubicFromQuad = (x0: number, y0: number, qx: number, qy: number, x: number, y: number): number[] => [
  x0 + (2 / 3) * (qx - x0),
  y0 + (2 / 3) * (qy - y0),
  x + (2 / 3) * (qx - x),
  y + (2 / 3) * (qy - y),
  x,
  y,
];

/**
 * SVG endpoint arc to cubic segments (SVG 1.1 implementation notes F.6.5,
 * then the standard `4/3·tan(δ/4)` handle length), at most 90° per segment.
 */
function arcToCubics(
  x0: number,
  y0: number,
  rxIn: number,
  ryIn: number,
  rotDeg: number,
  large: number,
  sweep: number,
  x: number,
  y: number,
): number[][] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [[x0, y0, x, y, x, y]]; // straight line, as a cubic
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const k = Math.sqrt(lambda);
    rx *= k;
    ry *= k;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;

  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const delta = dt / n;
  const k = (4 / 3) * Math.tan(delta / 4);
  const point = (t: number): [number, number] => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const deriv = (t: number): [number, number] => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const out: number[][] = [];
  for (let s = 0; s < n; s++) {
    const a = t1 + delta * s;
    const b = a + delta;
    const [pax, pay] = point(a);
    const [pbx, pby] = point(b);
    const [dax, day] = deriv(a);
    const [dbx, dby] = deriv(b);
    // The last segment ends exactly on the requested end point.
    const ex = s === n - 1 ? x : pbx;
    const ey = s === n - 1 ? y : pby;
    out.push([pax + k * dax, pay + k * day, ex - k * dbx, ey - k * dby, ex, ey]);
  }
  return out;
}

/**
 * Parses the full SVG path grammar (M L H V C S Q T A Z, absolute and
 * relative, implicit repeats, several subpaths) into ABSOLUTE commands using
 * only M, L, C and Z: the format `parsePath` / `bendPath` / `mixPath` read.
 * Q, T and S become exact cubics; arcs become cubic segments of at most 90°.
 * `segments` is the number of commands in the source (for the limits).
 * With `closeOpen`, unclosed subpaths get a `Z` and `closed` lists their (1-based) numbers.
 * Throws `PathError` on malformed input.
 */
export function normalizeWithStats(d: string, closeOpen = false): { cmds: PathCommand[]; segments: number; closed: number[] } {
  if (typeof d !== "string" || d.trim() === "") throw new PathError("path is empty");
  const bad = d.match(/[^MmLlHhVvCcSsQqTtAaZz0-9.,eE+\-\s]/);
  if (bad) throw new PathError(`unsupported character ${JSON.stringify(bad[0])} (allowed commands: M L H V C S Q T A Z)`);

  const s: Scanner = { d, i: 0 };
  const out: PathCommand[] = [];
  let segments = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prevC: [number, number] | null = null;
  let prevQ: [number, number] | null = null;
  let cmd = "";
  let open = false; // a subpath is being drawn (M seen, no Z yet)
  let first = true;
  const closed: number[] = []; // 1-based numbers of the subpaths that were closed automatically
  const autoClose = () => {
    out.push({ c: "Z", pts: [] });
    closed.push(out.filter((c) => c.c === "M").length);
    open = false;
  };

  for (;;) {
    skipSep(s);
    if (s.i >= d.length) break;
    const ch = d[s.i];
    if (/[A-Za-z]/.test(ch)) {
      cmd = ch;
      s.i++;
      if (cmd === "Z" || cmd === "z") {
        if (!open) throw new PathError("Z without an open subpath");
        out.push({ c: "Z", pts: [] });
        segments++;
        cx = sx;
        cy = sy;
        prevC = prevQ = null;
        open = false;
        continue;
      }
    } else if (!cmd) throw new PathError("path must start with M");
    else if (cmd === "Z" || cmd === "z") throw new PathError("numbers after Z");
    else if (!/[0-9.+-]/.test(ch)) throw new PathError(`cannot parse path near ${JSON.stringify(d.slice(s.i, s.i + 12))}`);

    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (first && up !== "M") throw new PathError("path must start with M");
    first = false;
    const n = ARG_COUNT[up];
    if (n === undefined) throw new PathError(`unsupported command ${cmd}`);
    const args: number[] = [];
    for (let k = 0; k < n; k++) {
      const v = up === "A" && (k === 3 || k === 4) ? readFlag(s) : readNumber(s);
      if (v === null) throw new PathError(`command ${cmd} expects ${n} numbers`);
      args.push(v);
    }
    segments++;
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;

    // A drawing command after Z (without a new M) starts a subpath at the previous start point.
    if (!open && up !== "M") {
      out.push({ c: "M", pts: [cx, cy] });
      sx = cx;
      sy = cy;
      open = true;
    }

    let nextC: [number, number] | null = null;
    let nextQ: [number, number] | null = null;
    switch (up) {
      case "M":
        if (open && closeOpen) autoClose();
        cx = args[0] + ox;
        cy = args[1] + oy;
        sx = cx;
        sy = cy;
        out.push({ c: "M", pts: [cx, cy] });
        open = true;
        cmd = rel ? "l" : "L"; // extra pairs are implicit lineto
        break;
      case "L":
        cx = args[0] + ox;
        cy = args[1] + oy;
        out.push({ c: "L", pts: [cx, cy] });
        break;
      case "H":
        cx = args[0] + ox;
        out.push({ c: "L", pts: [cx, cy] });
        break;
      case "V":
        cy = args[0] + oy;
        out.push({ c: "L", pts: [cx, cy] });
        break;
      case "C": {
        const p = [args[0] + ox, args[1] + oy, args[2] + ox, args[3] + oy, args[4] + ox, args[5] + oy];
        out.push({ c: "C", pts: p });
        nextC = [p[2], p[3]];
        cx = p[4];
        cy = p[5];
        break;
      }
      case "S": {
        const x1: number = prevC ? 2 * cx - prevC[0] : cx;
        const y1: number = prevC ? 2 * cy - prevC[1] : cy;
        const p: number[] = [x1, y1, args[0] + ox, args[1] + oy, args[2] + ox, args[3] + oy];
        out.push({ c: "C", pts: p });
        nextC = [p[2], p[3]];
        cx = p[4];
        cy = p[5];
        break;
      }
      case "Q": {
        const qx = args[0] + ox;
        const qy = args[1] + oy;
        const x = args[2] + ox;
        const y = args[3] + oy;
        out.push({ c: "C", pts: cubicFromQuad(cx, cy, qx, qy, x, y) });
        nextQ = [qx, qy];
        cx = x;
        cy = y;
        break;
      }
      case "T": {
        const qx: number = prevQ ? 2 * cx - prevQ[0] : cx;
        const qy: number = prevQ ? 2 * cy - prevQ[1] : cy;
        const x = args[0] + ox;
        const y = args[1] + oy;
        out.push({ c: "C", pts: cubicFromQuad(cx, cy, qx, qy, x, y) });
        nextQ = [qx, qy];
        cx = x;
        cy = y;
        break;
      }
      case "A": {
        const [rx, ry, rot, large, sweep] = args;
        const x = args[5] + ox;
        const y = args[6] + oy;
        if (rx < 0 || ry < 0) throw new PathError("arc radii must be non-negative");
        if (x !== cx || y !== cy) {
          if (rx === 0 || ry === 0) out.push({ c: "L", pts: [x, y] });
          else for (const p of arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y)) out.push({ c: "C", pts: p });
        }
        cx = x;
        cy = y;
        break;
      }
    }
    prevC = nextC;
    prevQ = nextQ;
    if (segments > CHARACTER_LIMITS.pathSegments * 4) throw new PathError("path is far too long");
  }
  if (out.length === 0) throw new PathError("path is empty");
  if (open && closeOpen) autoClose();
  return { cmds: out, segments, closed };
}

/** Absolute M/L/C/Z commands for any SVG path (see `normalizeWithStats`). */
export function normalizePath(d: string, closeOpen = false): PathCommand[] {
  return normalizeWithStats(d, closeOpen).cmds;
}

const r2 = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** Writes commands back as `M x,y C x,y x,y x,y L x,y Z` (no exponents: `parsePath` cannot read them). */
export function serializePath(cmds: readonly PathCommand[]): string {
  return cmds
    .map(({ c, pts }) => {
      const pairs: string[] = [];
      for (let i = 0; i < pts.length; i += 2) pairs.push(`${r2(pts[i]).toFixed(2).replace(/\.?0+$/, "")},${r2(pts[i + 1]).toFixed(2).replace(/\.?0+$/, "")}`);
      return pairs.length ? `${c}${pairs.join(" ")}` : c;
    })
    .join(" ");
}

export type Poly = Array<[number, number]>;

/** Flattens into one polygon per subpath (cubics sampled within 0.02 units of the curve). */
export function flattenPath(cmds: readonly PathCommand[]): Poly[] {
  const polys: Poly[] = [];
  let cur: Poly = [];
  let px = 0;
  let py = 0;
  for (const { c, pts } of cmds) {
    if (c === "M") {
      if (cur.length) polys.push(cur);
      cur = [[pts[0], pts[1]]];
      px = pts[0];
      py = pts[1];
    } else if (c === "L") {
      cur.push([pts[0], pts[1]]);
      px = pts[0];
      py = pts[1];
    } else if (c === "C") {
      const [x1, y1, x2, y2, x, y] = pts;
      const m = Math.max(Math.hypot(px - 2 * x1 + x2, py - 2 * y1 + y2), Math.hypot(x1 - 2 * x2 + x, y1 - 2 * y2 + y));
      const n = Math.min(128, Math.max(2, Math.ceil(Math.sqrt((0.75 * m) / 0.02))));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        cur.push([
          u * u * u * px + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * py + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ]);
      }
      px = x;
      py = y;
    } else if (c === "Z") {
      if (cur.length) {
        polys.push(cur);
        px = cur[0][0];
        py = cur[0][1];
      }
      cur = [];
    }
  }
  if (cur.length) polys.push(cur);
  return polys.filter((p) => p.length >= 3);
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function polyBounds(polys: readonly Poly[]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of polys)
    for (const [x, y] of p) {
      if (x < b.minX) b.minX = x;
      if (y < b.minY) b.minY = y;
      if (x > b.maxX) b.maxX = x;
      if (y > b.maxY) b.maxY = y;
    }
  return b;
}

/** Non-zero winding test (the SVG default fill rule). */
function inside(polys: readonly Poly[], x: number, y: number): boolean {
  let w = 0;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yj <= y) {
        if (yi > y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) > 0) w++;
      } else if (yi <= y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) < 0) w--;
    }
  }
  return w !== 0;
}

/** Points on the outline of a pill (`w × h`, centred on `cx, cy`) grown by `margin`, plus its centre. */
function pillRing(cx: number, cy: number, w: number, h: number, margin: number): Array<[number, number]> {
  const hw = w / 2 + margin;
  const hh = h / 2 + margin;
  const straight = Math.max(0, hh - hw);
  const pts: Array<[number, number]> = [[cx, cy]];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * hw, cy + Math.sin(a) * hw + Math.sign(Math.sin(a)) * straight]);
  }
  for (const f of [-1, -0.5, 0, 0.5, 1]) pts.push([cx - hw, cy + f * straight], [cx + hw, cy + f * straight]);
  return pts;
}

/* ======================================================================== */
/* Validation                                                                */
/* ======================================================================== */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const r1 = (n: number) => Math.round(n * 10) / 10;

const TOP_KEYS = ["version", "id", "name", "body", "eyes", "rig"];
const BODY_KEYS = ["path"];
const EYE_KEYS = ["x", "y", "spacing", "scale"];
const RIG_KEYS = ["parts", "eyeStyles", "idle", "flicker", "color"];
const PART_KEYS = ["role", "path", "pivot", "tip"];
const EYE_STYLE_NAMES: EyeStyle[] = ["classic", "pumpy", "big"];
const EYE_SHAPE_KEYS = ["w", "h", "tilt", "dx", "dy"];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Allowed ranges of the `rig.eyeStyles` overrides (0..100 units; tilt in degrees). */
const EYE_SHAPE_RANGE: Record<keyof EyeShape, [number, number]> = {
  w: [0.5, 40],
  h: [0.5, 60],
  tilt: [-45, 45],
  dx: [-20, 20],
  dy: [-20, 20],
};

type CheckedPath = { cmds: PathCommand[]; polys: Poly[]; bounds: Bounds };

/** Parses and checks a path (limits, coordinate range, unclosed subpaths get closed with a warning). Pushes errors, returns null on failure. */
function checkPath(
  label: string,
  d: unknown,
  errors: string[],
  warnings: string[],
  limits: { subpaths: number },
): CheckedPath | null {
  if (typeof d !== "string") {
    errors.push(`${label}: must be a string with an SVG path`);
    return null;
  }
  if (d.length > CHARACTER_LIMITS.pathChars) {
    errors.push(`${label}: longer than ${CHARACTER_LIMITS.pathChars} characters`);
    return null;
  }
  let parsed: { cmds: PathCommand[]; segments: number; closed: number[] };
  try {
    parsed = normalizeWithStats(d, true);
  } catch (err) {
    if (err instanceof PathError) {
      errors.push(`${label}: ${err.message}`);
      return null;
    }
    throw err;
  }
  const before = errors.length;
  if (parsed.segments > CHARACTER_LIMITS.pathSegments)
    errors.push(`${label}: ${parsed.segments} segments, the limit is ${CHARACTER_LIMITS.pathSegments}`);
  const subpaths = parsed.cmds.filter((c) => c.c === "M").length;
  if (subpaths > limits.subpaths) errors.push(`${label}: ${subpaths} subpaths, the limit is ${limits.subpaths}`);
  // Open Bot Avatar closes unclosed subpaths implicitly; so do we (the normaliser already did), with a warning.
  for (const n of parsed.closed) warnings.push(`${label}: subpath ${n} is not closed; closed automatically`);
  const bad = parsed.cmds.some((c) => c.pts.some((v) => v < CHARACTER_LIMITS.coordMin || v > CHARACTER_LIMITS.coordMax));
  if (bad) errors.push(`${label}: coordinates must stay within ${CHARACTER_LIMITS.coordMin}..${CHARACTER_LIMITS.coordMax}`);
  if (errors.length > before) return null;
  const polys = flattenPath(parsed.cmds);
  if (!polys.length) {
    errors.push(`${label}: the path draws no area`);
    return null;
  }
  return { cmds: parsed.cmds, polys, bounds: polyBounds(polys) };
}

function warnUnknown(obj: Record<string, unknown>, allowed: string[], where: string, warnings: string[]) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) warnings.push(`${where ? `${where}.` : ""}${k}: unknown key, ignored`);
}

function readPoint(v: unknown, label: string, errors: string[]): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2 || !isNum(v[0]) || !isNum(v[1])) {
    errors.push(`${label}: must be [x, y], two finite numbers`);
    return null;
  }
  if (v[0] < CHARACTER_LIMITS.coordMin || v[0] > CHARACTER_LIMITS.coordMax || v[1] < CHARACTER_LIMITS.coordMin || v[1] > CHARACTER_LIMITS.coordMax) {
    errors.push(`${label}: coordinates must stay within ${CHARACTER_LIMITS.coordMin}..${CHARACTER_LIMITS.coordMax}`);
    return null;
  }
  return [v[0], v[1]];
}

/** Checks a definition (any JSON value). Collects every problem; warnings never block. */
export function validateCharacter(input: unknown): ValidationResult<CharacterDefinition> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["(root): must be a JSON object"] };

  warnUnknown(input, TOP_KEYS, "", warnings);

  if (input.version !== 1) errors.push("version: must be the number 1");

  const id = input.id;
  if (typeof id !== "string" || !ID_RE.test(id)) errors.push("id: must be a lowercase slug of 1 to 40 characters [a-z0-9-], starting with a letter or digit");

  let name = "";
  if (typeof input.name !== "string") errors.push("name: must be a string");
  else {
    name = input.name.trim();
    // eslint-disable-next-line no-control-regex
    if (name.length < 1 || name.length > CHARACTER_LIMITS.nameMax || /[\u0000-\u001f<>]/.test(name))
      errors.push(`name: must be 1 to ${CHARACTER_LIMITS.nameMax} printable characters, without < or >`);
  }

  /* body */
  let body: CheckedPath | null = null;
  let bodyPath = "";
  if (!isRecord(input.body)) errors.push('body: must be an object { "path": "..." }');
  else {
    warnUnknown(input.body, BODY_KEYS, "body", warnings);
    body = checkPath("body.path", input.body.path, errors, warnings, { subpaths: CHARACTER_LIMITS.pathSubpaths });
    if (typeof input.body.path === "string") bodyPath = input.body.path;
  }
  if (body) {
    const b = body.bounds;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const edges: string[] = [];
    if (b.minX < CHARACTER_LIMITS.bodyHardMin) edges.push(`left edge x=${r1(b.minX)}`);
    if (b.minY < CHARACTER_LIMITS.bodyHardMin) edges.push(`top edge y=${r1(b.minY)}`);
    if (b.maxX > CHARACTER_LIMITS.bodyHardMax) edges.push(`right edge x=${r1(b.maxX)}`);
    if (b.maxY > CHARACTER_LIMITS.bodyHardMax) edges.push(`bottom edge y=${r1(b.maxY)}`);
    if (edges.length)
      errors.push(`body.path: leaves the safe area ${CHARACTER_LIMITS.bodyHardMin}..${CHARACTER_LIMITS.bodyHardMax} (${edges.join(", ")})`);
    else if (
      b.minX < CHARACTER_LIMITS.bodySoftMin ||
      b.minY < CHARACTER_LIMITS.bodySoftMin ||
      b.maxX > CHARACTER_LIMITS.bodySoftMax ||
      b.maxY > CHARACTER_LIMITS.bodySoftMax
    )
      warnings.push(`body.path: reaches outside ${CHARACTER_LIMITS.bodySoftMin}..${CHARACTER_LIMITS.bodySoftMax}; keeping the outline inside leaves room for the animations`);
    if (w < CHARACTER_LIMITS.bodyMinSize || h < CHARACTER_LIMITS.bodyMinSize)
      errors.push(`body.path: the outline is ${r1(w)}×${r1(h)}; it must be at least ${CHARACTER_LIMITS.bodyMinSize}×${CHARACTER_LIMITS.bodyMinSize}`);
  }

  /* eyes */
  let eyes: CharacterDefinition["eyes"] | null = null;
  if (!isRecord(input.eyes)) errors.push("eyes: must be an object { x, y, spacing, scale }");
  else {
    const e = input.eyes;
    warnUnknown(e, EYE_KEYS, "eyes", warnings);
    let ok = true;
    const need = (k: string, lo: number, hi: number) => {
      const v = e[k];
      if (!isNum(v) || v < lo || v > hi) {
        errors.push(`eyes.${k}: must be a number between ${lo} and ${hi}`);
        ok = false;
      }
    };
    need("x", 0, 100);
    need("y", 0, 100);
    need("spacing", CHARACTER_LIMITS.eyeSpacing[0], CHARACTER_LIMITS.eyeSpacing[1]);
    need("scale", CHARACTER_LIMITS.eyeScale[0], CHARACTER_LIMITS.eyeScale[1]);
    if (ok) {
      eyes = { x: e.x as number, y: e.y as number, spacing: e.spacing as number, scale: e.scale as number };
      const minSpacing = EYE_W * eyes.scale * (1 + EYE_GAP);
      if (eyes.spacing < minSpacing) {
        const hint = `makes the eyes overlap at scale ${eyes.scale}; use at least ${r1(minSpacing)} or a smaller eyes.scale`;
        // Open Bot Avatar's 4-wide pill needed only 5 * scale: never reject what was valid there.
        if (eyes.spacing >= EYE_W_OBA * eyes.scale * 1.25) warnings.push(`eyes.spacing: ${eyes.spacing} ${hint}`);
        else {
          errors.push(`eyes.spacing: ${eyes.spacing} ${hint}`);
          eyes = null;
        }
      }
    }
  }
  if (body && eyes) {
    const w = EYE_W * eyes.scale;
    const h = EYE_H * eyes.scale;
    for (const [label, cx] of [
      ["left", eyes.x - eyes.spacing / 2],
      ["right", eyes.x + eyes.spacing / 2],
    ] as const) {
      const miss = pillRing(cx, eyes.y, w, h, CHARACTER_LIMITS.eyeMargin).find(([x, y]) => !inside(body.polys, x, y));
      if (miss) {
        const msg = `eyes: the ${label} eye (${r1(w)}×${r1(h)} at ${r1(cx)}, ${r1(eyes.y)}) pokes outside the body near (${r1(miss[0])}, ${r1(miss[1])}); move eyes.x / eyes.y toward the middle of the body or reduce eyes.spacing / eyes.scale`;
        const thin = pillRing(cx, eyes.y, EYE_W_OBA * eyes.scale, h, CHARACTER_LIMITS.eyeMargin).find(([x, y]) => !inside(body.polys, x, y));
        // Valid for Open Bot Avatar's thinner pill: keep it accepted, only warn.
        if (thin) errors.push(msg);
        else warnings.push(msg.replace("pokes outside the body", "is close to the body outline (wider pill than Open Bot Avatar's)"));
      }
    }
    const bodyH = body.bounds.maxY - body.bounds.minY;
    if (bodyH > 0 && h / bodyH < EYE_SMALL_RATIO) {
      const want = (EYE_TARGET_RATIO * bodyH) / EYE_H;
      warnings.push(
        `eyes.scale: eyes are small for this body (${Math.round((100 * h) / bodyH)} % of body height); expressions read best at 22–30 % — try scale ≈ ${Math.round(want * 100) / 100}`,
      );
    }
  }

  /* rig extension */
  let rigOut: CharacterDefinition["rig"] | undefined;
  if (input.rig !== undefined) {
    if (!isRecord(input.rig)) errors.push("rig: must be an object");
    else {
      const rig = input.rig;
      warnUnknown(rig, RIG_KEYS, "rig", warnings);
      rigOut = {};

      if (rig.parts !== undefined) {
        if (!Array.isArray(rig.parts)) errors.push("rig.parts: must be an array");
        else {
          if (rig.parts.length > 3) errors.push("rig.parts: at most 3 parts (one per role C, L, R)");
          const seen = new Set<string>();
          const parts: NonNullable<NonNullable<CharacterDefinition["rig"]>["parts"]> = [];
          rig.parts.slice(0, 3).forEach((p: unknown, i: number) => {
            const at = `rig.parts[${i}]`;
            if (!isRecord(p)) {
              errors.push(`${at}: must be an object { role, path, pivot, tip }`);
              return;
            }
            warnUnknown(p, PART_KEYS, at, warnings);
            let good = true;
            const role = p.role;
            if (role !== "C" && role !== "L" && role !== "R") {
              errors.push(`${at}.role: must be "C", "L" or "R"`);
              good = false;
            } else if (seen.has(role)) {
              errors.push(`${at}.role: "${role}" is used twice; each role can appear once`);
              good = false;
            } else seen.add(role);
            const path = checkPath(`${at}.path`, p.path, errors, warnings, { subpaths: 1 });
            if (!path) good = false;
            const pivot = readPoint(p.pivot, `${at}.pivot`, errors);
            const tip = readPoint(p.tip, `${at}.tip`, errors);
            if (!pivot || !tip) good = false;
            if (pivot && tip) {
              if (Math.hypot(tip[0] - pivot[0], tip[1] - pivot[1]) < CHARACTER_LIMITS.minPartLength) {
                errors.push(`${at}.tip: must be at least ${CHARACTER_LIMITS.minPartLength} units away from the pivot`);
                good = false;
              }
              if (body) {
                const b = body.bounds;
                const s = CHARACTER_LIMITS.pivotSlack;
                if (pivot[0] < b.minX - s || pivot[0] > b.maxX + s || pivot[1] < b.minY - s || pivot[1] > b.maxY + s) {
                  errors.push(`${at}.pivot: (${r1(pivot[0])}, ${r1(pivot[1])}) must be inside the body's bounding box (or within ${s} units of it); the base of a part belongs inside the body`);
                  good = false;
                }
              }
            }
            if (good) parts.push({ role: role as Role, path: p.path as string, pivot: pivot as [number, number], tip: tip as [number, number] });
          });
          if (parts.length) rigOut.parts = parts;
        }
      }

      if (rig.eyeStyles !== undefined) {
        if (!isRecord(rig.eyeStyles)) errors.push("rig.eyeStyles: must be an object keyed by classic, pumpy, big");
        else {
          warnUnknown(rig.eyeStyles, EYE_STYLE_NAMES, "rig.eyeStyles", warnings);
          const styles: Partial<Record<EyeStyle, Partial<EyeShape>>> = {};
          for (const name2 of EYE_STYLE_NAMES) {
            const s = rig.eyeStyles[name2];
            if (s === undefined) continue;
            const at = `rig.eyeStyles.${name2}`;
            if (!isRecord(s)) {
              errors.push(`${at}: must be an object with any of w, h, tilt, dx, dy`);
              continue;
            }
            warnUnknown(s, EYE_SHAPE_KEYS, at, warnings);
            const shape: Partial<EyeShape> = {};
            for (const k of EYE_SHAPE_KEYS as Array<keyof EyeShape>) {
              if (s[k] === undefined) continue;
              const [lo, hi] = EYE_SHAPE_RANGE[k];
              if (!isNum(s[k]) || (s[k] as number) < lo || (s[k] as number) > hi) errors.push(`${at}.${k}: must be a number between ${lo} and ${hi}`);
              else shape[k] = s[k] as number;
            }
            styles[name2] = shape;
          }
          if (Object.keys(styles).length) rigOut.eyeStyles = styles;
        }
      }

      if (rig.idle !== undefined) {
        if (!isRecord(rig.idle)) errors.push("rig.idle: must be an object { amp, freq }");
        else {
          warnUnknown(rig.idle, ["amp", "freq"], "rig.idle", warnings);
          const idle: { amp?: number; freq?: number } = {};
          for (const k of ["amp", "freq"] as const) {
            if (rig.idle[k] === undefined) continue;
            if (!isNum(rig.idle[k]) || (rig.idle[k] as number) < 0 || (rig.idle[k] as number) > 6) errors.push(`rig.idle.${k}: must be a number between 0 and 6`);
            else idle[k] = rig.idle[k] as number;
          }
          rigOut.idle = idle;
        }
      }

      if (rig.flicker !== undefined) {
        if (!isNum(rig.flicker) || rig.flicker < 0 || rig.flicker > 1) errors.push("rig.flicker: must be a number between 0 and 1");
        else rigOut.flicker = rig.flicker;
      }

      if (rig.color !== undefined) {
        if (typeof rig.color !== "string" || !COLOR_RE.test(rig.color)) errors.push("rig.color: must be a hex colour such as #3fa66b or #3a6");
        else rigOut.color = rig.color;
      }
    }
  }

  if (errors.length || !body || !eyes) return { ok: false, errors: errors.length ? errors : ["(root): invalid definition"] };

  const value: CharacterDefinition = { version: 1, id: id as string, name, body: { path: bodyPath }, eyes };
  if (rigOut) value.rig = rigOut;

  // Does the whole figure fit the stage once scaled? (Only a warning: animations may exceed it anyway.)
  const fit = stageFit(value, body);
  if (fit) warnings.push(fit);
  return { ok: true, value, warnings };
}

/** Warns when body plus parts would stick out of the engine's viewBox at rest. */
function stageFit(def: CharacterDefinition, body: CheckedPath): string | null {
  let minY = body.bounds.minY;
  let minX = body.bounds.minX;
  let maxX = body.bounds.maxX;
  for (const p of def.rig?.parts ?? []) {
    const polys = flattenPath(normalizePath(p.path));
    const b = polyBounds(polys);
    minY = Math.min(minY, b.minY);
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
  }
  const cx = (body.bounds.minX + body.bounds.maxX) / 2;
  const top = GROUND.y - (body.bounds.maxY - minY) * CHARACTER_SCALE;
  const left = GROUND.x + (minX - cx) * CHARACTER_SCALE;
  const right = GROUND.x + (maxX - cx) * CHARACTER_SCALE;
  if (top < 60 || left < 190 || right > 1070)
    return "the figure (body plus parts) is larger than the stage once scaled; it will be clipped. Make it smaller or lower the parts";
  return null;
}

/* ======================================================================== */
/* Definition → Rig                                                          */
/* ======================================================================== */

/**
 * Ratios that turn the `classic` eye into `pumpy` and `big`, read from Berry's
 * hand-tuned styles: `w`/`h` as multiples of the classic, `dx` as a fraction
 * of the classic width, `dy` as a fraction of the classic height; `tilt` is kept.
 */
const STYLE_RATIOS = (() => {
  const c = RIG_BERRY.eyeStyles.classic;
  const of = (s: EyeShape) => ({ w: s.w / c.w, h: s.h / c.h, dx: s.dx / c.w, dy: s.dy / c.h, tilt: s.tilt });
  return { pumpy: of(RIG_BERRY.eyeStyles.pumpy), big: of(RIG_BERRY.eyeStyles.big) };
})();

/** Accessory anchor relative to the body box, measured on Berry (880,300 on a 320..934 × 392..960 body). */
const ACCESSORY = { fromRight: (934 - 880) / (934 - 320), aboveTop: (392 - 300) / (960 - 392), fromTopAll: (300 - 252) / (960 - 252) };

/**
 * Compiles a validated definition into a `Rig`. Derivations (S = CHARACTER_SCALE):
 *  - transform: x' = 627 + (x − bboxCenterX)·S, y' = 960 + (y − bboxBottom)·S, where the bbox is that of
 *    the flattened body outline. Parts, pivots, tips and eyes use the same transform.
 *  - eyes.left/right = (eyes.x ∓ spacing/2, eyes.y) transformed.
 *  - eyeStyles.classic = a pill: h = 11·scale·S and w = h / 2 (Berry's ratio; deliberately wider than Open Bot Avatar's 4-wide pill), so w = 5.5·scale·S, tilt 0, dx 0, dy 0.
 *  - pumpy / big = classic × Berry's ratios (w, h multiples; dx as a fraction of classic w, dy of classic h;
 *    tilt copied), built from the classic AFTER its override; then each style's own `rig.eyeStyles`
 *    override (w/h/dx/dy × S) is applied.
 *  - ground = (627, 960); anchor = (627, 660); center = bbox centre (transformed).
 *  - shadow = (627, 988), rx = 0.41 × body width, ry = 22 (Berry: 250 / 614 ≈ 0.41).
 *  - accessory: x = bboxRight − 0.088 × body width; y = min(topOfEverything + 0.068 × total height,
 *    bodyTop − 0.16 × body height), never above 100 (Berry's proportions: 880,300).
 *  - baseHeight = 960 − mean pivot y, or 0.6 × body height with no parts.
 *  - idleAppendage = rig.idle (default 1/1); flicker = rig.flicker (default 0); no core.
 * Throws if the definition is invalid; run `validateCharacter` first.
 */
export function characterToRig(def: CharacterDefinition): Rig {
  const S = CHARACTER_SCALE;
  const bodyCmds = normalizePath(def.body.path, true);
  const b = polyBounds(flattenPath(bodyCmds));
  const cx0 = (b.minX + b.maxX) / 2;
  const tx = (x: number) => GROUND.x + (x - cx0) * S;
  const ty = (y: number) => GROUND.y + (y - b.maxY) * S;

  const place = (cmds: readonly PathCommand[]): string =>
    serializePath(cmds.map(({ c, pts }) => ({ c, pts: pts.map((v, i) => (i % 2 === 0 ? tx(v) : ty(v))) })));

  const bodyW = (b.maxX - b.minX) * S;
  const bodyH = (b.maxY - b.minY) * S;
  const bodyTop = ty(b.minY);

  const appendages: Appendage[] = [];
  let topAll = bodyTop;
  for (const p of def.rig?.parts ?? []) {
    const cmds = normalizePath(p.path, true);
    const pb = polyBounds(flattenPath(cmds));
    topAll = Math.min(topAll, ty(pb.minY));
    appendages.push({
      role: p.role,
      path: place(cmds),
      pivot: { x: tx(p.pivot[0]), y: ty(p.pivot[1]) },
      tip: { x: tx(p.tip[0]), y: ty(p.tip[1]) },
    });
  }

  const ov = def.rig?.eyeStyles ?? {};
  const apply = (base: EyeShape, o: Partial<EyeShape> | undefined): EyeShape => ({
    w: o?.w !== undefined ? o.w * S : base.w,
    h: o?.h !== undefined ? o.h * S : base.h,
    tilt: o?.tilt ?? base.tilt,
    dx: o?.dx !== undefined ? o.dx * S : base.dx,
    dy: o?.dy !== undefined ? o.dy * S : base.dy,
  });
  const classic = apply({ w: EYE_W * def.eyes.scale * S, h: EYE_H * def.eyes.scale * S, tilt: 0, dx: 0, dy: 0 }, ov.classic);
  const from = (r: { w: number; h: number; dx: number; dy: number; tilt: number }): EyeShape => ({
    w: classic.w * r.w,
    h: classic.h * r.h,
    tilt: r.tilt,
    dx: classic.w * r.dx,
    dy: classic.h * r.dy,
  });

  const pivotY = appendages.length ? appendages.reduce((s, a) => s + a.pivot.y, 0) / appendages.length : 0;
  const totalH = GROUND.y - topAll;

  return {
    id: def.id,
    body: place(bodyCmds),
    appendages,
    eyes: {
      left: { x: tx(def.eyes.x - def.eyes.spacing / 2), y: ty(def.eyes.y) },
      right: { x: tx(def.eyes.x + def.eyes.spacing / 2), y: ty(def.eyes.y) },
    },
    eyeStyles: { classic, pumpy: apply(from(STYLE_RATIOS.pumpy), ov.pumpy), big: apply(from(STYLE_RATIOS.big), ov.big) },
    ground: { ...GROUND },
    center: { x: tx(cx0), y: (bodyTop + GROUND.y) / 2 },
    shadow: { x: GROUND.x, y: 988, rx: 0.41 * bodyW, ry: 22 },
    accessory: {
      x: tx(b.maxX) - ACCESSORY.fromRight * bodyW,
      y: Math.max(100, Math.min(topAll + ACCESSORY.fromTopAll * totalH, bodyTop - ACCESSORY.aboveTop * bodyH)),
    },
    anchor: { x: 627, y: 660 },
    baseHeight: appendages.length ? GROUND.y - pivotY : 0.6 * bodyH,
    idleAppendage: { amp: def.rig?.idle?.amp ?? 1, freq: def.rig?.idle?.freq ?? 1 },
    flicker: def.rig?.flicker ?? 0,
  };
}

/** JSON text → validated definition plus rig. Never throws. */
export function parseCharacter(json: string): ValidationResult<{ definition: CharacterDefinition; rig: Rig }> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { ok: false, errors: [`(root): not valid JSON (${err instanceof Error ? err.message : String(err)})`] };
  }
  const v = validateCharacter(raw);
  if (!v.ok) return v;
  try {
    return { ok: true, value: { definition: v.value, rig: characterToRig(v.value) }, warnings: v.warnings };
  } catch (err) {
    return { ok: false, errors: [`(root): could not build the rig (${err instanceof Error ? err.message : String(err)})`] };
  }
}
