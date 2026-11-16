/*
 * Animation definitions: plain JSON for reactions (one-shot), activities
 * (loops) and moods (static poses), validated and compiled into the same
 * objects the built-in library uses.
 */

import type { DeltaField, PartialDelta } from "./delta.js";
import { FIELDS } from "./delta.js";
import type { CurveName, Keyframe } from "./motion.js";
import { CURVES, fromTracks } from "./motion.js";
import type { ActivityDef, ReactionDef } from "./reactions.js";
import type { ValidationResult } from "./character.js";

export type { ValidationResult };

/* ---------- field catalogue ---------- */

export type FieldGroup = "body" | "parts" | "eyes" | "lids" | "accessories" | "flame" | "morph";
export type FieldUnit = "px" | "deg" | "scale" | "0..1" | "-1..1";

export interface FieldInfo {
  group: FieldGroup;
  /** `px`: drawing pixels; `deg`: degrees; `scale`: increment over 1 (-0.5 = half); `0..1` / `-1..1`: plain amounts. */
  unit: FieldUnit;
  min: number;
  max: number;
  rest: 0;
  description: string;
}

const f = (group: FieldGroup, unit: FieldUnit, min: number, max: number, description: string): FieldInfo => ({
  group,
  unit,
  min,
  max,
  rest: 0,
  description,
});

/**
 * One entry per delta field. The hard ranges come from the extreme values the
 * built-in reactions, activities and moods actually reach, widened about 1.5×.
 * 0 is always the character at rest.
 */
