/**
 * What moods, activities and reactions add on top of the base layer. Everything
 * is an offset from neutral: 0 in every field is the character at rest.
 *
 * Units: positions in drawing px (viewBox), angles in degrees, scales as an
 * increment over 1 (`eyeSy: -0.5` leaves the eye at half its height).
 */
export const FIELDS = [
  /** Raises (negative) or lowers the whole character; the shadow stays on the ground. */
  "rootY",
  /** Added to the opacity (−1 disappears). */
  "opacity",
  /** Rotation around the ground (leaning). */
  "bodyRotate",
  /** Rotation around the body center (somersault). */
  "centerRotate",
  "bodySx",
  "bodySy",
  /** Uniform scale of the character, from the ground (−1 vanishes, to become an object). */
  "scale",
  "partC",
  /** Left appendage: positive raises it. */
  "partL",
  /** Right appendage: negative raises it (mirrored). */
  "partR",
  "eyeX",
  "eyeY",
  "eyeSx",
  "eyeSy",
  /** Top eyelid (0 open, 1 closes the eye from the top down). */
  "lidTop",
  /** Bottom eyelid (0 open, 1 closes from the bottom up): a smiling look. */
  "lidBottom",
  /** Eyelid tilt: positive slopes down toward the inside (angry, suspicious), negative toward the outside (worried). */
  "lidAngle",
  /** Closes just one eye (a wink). 0 to 1. */
  "closeLeft",
  "closeRight",
  /** Fake 3D turn: −1 to 1 turns the face; up to ±1.6 is a profile. */
  "turn",
  /** Arc-shaped eyes (^): both of them, or just one. */
  "happy",
  "happyLeft",
  "happyRight",
  "shadow",
  /** How much the reaction takes over the gaze (0 follows the target, 1 only the reaction rules). */
  "holdGaze",
  /** Multiplies the amplitude of the appendage sway (−1 freezes it). */
  "partAmp",
  /* accessories (0 hidden, 1 visible) */
  "lamp",
  "exclaim",
  "question",
  "ellipsis",
  "zzz",
  "rays",
  /** Progress of the sparks (0 to 1); 0 when there are none. */
  "sparks",
  /* flame only */
  /** Loses its color: 0 normal, 1 gray (put out, at risk). */
  "gray",
  /** Lit yellow core (0 to 1), on top of the fixed one of the 1000-day streak. */
  "core",
  /** Embers rising from the tongues (intensity, 0 to 1). */
  "embers",
  /** Smoke coming off the tip (intensity, 0 to 1). */
  "smoke",
  /*
   * Seamless transformation (Pumpy's grammar). The body becomes a perfect
   * circle around the anchor, shrinks to the size of the bubble and, on that
   * frame, swaps with it: same color, same center, same radius. The bubble
   * turns into dots, a ring, a check or </> through continuous geometry, and
   * the way back is the same in reverse.
   */
  /** 0 to 1: scaling becomes relative to the anchor and the idle goes quiet. */
  "morph",
  /** 0 to 1: the silhouette becomes a circle. */
  "round",
  /** 0 to 1: appendages retract into the body (negative: they pop out bigger). */
  "retract",
  /** 0 to 1: the eyes shrink until they vanish. */
  "eyesVanish",
  /** ≥ 0.5: shows the object in place of the body. */
  "swap",
  /** Outer radius of the bubble (px). With hole 0, it is a disc. */
  "bubbleR",
  /** Radius of the hole: with a hole, the bubble becomes a ring. */
  "bubbleHole",
  /** Fraction of the ring that is missing (0 = whole ring). */
  "bubbleArc",
  "bubbleX",
  "bubbleY",
  /** Distance from the side dots to the bubble (px); they are born underneath it. */
  "dotsDist",
  /** How much the dots bounce (0 to 1). */
  "dotsBounce",
  /** How much of the check has been drawn, from the bubble. */
  "checkDraw",
  /** How much of the </> has been drawn, from the three dots. */
  "codeDraw",
  /** 0 to 1: the orbit dots come out from under the bubble up to the full radius. */
  "orbitOpen",
  /** Added to the object's scale (pulse). */
  "objScale",
  /** Rotation of the object, in degrees. */
  "objRotate",
] as const;

export type DeltaField = (typeof FIELDS)[number];
export type Delta = Record<DeltaField, number>;
export type PartialDelta = Partial<Delta>;

export const zeroDelta = (): Delta => Object.fromEntries(FIELDS.map((c) => [c, 0])) as Delta;

/** `acc += d * weight`, field by field. Mutates `acc` in place. */
export function addDelta(acc: Delta, d: PartialDelta, weight = 1) {
  for (const k in d) {
    const key = k as DeltaField;
    acc[key] += (d[key] ?? 0) * weight;
  }
  return acc;
}

/** Fields that are movement through space. With reduced motion, they are left out. */
export const MOTION_FIELDS: readonly DeltaField[] = [
  "rootY",
  "bodyRotate",
  "centerRotate",
  "bodySx",
  "bodySy",
  "scale",
  "turn",
  "sparks",
  "embers",
  "smoke",
  "morph",
  "round",
  "retract",
  "eyesVanish",
  "swap",
  "bubbleR",
  "bubbleHole",
  "bubbleArc",
  "bubbleX",
  "bubbleY",
  "dotsDist",
  "dotsBounce",
  "checkDraw",
  "codeDraw",
  "orbitOpen",
  "objScale",
  "objRotate",
];
