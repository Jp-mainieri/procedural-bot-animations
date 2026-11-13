import type { AvatarDefinitionLike, EyePose, Pose } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface RenderOptions {
  color?: string;
  eyeColor?: string;
  /** Pixel size of the (square) mounted SVG. Default: fills the host via 100%/100%. */
  size?: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MountedRig {
  svg: SVGSVGElement;
  /** The body silhouette's bounding box in viewBox units, read once after mount via `getBBox`. */
  bounds: Bounds;
  applyPose(pose: Pose): void;
  destroy(): void;
}

function createEyeGroup(eyeColor: string): { group: SVGGElement; pill: SVGRectElement; arc: SVGPathElement } {
  const group = document.createElementNS(SVG_NS, "g");
  // Neutral pill eye: ~4 wide, 11 tall at scale 1 (per the Open Bot Avatar
  // contract's sizing) — a true stadium (flat sides, fully round caps, rx =
  // half the width), not an ellipse, matching the "pill" eyes both Open Bot
  // Avatar and DevBerry's own Berry use.
  const pill = document.createElementNS(SVG_NS, "rect");
  pill.setAttribute("x", "-2");
  pill.setAttribute("y", "-5.5");
  pill.setAttribute("width", "4");
  pill.setAttribute("height", "11");
  pill.setAttribute("rx", "2");
  pill.setAttribute("fill", eyeColor);
  // Happy arc: a simple upward stroke, same footprint as the pill.
  const arc = document.createElementNS(SVG_NS, "path");
  arc.setAttribute("d", "M -2.4 1.5 Q 0 -4.5 2.4 1.5");
  arc.setAttribute("fill", "none");
  arc.setAttribute("stroke", eyeColor);
  arc.setAttribute("stroke-width", "2");
  arc.setAttribute("stroke-linecap", "round");
  arc.setAttribute("opacity", "0");
  group.append(pill, arc);
  return { group, pill, arc };
}

function applyEyeTransform(group: SVGGElement, baseX: number, baseY: number, pose: EyePose): void {
  const openness = 1 - pose.shut;
  const sx = pose.scaleX;
  const sy = pose.scaleY * Math.max(openness, 0.04);
  group.setAttribute(
    "transform",
    `translate(${baseX + pose.offsetX} ${baseY + pose.offsetY}) rotate(${pose.rotate}) scale(${sx} ${sy})`,
  );
}

/**
 * Renders an Open-Bot-Avatar-shaped definition as our own SVG — one filled
 * body path plus two independently posable eye groups — instead of going
 * through `open-bot-avatar`'s own renderer/runtime. This is what lets the
 * procedural engine (moods, reactions, gaze) deform the eyes and body pose
 * every frame; Open Bot Avatar's JSON format is reused here only as the
 * *shape* input.
 */
export function mountRig(host: HTMLElement, definition: AvatarDefinitionLike, options: RenderOptions = {}): MountedRig {
  const { color = "#ff6a1a", eyeColor = "#151515" } = options;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  if (options.size) {
    svg.setAttribute("width", String(options.size));
    svg.setAttribute("height", String(options.size));
  }

  const bodyGroup = document.createElementNS(SVG_NS, "g");
  const bodyPath = document.createElementNS(SVG_NS, "path");
  bodyPath.setAttribute("d", definition.body.path);
  bodyPath.setAttribute("fill", color);
  bodyGroup.appendChild(bodyPath);

  const { eyes } = definition;
  const halfSpacing = eyes.spacing / 2;
  const leftBaseX = eyes.x - halfSpacing;
  const rightBaseX = eyes.x + halfSpacing;
  const baseY = eyes.y;

  const left = createEyeGroup(eyeColor);
  const right = createEyeGroup(eyeColor);
  left.group.setAttribute("transform", `translate(${leftBaseX} ${baseY}) scale(${eyes.scale})`);
  right.group.setAttribute("transform", `translate(${rightBaseX} ${baseY}) scale(${eyes.scale})`);

  svg.append(bodyGroup, left.group, right.group);
  host.appendChild(svg);

  // getBBox needs the element attached to a rendered document; in a headless
  // DOM (SSR, some test environments) this can throw — fall back to the
  // viewBox itself rather than crash the mount.
  let bounds: Bounds;
  try {
    const box = bodyPath.getBBox();
    bounds = { x: box.x, y: box.y, width: box.width, height: box.height };
  } catch {
    bounds = { x: 0, y: 0, width: 100, height: 100 };
  }

  function applyPose(pose: Pose): void {
    const { body } = pose;
    const pivotX = bounds.x + bounds.width / 2;
    const pivotY = bounds.y + bounds.height; // ground pivot: bottom of the silhouette
    bodyGroup.setAttribute(
      "transform",
      `translate(${body.x} ${body.y}) translate(${pivotX} ${pivotY}) rotate(${body.rotate}) scale(${body.scaleX} ${body.scaleY}) translate(${-pivotX} ${-pivotY})`,
    );

    applyEyeTransform(left.group, leftBaseX, baseY, pose.leftEye);
    applyEyeTransform(right.group, rightBaseX, baseY, pose.rightEye);

    left.pill.setAttribute("opacity", String(1 - pose.leftEye.arcAmount));
    left.arc.setAttribute("opacity", String(pose.leftEye.arcAmount));
    right.pill.setAttribute("opacity", String(1 - pose.rightEye.arcAmount));
    right.arc.setAttribute("opacity", String(pose.rightEye.arcAmount));
  }

  return {
    svg,
    bounds,
    applyPose,
    destroy() {
      host.removeChild(svg);
    },
  };
}
