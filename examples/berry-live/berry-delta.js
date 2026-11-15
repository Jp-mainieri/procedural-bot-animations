/**
 * Ported from DevBerry's `lib/berry/delta.ts`. What moods, activities and
 * reactions add on top of the base pose. Everything is a displacement from
 * neutral: 0 in every field is the character at rest. Positions in viewBox
 * px, angles in degrees, scales as an addition to 1 (`eyeSy: -0.5` halves
 * the eye's height).
 */
export const FIELDS = [
  "rootY", "opacity", "bodyRotate", "centerRotate", "bodySx", "bodySy", "scale",
  "leafC", "leafL", "leafR",
  "eyeX", "eyeY", "eyeSx", "eyeSy",
  "lidTop", "lidBottom", "lidAngle",
  "closeLeft", "closeRight",
  "turn",
  "happy", "happyLeft", "happyRight",
  "shadow", "holdGaze", "leafAmp",
  "lamp", "exclaim", "question", "ellipsis", "zzz", "rays", "sparks",
  "morph", "round", "retract", "eyesVanish", "swap",
  "bubbleR", "bubbleHole", "bubbleArc", "bubbleX", "bubbleY",
  "dotsDist", "dotsBounce", "checkDraw", "codeDraw", "orbitOpen",
  "objScale", "objRotate",
];

export function zeroDelta() {
  const d = {};
  for (const f of FIELDS) d[f] = 0;
  return d;
}

/** `acc += delta * weight`, field by field. Mutates `acc`. */
export function addDelta(acc, delta, weight = 1) {
  for (const k in delta) acc[k] = (acc[k] ?? 0) + (delta[k] ?? 0) * weight;
  return acc;
}

/** Fields that move the character through space; skipped under reduced motion. */
export const MOTION_FIELDS = [
  "rootY", "bodyRotate", "centerRotate", "bodySx", "bodySy", "scale", "turn",
  "sparks", "rays",
  "morph", "round", "retract", "eyesVanish", "swap",
  "bubbleR", "bubbleHole", "bubbleArc", "bubbleX", "bubbleY",
  "dotsDist", "dotsBounce", "checkDraw", "codeDraw", "orbitOpen",
  "objScale", "objRotate",
];