export const FIELD_INFO: Record<DeltaField, FieldInfo> = {
  rootY: f("body", "px", -400, 650, "Raises (negative) or lowers the whole character; the shadow stays on the ground."),
  opacity: f("body", "-1..1", -1, 0, "Added to the opacity (-1 disappears)."),
  bodyRotate: f("body", "deg", -45, 45, "Rotation around the ground (leaning)."),
  centerRotate: f("body", "deg", -720, 720, "Rotation around the body center (somersault)."),
  bodySx: f("body", "scale", -0.5, 0.6, "Horizontal stretch of the body from the ground (0.2 = 20% wider)."),
  bodySy: f("body", "scale", -0.8, 0.8, "Vertical stretch of the body from the ground (-0.2 = 20% shorter). Keep bodySx near -bodySy to preserve volume."),
  scale: f("body", "scale", -1, 0.5, "Uniform scale of the character, from the ground (-1 vanishes)."),
  partC: f("parts", "deg", -50, 50, "Middle appendage rotation."),
  partL: f("parts", "deg", -50, 50, "Left appendage: positive raises it."),
  partR: f("parts", "deg", -50, 50, "Right appendage: negative raises it (mirrored)."),
  partAmp: f("parts", "scale", -1, 1.5, "Multiplies the amplitude of the appendage sway (-1 freezes it)."),
  eyeX: f("eyes", "px", -40, 40, "Eyes move horizontally."),
  eyeY: f("eyes", "px", -40, 40, "Eyes move vertically (positive looks down)."),
  eyeSx: f("eyes", "scale", -1, 0.6, "Eye width, increment over 1."),
  eyeSy: f("eyes", "scale", -1, 0.6, "Eye height, increment over 1 (-0.5 leaves the eye at half its height)."),
  turn: f("eyes", "-1..1", -1.6, 1.6, "Fake 3D turn: -1 to 1 turns the face; up to +-1.6 is a profile."),
  happy: f("eyes", "0..1", 0, 1, "Both eyes become arcs (^)."),
  happyLeft: f("eyes", "0..1", 0, 1, "Only the left eye becomes an arc (^)."),
  happyRight: f("eyes", "0..1", 0, 1, "Only the right eye becomes an arc (^)."),
  holdGaze: f("eyes", "0..1", 0, 1, "How much the reaction takes over the gaze (0 follows the target, 1 only the reaction rules)."),
  lidTop: f("lids", "0..1", 0, 1, "Top eyelid (0 open, 1 closes the eye from the top down)."),
  lidBottom: f("lids", "0..1", 0, 1, "Bottom eyelid (0 open, 1 closes from the bottom up): a smiling look."),
  lidAngle: f("lids", "deg", -40, 40, "Eyelid tilt: positive slopes down toward the inside (angry, suspicious), negative toward the outside (worried)."),
  closeLeft: f("lids", "0..1", 0, 1, "Closes just the left eye (a wink)."),
  closeRight: f("lids", "0..1", 0, 1, "Closes just the right eye (a wink)."),
  shadow: f("body", "-1..1", -1, 0, "Shadow opacity, added to 1 (-1 hides the shadow; it cannot get stronger than normal)."),
  lamp: f("accessories", "0..1", 0, 1, "Light bulb accessory (0 hidden, 1 visible)."),
  exclaim: f("accessories", "0..1", 0, 1, "Exclamation mark (0 hidden, 1 visible)."),
  question: f("accessories", "0..1", 0, 1, "Question mark (0 hidden, 1 visible)."),
  ellipsis: f("accessories", "0..1", 0, 1, "Three dots (0 hidden, 1 visible)."),
  zzz: f("accessories", "0..1", 0, 1, "Sleeping Z's (0 hidden, 1 visible)."),
  rays: f("accessories", "0..1", 0, 1, "Light rays (0 hidden, 1 visible)."),
  sparks: f("accessories", "0..1", 0, 1, "Progress of the sparks of a hit (0 to 1); 0 when there are none."),
  gray: f("flame", "0..1", 0, 1, "Loses its color: 0 normal, 1 gray (flame characters)."),
  core: f("flame", "0..1", 0, 1, "Lit yellow core (flame characters)."),
  embers: f("flame", "0..1", 0, 1, "Embers rising from the tongues (intensity)."),
  smoke: f("flame", "0..1", 0, 1, "Smoke coming off the tip (intensity)."),
  morph: f("morph", "0..1", 0, 1, "Starts the transformation: scaling becomes relative to the anchor and the idle goes quiet."),
  round: f("morph", "0..1", 0, 1, "The silhouette becomes a circle."),
  retract: f("morph", "-1..1", -0.5, 1, "Appendages retract into the body (negative: they pop out bigger)."),
  eyesVanish: f("morph", "0..1", 0, 1, "The eyes shrink until they vanish."),
  swap: f("morph", "0..1", 0, 1, "At 0.5 or more shows the object in place of the body."),
  bubbleR: f("morph", "px", 0, 200, "Outer radius of the bubble (a disc when bubbleHole is 0)."),
  bubbleHole: f("morph", "px", 0, 130, "Radius of the hole: with a hole, the bubble becomes a ring."),
  bubbleArc: f("morph", "0..1", 0, 1, "Fraction of the ring that is missing (0 = whole ring)."),
  bubbleX: f("morph", "px", -200, 200, "Horizontal offset of the bubble."),
  bubbleY: f("morph", "px", -200, 200, "Vertical offset of the bubble."),
  dotsDist: f("morph", "px", 0, 260, "Distance from the side dots to the bubble; they are born underneath it."),
  dotsBounce: f("morph", "0..1", 0, 1, "How much the dots bounce."),
  checkDraw: f("morph", "0..1", 0, 1, "How much of the check mark has been drawn, from the bubble."),
  codeDraw: f("morph", "0..1", 0, 1, "How much of the </> has been drawn, from the three dots."),
  orbitOpen: f("morph", "0..1", 0, 1, "The orbit dots come out from under the bubble up to the full radius."),
  objScale: f("morph", "scale", -0.5, 0.5, "Added to the object's scale (pulse)."),
  objRotate: f("morph", "deg", -2200, 2200, "Rotation of the object, in degrees."),
};

