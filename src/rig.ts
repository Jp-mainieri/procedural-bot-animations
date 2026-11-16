/*
 * Rigs: the geometry of each character, separate from the motion engine. All
 * characters share one coordinate system (ground at y = 960, center at
 * x ≈ 627) and one viewBox, so reactions, accessories and objects work for
 * every one of them.
 */

export type Point = { x: number; y: number };

/** Role of the appendage: the middle one (C), the left one (L) and the right one (R). */
export type Role = "C" | "L" | "R";

/** A leaf or a flame tongue: a piece attached to the body that rotates and bends. */
export type Appendage = { role: Role; path: string; pivot: Point; tip: Point };

export type EyeStyle = "classic" | "pumpy" | "big";
export const EYE_STYLES: EyeStyle[] = ["classic", "pumpy", "big"];

/**
 * Resting shape of the eye: a `w × h` pill (fully rounded corners), tilted
 * `tilt` degrees (the same direction on both eyes, like italics) and shifted
 * `dx`/`dy` from the base point. `dx` is mirrored: positive brings the eyes closer.
 */
export type EyeShape = { w: number; h: number; tilt: number; dx: number; dy: number };

export type Rig = {
  id: string;
  body: string;
  appendages: Appendage[];
  eyes: { left: Point; right: Point };
  eyeStyles: Record<EyeStyle, EyeShape>;
  ground: Point;
  center: Point;
  shadow: { x: number; y: number; rx: number; ry: number };
  accessory: Point;
  /**
   * Center of the transformations: the body becomes a circle of radius
   * `ROUND_RADIUS` around it (resting on the ground) and objects are born there.
   */
  anchor: Point;
  /** Distance from the ground to the base of the appendages (for the tip physics). */
  baseHeight: number;
  /** Idle sway of the appendages: multiplies amplitude and frequency. */
  idleAppendage: { amp: number; freq: number };
  /** 0 = firm body; 1 = the body flickers like fire. */
  flicker: number;
  /** Optional light core (the 1000-day flame). */
  core?: string;
};

export const VIEWBOX = { x: 190, y: 60, w: 880, h: 990 } as const;
export const VIEWBOX_ATTR = `${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`;
export const ASPECT = VIEWBOX.h / VIEWBOX.w;

/** Happy arc-shaped eye (^), for an eye of width 80 centered at (0,0). */
export const HAPPY_EYE_PATH = "M-50,26 C-36,-38 36,-38 50,26 C34,4 -34,4 -50,26 Z";

/* ---------- effects ---------- */

/** Sparks of a hit: 8 directions, alternating distance and color. */
export const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4 + Math.PI / 8;
  const r = i % 2 ? 300 : 370;
  return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r), alt: i % 2 === 1 };
});

export const SPARK_PATH = "M0,-20 L7,-7 L20,0 L7,7 L0,20 L-7,7 L-20,0 L-7,-7Z";

/* ---------- transformations ---------- */

/** Radius of the circle the body turns into (ground at y = 960, anchor at 660). */
export const ROUND_RADIUS = 300;
/** Radius of the bubble the body shrinks into and objects are born from. */
export const DOT_R = 36;
/** Scale of the round body when its radius is exactly the bubble's. */
export const DOT_SCALE = DOT_R / ROUND_RADIUS;

/** Loading ring: outer radius and hole (46 px stroke). */
export const RING = { R: 133, hole: 87 } as const;

/**
 * Check mark, relative to the anchor. The stroke is as wide as the bubble, so
 * the start of the round-capped check is the bubble itself.
 */
export const CHECK = {
  start: { x: -130, y: -10 },
  path: "M-130,-10 L-45,75 L135,-105",
  length: Math.hypot(85, 85) + Math.hypot(180, 180),
  width: DOT_R * 2,
} as const;

/**
 * `</>`: each stroke is born at one of the three dots (the vertex of the <,
 * the middle of the slash, the vertex of the >). Width 50 = the dots' diameter
 * at that moment.
 */
export const CODE = {
  dist: 170,
  radius: 25,
  strokes: [
    "M-170,0 L-95,-75",
    "M-170,0 L-95,75",
    "M0,0 L38,-105",
    "M0,0 L-38,105",
    "M170,0 L95,-75",
    "M170,0 L95,75",
  ],
  lengths: [106.1, 106.1, 111.7, 111.7, 106.1, 106.1],
} as const;

/** Energy orbit: full radius and radius of each dot. */
export const ORBIT = { R: 300, radii: [26, 18, 26, 18, 26, 18, 26, 18] } as const;
