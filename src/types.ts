/**
 * The slice of an Open Bot Avatar definition this engine needs: one
 * silhouette path plus eye placement, in a 0 0 100 100 viewBox (see
 * https://github.com/DominikScholz/open-bot-avatar/blob/main/docs/avatar-contract.md).
 * Written as a local, duck-typed interface — not imported from
 * `open-bot-avatar` — so this package has zero required runtime dependency
 * on it. Open Bot Avatar (its editor and `generate-avatar` skill) is used
 * only to *model* the shape; this engine renders and animates it itself.
 */
export interface AvatarDefinitionLike {
  body: { path: string };
  eyes: { x: number; y: number; spacing: number; scale: number };
}

export interface EyePose {
  /** Slide, in viewBox units, on top of the base eye position. */
  offsetX: number;
  offsetY: number;
  /** Multiplies the neutral eye size. 1 = neutral. */
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  rotate: number;
  /** 0 = fully open, 1 = fully shut (blink/squint-to-closed). */
  shut: number;
  /** 0..1 crossfade from the neutral pill shape to a happy upward arc. */
  arcAmount: number;
}

export interface BodyPose {
  /** Viewbox-unit translation, applied before any host-level transform. */
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
}

export interface Pose {
  body: BodyPose;
  leftEye: EyePose;
  rightEye: EyePose;
}

export function neutralEyePose(): EyePose {
  return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotate: 0, shut: 0, arcAmount: 0 };
}

export function neutralBodyPose(): BodyPose {
  return { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
}

export function neutralPose(): Pose {
  return { body: neutralBodyPose(), leftEye: neutralEyePose(), rightEye: neutralEyePose() };
}

/** Adds `delta` onto `base` in place, used to layer moods/reactions additively. Multiplicative fields (scale) multiply instead of add. */
export function addEyePose(base: EyePose, delta: Partial<EyePose>): EyePose {
  return {
    offsetX: base.offsetX + (delta.offsetX ?? 0),
    offsetY: base.offsetY + (delta.offsetY ?? 0),
    scaleX: base.scaleX * (delta.scaleX ?? 1),
    scaleY: base.scaleY * (delta.scaleY ?? 1),
    rotate: base.rotate + (delta.rotate ?? 0),
    shut: Math.max(base.shut, delta.shut ?? 0),
    arcAmount: Math.max(base.arcAmount, delta.arcAmount ?? 0),
  };
}

export function addBodyPose(base: BodyPose, delta: Partial<BodyPose>): BodyPose {
  return {
    x: base.x + (delta.x ?? 0),
    y: base.y + (delta.y ?? 0),
    rotate: base.rotate + (delta.rotate ?? 0),
    scaleX: base.scaleX * (delta.scaleX ?? 1),
    scaleY: base.scaleY * (delta.scaleY ?? 1),
  };
}

export function addPose(base: Pose, delta: PoseDelta): Pose {
  return {
    body: addBodyPose(base.body, delta.body ?? {}),
    leftEye: addEyePose(base.leftEye, delta.leftEye ?? {}),
    rightEye: addEyePose(base.rightEye, delta.rightEye ?? {}),
  };
}

export interface PoseDelta {
  body?: Partial<BodyPose>;
  leftEye?: Partial<EyePose>;
  rightEye?: Partial<EyePose>;
  /** Same delta applied to both eyes; merged before the per-eye fields above. */
  eyes?: Partial<EyePose>;
}

/** Resolves a `PoseDelta`'s `eyes` convenience field into both `leftEye`/`rightEye`. */
export function resolveDelta(delta: PoseDelta): Required<Pick<PoseDelta, "body" | "leftEye" | "rightEye">> {
  const eyes = delta.eyes ?? {};
  return {
    body: delta.body ?? {},
    leftEye: { ...eyes, ...(delta.leftEye ?? {}) },
    rightEye: { ...eyes, ...(delta.rightEye ?? {}) },
  };
}