/** Group of every field, in the order of `FIELDS`. */
export const FIELD_GROUPS: readonly FieldGroup[] = ["body", "parts", "eyes", "lids", "accessories", "flame", "morph"];

export const CURVE_NAMES = Object.keys(CURVES) as CurveName[];

/* ---------- types ---------- */

export type AnimationKeyframe = [number, number] | [number, number, CurveName];
export type AnimationTracks = Partial<Record<DeltaField, AnimationKeyframe[]>>;

export type AnimationDefinition =
  | { version: 1; kind: "reaction"; id: string; name: string; duration: number; tracks: AnimationTracks }
  | { version: 1; kind: "activity"; id: string; name: string; period: number; tracks: AnimationTracks }
  | { version: 1; kind: "mood"; id: string; name: string; pose: Partial<Record<DeltaField, number>> };

export type CompiledAnimation =
  | { kind: "reaction"; id: string; name: string; def: ReactionDef }
  | { kind: "activity"; id: string; name: string; def: ActivityDef }
  | { kind: "mood"; id: string; name: string; def: PartialDelta };

export const ANIMATION_LIMITS = {
  reactionDuration: [0.2, 10],
  activityPeriod: [0.3, 20],
  maxTracks: 24,
  maxKeyframes: 40,
  nameMax: 60,
} as const;

/** Fields a mood may not set: transformations, sparks, and anything that changes opacity or size. */
const MOOD_FORBIDDEN: ReadonlySet<DeltaField> = new Set<DeltaField>(["sparks", "opacity", "scale"]);

/* ---------- helpers ---------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const ID_RE = /^[a-z][a-zA-Z0-9]{1,39}$/;
const isField = (k: string): k is DeltaField => Object.prototype.hasOwnProperty.call(FIELD_INFO, k);

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** The valid field names closest to `name` (case-insensitive edit distance, substring matches first). */
export function closestFields(name: string, count = 3): DeltaField[] {
  const low = name.toLowerCase();
  return [...FIELDS]
    .map((k) => {
      const kl = k.toLowerCase();
      const sub = kl.includes(low) || low.includes(kl) ? -2 : 0;
      return { k, score: distance(low, kl) + sub };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((x) => x.k);
}

const num = (n: number) => Number(n.toFixed(3)).toString();

/* ---------- validation ---------- */

function checkTrack(
  at: string,
  field: DeltaField,
  kfs: unknown,
  errors: string[],
): AnimationKeyframe[] | null {
  if (!Array.isArray(kfs)) {
    errors.push(`${at}: must be an array of keyframes [t, value] or [t, value, curve]`);
    return null;
  }
  if (kfs.length < 2) {
    errors.push(`${at}: needs at least 2 keyframes`);
    return null;
  }
  if (kfs.length > ANIMATION_LIMITS.maxKeyframes) {
    errors.push(`${at}: ${kfs.length} keyframes, the limit is ${ANIMATION_LIMITS.maxKeyframes}`);
    return null;
  }
  const info = FIELD_INFO[field];
  const before = errors.length;
  const out: AnimationKeyframe[] = [];
  let last = -1;
  kfs.forEach((kf: unknown, i: number) => {
    const k = `${at}[${i}]`;
    if (!Array.isArray(kf) || (kf.length !== 2 && kf.length !== 3)) {
      errors.push(`${k}: must be [t, value] or [t, value, curve]`);
      return;
    }
    const [t, v, curve] = kf as unknown[];
    let ok = true;
    if (!isNum(t) || t < 0 || t > 1) {
      errors.push(`${k}: t must be a number between 0 and 1`);
      ok = false;
    } else {
      if (i === 0 && t !== 0) {
        errors.push(`${k}: the first keyframe must have t = 0`);
        ok = false;
      }
      if (t < last) {
        errors.push(`${k}: t = ${t} is smaller than the previous keyframe's (${last}); times must not decrease`);
        ok = false;
      }
      last = t;
    }
    if (!isNum(v) || v < info.min || v > info.max) {
      errors.push(`${k}: value for ${field} must be a number between ${info.min} and ${info.max} (${info.unit})`);
      ok = false;
    }
    if (curve !== undefined && (typeof curve !== "string" || !CURVE_NAMES.includes(curve as CurveName))) {
      errors.push(`${k}: curve must be one of ${CURVE_NAMES.map((c) => `"${c}"`).join(", ")}`);
      ok = false;
    }
    if (ok) out.push(curve === undefined ? [t as number, v as number] : [t as number, v as number, curve as CurveName]);
  });
  return errors.length > before ? null : out;
}

/** Checks the shape shared by reactions and activities; returns the tracks that are individually valid. */
function checkTracks(raw: unknown, errors: string[]): AnimationTracks | null {
  if (!isRecord(raw)) {
    errors.push("tracks: must be an object { fieldName: [[t, value], ...] }");
    return null;
  }
  const names = Object.keys(raw);
  if (names.length === 0) {
    errors.push("tracks: needs at least one track");
    return null;
  }
  if (names.length > ANIMATION_LIMITS.maxTracks) errors.push(`tracks: ${names.length} tracks, the limit is ${ANIMATION_LIMITS.maxTracks}`);
  const tracks: AnimationTracks = {};
  for (const name of names) {
    if (!isField(name)) {
      errors.push(`tracks.${name}: unknown field; closest valid names: ${closestFields(name).join(", ")}`);
      continue;
    }
    const t = checkTrack(`tracks.${name}`, name, raw[name], errors);
    if (t) tracks[name] = t;
  }
  // Valid tracks are returned even when others failed, so the later rules still report on them.
  return tracks;
}

const first = (t: AnimationKeyframe[]) => t[0];
const lastKf = (t: AnimationKeyframe[]) => t[t.length - 1];

/** Share of the duration (0..1) in which a track is not exactly zero, sampled 200 times. */
function activeShare(kfs: AnimationKeyframe[]): number {
  const fn = fromTracks({ holdGaze: kfs as Keyframe[] });
  let n = 0;
  for (let i = 0; i <= 200; i++) if (Math.abs(fn(i / 200).holdGaze ?? 0) > 1e-6) n++;
  return n / 201;
}

/** Checks any JSON value as an animation definition. Collects every problem; warnings never block. */
export function validateAnimation(input: unknown): ValidationResult<AnimationDefinition> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["(root): must be a JSON object"] };

  if (input.version !== 1) errors.push("version: must be the number 1");
  const kind = input.kind;
  if (kind !== "reaction" && kind !== "activity" && kind !== "mood") errors.push('kind: must be "reaction", "activity" or "mood"');
  if (typeof input.id !== "string" || !ID_RE.test(input.id)) errors.push("id: must be camelCase letters and digits, 2 to 40 characters, starting with a lowercase letter (for example sideEye)");
  let name = "";
  if (typeof input.name !== "string") errors.push("name: must be a string");
  else {
    name = input.name.trim();
    // eslint-disable-next-line no-control-regex
    if (name.length < 1 || name.length > ANIMATION_LIMITS.nameMax || /[\u0000-\u001f<>]/.test(name))
      errors.push(`name: must be 1 to ${ANIMATION_LIMITS.nameMax} printable characters, without < or >`);
  }

  const allowed =
    kind === "reaction"
      ? ["version", "kind", "id", "name", "duration", "tracks"]
      : kind === "activity"
        ? ["version", "kind", "id", "name", "period", "tracks"]
        : ["version", "kind", "id", "name", "pose"];
  if (kind === "reaction" || kind === "activity" || kind === "mood")
    for (const k of Object.keys(input)) if (!allowed.includes(k)) warnings.push(`${k}: unknown key for a ${kind}, ignored`);

  let value: AnimationDefinition | null = null;

  if (kind === "reaction" || kind === "activity") {
    const key = kind === "reaction" ? "duration" : "period";
    const [lo, hi] = kind === "reaction" ? ANIMATION_LIMITS.reactionDuration : ANIMATION_LIMITS.activityPeriod;
    const secs = input[key];
    if (!isNum(secs) || secs < lo || secs > hi) errors.push(`${key}: must be a number of seconds between ${lo} and ${hi}`);
    const tracks = checkTracks(input.tracks, errors);

    if (tracks) {
      for (const [field, kfs] of Object.entries(tracks) as Array<[DeltaField, AnimationKeyframe[]]>) {
        const at = `tracks.${field}`;
        const a = first(kfs)[1];
        const b = lastKf(kfs)[1];
        if (kind === "reaction") {
          if (a !== 0 || b !== 0)
            errors.push(`${at}: must start and end at 0 so the character returns to neutral (first value ${num(a)}, last value ${num(b)}); add a final keyframe back to 0`);
        } else {
          if (a !== b) errors.push(`${at}: the first and last values must be equal for a seamless loop (first ${num(a)}, last ${num(b)})`);
          if (lastKf(kfs)[0] !== 1) errors.push(`${at}: the last keyframe must have t = 1 (it is ${num(lastKf(kfs)[0])}) so the loop closes`);
        }
      }
      if (kind === "reaction") {
        const morph = (Object.keys(tracks) as DeltaField[]).filter((k) => FIELD_INFO[k].group === "morph");
        if (morph.length)
          warnings.push(`tracks use morph-group fields (${morph.join(", ")}); these belong to the transformation grammar (bubble, ring, check) and only look right when several of them are choreographed together`);
        const groups = new Set((Object.keys(tracks) as DeltaField[]).map((k) => FIELD_INFO[k].group));
        if (!groups.has("body") && !groups.has("eyes") && !groups.has("lids"))
          warnings.push("tracks: no body, eyes or lids track, so the reaction will barely be noticeable");
        const hg = tracks.holdGaze;
        if (hg && activeShare(hg) > 0.8)
          warnings.push("tracks.holdGaze: above 0 for more than 80% of the duration; the character will ignore what it is looking at for most of the reaction");
      }
    }
    if (!errors.length && tracks && isNum(secs))
      value = kind === "reaction"
        ? { version: 1, kind, id: input.id as string, name, duration: secs, tracks }
        : { version: 1, kind, id: input.id as string, name, period: secs, tracks };
  } else if (kind === "mood") {
    const pose = input.pose;
    if (!isRecord(pose)) errors.push("pose: must be an object { fieldName: number }");
    else {
      const names = Object.keys(pose);
      if (names.length === 0) errors.push("pose: needs at least one field");
      const clean: Partial<Record<DeltaField, number>> = {};
      for (const k of names) {
        if (!isField(k)) {
          errors.push(`pose.${k}: unknown field; closest valid names: ${closestFields(k).join(", ")}`);
          continue;
        }
        const info = FIELD_INFO[k];
        if (info.group === "morph" || MOOD_FORBIDDEN.has(k)) {
          errors.push(`pose.${k}: not allowed in a mood (moods cannot use the morph group, sparks, opacity or scale)`);
          continue;
        }
        const v = pose[k];
        if (!isNum(v) || v < info.min || v > info.max) errors.push(`pose.${k}: must be a number between ${info.min} and ${info.max} (${info.unit})`);
        else clean[k] = v;
      }
      if (!errors.length) value = { version: 1, kind, id: input.id as string, name, pose: clean };
    }
  }

  if (errors.length || !value) return { ok: false, errors: errors.length ? errors : ["(root): invalid animation"] };
  return { ok: true, value, warnings };
}

/* ---------- compile ---------- */

/** Turns a validated definition into what the library stores. */
export function compileAnimation(def: AnimationDefinition): CompiledAnimation {
  if (def.kind === "mood") return { kind: "mood", id: def.id, name: def.name, def: { ...def.pose } };
  const sample = fromTracks(def.tracks as Record<string, Keyframe[]>);
  if (def.kind === "reaction") return { kind: "reaction", id: def.id, name: def.name, def: { duration: def.duration, sample } };
  const period = def.period;
  return {
    kind: "activity",
    id: def.id,
    name: def.name,
    // Loop: t = (seconds % period) / period, kept positive for negative times.
    def: (seconds: number) => sample((((seconds % period) + period) % period) / period),
  };
}

/** JSON text → validated definition plus compiled entry. Never throws. */
export function parseAnimation(json: string): ValidationResult<{ definition: AnimationDefinition; compiled: CompiledAnimation }> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { ok: false, errors: [`(root): not valid JSON (${err instanceof Error ? err.message : String(err)})`] };
  }
  const v = validateAnimation(raw);
  if (!v.ok) return v;
  try {
    return { ok: true, value: { definition: v.value, compiled: compileAnimation(v.value) }, warnings: v.warnings };
  } catch (err) {
    return { ok: false, errors: [`(root): could not compile (${err instanceof Error ? err.message : String(err)})`] };
  }
}

/** Structural type so this file does not depend on library.ts. */
export function addToLibrary(
  lib: { reactions: Record<string, ReactionDef>; activities: Record<string, ActivityDef>; moods: Record<string, PartialDelta> },
  a: CompiledAnimation,
): void {
  if (a.kind === "reaction") lib.reactions[a.id] = a.def;
  else if (a.kind === "activity") lib.activities[a.id] = a.def;
  else lib.moods[a.id] = a.def;
}

/* ---------- description ---------- */

const GROUP_LABEL: Record<FieldGroup, string> = {
  body: "the body",
  parts: "the parts",
  eyes: "the eyes",
  lids: "the eyelids",
  accessories: "the accessories",
  flame: "the flame effects",
  morph: "the transformation",
};

/** One-paragraph plain-English summary: length, which groups move and the peak values. */
export function describeAnimation(def: AnimationDefinition): string {
  const peaks = (values: Array<[DeltaField, number]>): string => {
    const byGroup = new Map<FieldGroup, string[]>();
    for (const [field, peak] of values) {
      const info = FIELD_INFO[field];
      const list = byGroup.get(info.group) ?? [];
      list.push(`${field} reaches ${num(peak)}${info.unit === "px" ? " px" : info.unit === "deg" ? "°" : ""}`);
      byGroup.set(info.group, list);
    }
    return FIELD_GROUPS.filter((g) => byGroup.has(g))
      .map((g) => `${GROUP_LABEL[g]} (${byGroup.get(g)!.join(", ")})`)
      .join("; ");
  };
  const peakOf = (kfs: readonly AnimationKeyframe[]) => kfs.reduce((p, k) => (Math.abs(k[1]) > Math.abs(p) ? k[1] : p), 0);

  if (def.kind === "mood") {
    const entries = (Object.entries(def.pose) as Array<[DeltaField, number]>).filter(([, v]) => v !== 0);
    return `"${def.name}" is a mood: a held pose that blends with the other moods. It sets ${peaks(entries) || "nothing"}.`;
  }
  const entries = (Object.entries(def.tracks) as Array<[DeltaField, AnimationKeyframe[]]>).map(([k, v]): [DeltaField, number] => [k, peakOf(v)]);
  const moving = peaks(entries);
  if (def.kind === "reaction")
    return `"${def.name}" is a one-shot reaction of ${num(def.duration)} s that starts and ends at rest. It moves ${moving || "nothing"}.`;
  return `"${def.name}" is a loop that repeats every ${num(def.period)} s and joins up seamlessly. It moves ${moving || "nothing"}.`;
}
