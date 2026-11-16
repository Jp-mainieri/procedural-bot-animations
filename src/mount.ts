import { Brain, type EyePose, type Pose } from "./brain.js";
import {
  type FocusState,
  type GazeMode,
  type Reason,
  decideGaze,
  newFocusState,
  observePage,
} from "./focus.js";
import type { Interactions } from "./interactions.js";
import type { Library } from "./library.js";
import { fmtNum } from "./motion.js";
import {
  type PathCommand,
  type Axis,
  axisOf,
  bendPath,
  circleLike,
  mixPath,
  parsePath,
} from "./parts.js";
import {
  ASPECT,
  CHECK,
  CODE,
  DOT_R,
  type EyeShape,
  type EyeStyle,
  HAPPY_EYE_PATH,
  ORBIT,
  type Point,
  ROUND_RADIUS,
  type Rig,
  type Role,
  SPARKS,
  SPARK_PATH,
  VIEWBOX_ATTR,
} from "./rig.js";
import { pointer, subscribe } from "./ticker.js";

/*
 * Renders a character as plain DOM: one SVG with separate pieces. The `Brain`
 * computes the pose every frame and `mountCharacter` writes it straight into
 * the attributes (no framework, no per-frame allocation beyond the strings).
 */

/** What the character looks at. A point or a function gives window px. */
export type GazeTarget =
  | "pointer"
  | "free"
  | "focus"
  | "none"
  | { x: number; y: number }
  | (() => { x: number; y: number } | null);

export type MountEvent = { type: "hover" | "click"; name: string };

export interface MountOptions {
  rig: Rig;
  /** Width in px; default: fills the host width. Below 48 px, it loses appendage sway and accessories. */
  size?: number;
  /** Body colour (any CSS colour). Default `#e11d2e`. */
  color?: string;
  /** Eye colour. Default `#0a0a0a`. */
  eyeColor?: string;
  /** Colour of the spark bursts' alternate sparks (the "success" green). Default `#157a3c`. */
  accentColor?: string;
  /** Colour of the accessories (`!`, `?`, `…`, zzz, lamp base). Default `#0a0a0a`. */
  inkColor?: string;
  /** Lamp bulb. Default `#facc15`. */
  lampColor?: string;
  /** Alert rays. Default `#f5b301`. */
  raysColor?: string;
  /** What the body mixes into when it loses its colour (`gray`), and the smoke. Default `#8a8a8a`. */
  grayColor?: string;
  eyeStyle?: EyeStyle;
  /** A mood name or a blend of weights. Default: neutral. */
  mood?: string | Record<string, number>;
  activity?: string | null;
  /** Where to look (default `'pointer'`). `null` and `'none'` only wander. */
  gaze?: GazeTarget | null;
  /** Hover hops and click/touch reacts. Off, the character is decorative. Default `true`. */
  interactive?: boolean;
  /** Appendage tips bend with physics. Default `true`. */
  bend?: boolean;
  /** `true` forces reduced motion; `'auto'` (default) follows `prefers-reduced-motion`; `false` ignores it. */
  reducedMotion?: boolean | "auto";
  /** Which appendages are drawn (default: all of the rig's). */
  appendages?: Role[];
  /** Light core always on (only rigs with `core`). */
  glow?: boolean;
  /** Alert rays always visible (streak milestones). */
  fixedRays?: boolean;
  /** Accessible name. Without it, the SVG is `aria-hidden`. */
  label?: string;
  className?: string;
  library?: Library;
  interactions?: Interactions;
  /** Called with the gesture drawn when the cursor enters or someone clicks. */
  onEvent?: (e: MountEvent) => void;
}

export type GazeState = {
  attention: number;
  boredom: number;
  /** In `free` and `focus` modes: wandering or with something holding the gaze. */
  mode: GazeMode | null;
  reason: Reason | null;
  /** How the eye is reaching the target: gliding or in a saccade. */
  gliding: boolean;
};

export interface MountedCharacter {
  readonly brain: Brain;
  /** The current root `<svg>` (it is rebuilt when the rig changes). */
  readonly svg: SVGSVGElement;
  update(patch: Partial<MountOptions>): void;
  /** Fires a reaction by name; `false` if the library does not know it. */
  react(name: string): boolean;
  jump(): void;
  /** Reaction in progress right now, for debugging. */
  currentReaction(): string | null;
  /** Gaze state in the last frame, for the debug meter. */
  getGazeState(): GazeState;
  destroy(): void;
}

const NS = "http://www.w3.org/2000/svg";

const BRAND_COLOR = "#e11d2e";
const DEFAULTS = {
  color: BRAND_COLOR,
  eyeColor: "#0a0a0a",
  accentColor: "#157a3c",
  inkColor: "#0a0a0a",
  lampColor: "#facc15",
  raysColor: "#f5b301",
  grayColor: "#8a8a8a",
} as const;

/** Embers rising from the tongues: lateral shift and colour of each one. */
const EMBERS = Array.from({ length: 7 }, (_, i) => ({
  dx: Math.sin(i * 2.4) * 150,
  color: i % 2 ? "#fbbf24" : "#fb923c",
}));
const SMOKE_PUFFS = 4;

let instances = 0;

type Attrs = Record<string, string | number>;
function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Element[] = [],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  for (const c of children) el.appendChild(c);
  return el;
}

/** `translate(p) inside translate(-p)`: transforms around a point. */
const around = (p: Point, inside: string) =>
  `translate(${p.x} ${p.y}) ${inside} translate(${-p.x} ${-p.y})`;

const n = fmtNum;

type Appendage = {
  role: Role;
  g: SVGGElement;
  path: SVGPathElement;
  cmds: PathCommand[];
  axis: Axis;
  pivot: Point;
  lastBend: number;
};

type EyeParts = {
  g: SVGGElement;
  open: SVGRectElement;
  arc: SVGPathElement;
  clip: SVGPolygonElement;
};

type Parts = {
  shadow: SVGEllipseElement;
  root: SVGGElement;
  center: SVGGElement;
  body: SVGGElement;
  scale: SVGGElement;
  bodyPath: SVGPathElement;
  partsGroup: SVGGElement;
  appendages: Appendage[];
  core: SVGPathElement | null;
  eyes: [EyeParts, EyeParts];
  smoke: SVGGElement;
  smokeEls: SVGCircleElement[];
  embers: SVGGElement;
  emberEls: SVGCircleElement[];
  object: SVGGElement;
  orbit: SVGGElement;
  orbitEls: SVGCircleElement[];
  check: SVGPathElement;
  code: SVGGElement;
  codeEls: SVGPathElement[];
  sides: SVGCircleElement[];
  bubble: SVGCircleElement;
  lamp: SVGGElement;
  exclaim: SVGGElement;
  question: SVGGElement;
  rays: SVGGElement;
  ellipsis: SVGGElement;
  ellipsisEls: SVGElement[];
  zzz: SVGGElement;
  zzzEls: SVGElement[];
  sparks: SVGGElement;
  sparkEls: SVGPathElement[];
};

/** Settings with the defaults applied. */
type Resolved = {
  rig: Rig;
  size: number | undefined;
  color: string;
  eyeStyle: EyeStyle;
  gaze: GazeTarget;
  interactive: boolean;
  bend: boolean;
  reducedMotion: boolean | "auto";
  glow: boolean;
  fixedRays: boolean;
  grayColor: string;
  mood: Record<string, number>;
  activity: string | null;
};

function normalizeMood(m: string | Record<string, number> | undefined): Record<string, number> {
  if (!m) return { neutral: 1 };
  return typeof m === "string" ? { [m]: 1 } : m;
}

/**
 * Mounts an animated character inside `host`. The returned handle updates the
 * options live (`update`), fires reactions by hand and cleans everything up
 * (`destroy`).
 */
export function mountCharacter(host: HTMLElement, options: MountOptions): MountedCharacter {
  const uid = `pba${++instances}`;
  let raw: MountOptions = { ...options };
  let cur: Resolved = resolve(raw);

  const brain = new Brain(cur.rig, {
    library: raw.library,
    interactions: raw.interactions,
    now: performance.now(),
  });

  let svg!: SVGSVGElement;
  let parts!: Parts;
  let roundGeo!: { body: PathCommand[]; circle: PathCommand[] };
  let lastColor = "";
  let lastRound = -1;
  let lastPose: Pose | null = null;
  let hovering = false;
  let touchTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  const gazeState: GazeState = {
    attention: 0,
    boredom: 0,
    mode: null,
    reason: null,
    gliding: false,
  };

  function resolve(o: MountOptions): Resolved {
    return {
      rig: o.rig,
      size: o.size,
      color: o.color ?? DEFAULTS.color,
      eyeStyle: o.eyeStyle ?? "classic",
      gaze: o.gaze ?? (o.gaze === null ? "none" : "pointer"),
      interactive: o.interactive ?? true,
      bend: o.bend ?? true,
      reducedMotion: o.reducedMotion ?? "auto",
      glow: o.glow ?? false,
      fixedRays: o.fixedRays ?? false,
      grayColor: o.grayColor ?? DEFAULTS.grayColor,
      mood: normalizeMood(o.mood),
      activity: o.activity ?? null,
    };
  }

  /* ---------- building the SVG ---------- */

  function build() {
    const rig = cur.rig;
    const ink = raw.inkColor ?? DEFAULTS.inkColor;
    const eyeColor = raw.eyeColor ?? DEFAULTS.eyeColor;
    const accent = raw.accentColor ?? DEFAULTS.accentColor;
    const gray = cur.grayColor;
    const visible = rig.appendages.filter((a) => !raw.appendages || raw.appendages.includes(a.role));
    const bodyCmds = parsePath(rig.body);
    roundGeo = { body: bodyCmds, circle: circleLike(bodyCmds, rig.anchor, ROUND_RADIUS) };

    const clipId = (side: "l" | "r") => `${uid}-lid-${side}`;
    const sides = ["l", "r"] as const;
    const defs = node(
      "defs",
      {},
      [
        ...sides.map((l) =>
          node("clipPath", { id: clipId(l), clipPathUnits: "userSpaceOnUse" }, [
            node("polygon", { points: "-200,-200 200,-200 200,200 -200,200" }),
          ]),
        ),
        ...(rig.core
          ? [
              node(
                "radialGradient",
                { id: `${uid}-glow`, cx: 0.5, cy: 0.75, r: 0.6 },
                [
                  node("stop", { offset: 0, "stop-color": "#fde047" }),
                  node("stop", { offset: 0.55, "stop-color": "#fb923c", "stop-opacity": 0.9 }),
                  node("stop", { offset: 1, "stop-color": "#fb923c", "stop-opacity": 0 }),
                ],
              ),
            ]
          : []),
      ],
    );

    const shadow = node("ellipse", {
      cx: rig.shadow.x,
      cy: rig.shadow.y,
      rx: rig.shadow.rx,
      ry: rig.shadow.ry,
      fill: "currentColor",
      opacity: 0.14,
    });

    const bodyPath = node("path", { d: rig.body });
    const partsGroup = node("g");
    const appendages: Appendage[] = visible.map((a) => {
      const path = node("path", { d: a.path });
      const g = node("g", {}, [path]);
      partsGroup.appendChild(g);
      return {
        role: a.role,
        g,
        path,
        cmds: parsePath(a.path),
        axis: axisOf(a),
        pivot: a.pivot,
        lastBend: 0,
      };
    });
    const core = rig.core
      ? node("path", {
          d: rig.core,
          fill: `url(#${uid}-glow)`,
          opacity: cur.glow ? 1 : 0,
        })
      : null;
    const eyes = sides.map((l): EyeParts => {
      const open = node("rect", { "clip-path": `url(#${clipId(l)})` });
      const arc = node("path", { d: HAPPY_EYE_PATH, opacity: 0 });
      const g = node("g", { fill: eyeColor }, [open, arc]);
      const clip = defs.querySelector(`#${clipId(l)} polygon`) as SVGPolygonElement;
      return { g, open, arc, clip };
    }) as [EyeParts, EyeParts];
    const smokeEls = Array.from({ length: SMOKE_PUFFS }, () =>
      node("circle", { r: 46, opacity: 0 }),
    );
    const smoke = node("g", { opacity: 0, fill: gray }, smokeEls);
    const emberEls = EMBERS.map((b) => node("circle", { r: 16, fill: b.color, opacity: 0 }));
    const embers = node("g", { opacity: 0 }, emberEls);
    const scale = node("g", {}, [
      bodyPath,
      partsGroup,
      ...(core ? [core] : []),
      eyes[0].g,
      eyes[1].g,
      smoke,
      embers,
    ]);

    // Transformation object, in the body's system (it squashes and turns with it).
    // At the swap, the bubble covers the round body exactly.
    const orbitEls = ORBIT.radii.map((r) => node("circle", { r }));
    const orbit = node("g", { visibility: "hidden", fill: "currentColor", stroke: "none" }, orbitEls);
    const check = node("path", {
      d: CHECK.path,
      "stroke-width": CHECK.width,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-dasharray": `${CHECK.length} ${CHECK.length + 1}`,
      visibility: "hidden",
    });
    const codeEls = CODE.strokes.map((d, i) =>
      node("path", { d, "stroke-dasharray": `${CODE.lengths[i]} ${CODE.lengths[i] + 1}` }),
    );
    const code = node(
      "g",
      { visibility: "hidden", "stroke-width": CODE.radius * 2, "stroke-linecap": "round" },
      codeEls,
    );
    const sideDots = [0, 1].map(() =>
      node("circle", { r: DOT_R, fill: "currentColor", stroke: "none" }),
    );
    const bubble = node("circle", {
      r: DOT_R / 2,
      "stroke-width": DOT_R,
      "stroke-linecap": "round",
    });
    const object = node(
      "g",
      { visibility: "hidden", stroke: "currentColor", fill: "none" },
      [orbit, check, code, ...sideDots, bubble],
    );
    const body = node("g", { fill: "currentColor" }, [scale, object]);
    const center = node("g", {}, [body]);

    // Accessories follow the jump; ink colour.
    const lamp = node("g", { opacity: 0 }, [
      node("circle", { cx: 0, cy: -20, r: 42, fill: raw.lampColor ?? DEFAULTS.lampColor }),
      node("rect", { x: -20, y: 18, width: 40, height: 30, rx: 8 }),
      node("path", {
        d: "M0,-90 V-110 M-58,-66 L-72,-80 M58,-66 L72,-80",
        stroke: ink,
        "stroke-width": 10,
        "stroke-linecap": "round",
      }),
    ]);
    const exclaim = node("g", { opacity: 0 }, [
      node("rect", { x: -14, y: -110, width: 28, height: 84, rx: 14 }),
      node("circle", { cx: 0, cy: 4, r: 16 }),
    ]);
    const question = node("g", { opacity: 0 }, [
      node("path", {
        d: "M-40,-70 C-40,-110 40,-110 40,-70 C40,-40 6,-36 6,-6",
        fill: "none",
        stroke: ink,
        "stroke-width": 26,
        "stroke-linecap": "round",
      }),
      node("circle", { cx: 6, cy: 34, r: 15 }),
    ]);
    const rays = node("g", { opacity: 0 }, [
      node("path", {
        d: "M-30,-40 L-10,-110 M20,-10 L90,-60 M30,40 L105,32",
        stroke: raw.raysColor ?? DEFAULTS.raysColor,
        "stroke-width": 26,
        "stroke-linecap": "round",
        fill: "none",
      }),
    ]);
    const ellipsisEls: SVGElement[] = [
      node("circle", { cx: 0, cy: 0, r: 16 }),
      node("circle", { cx: 48, cy: -22, r: 20 }),
      node("circle", { cx: 104, cy: -52, r: 25 }),
    ];
    const ellipsis = node("g", { opacity: 0, transform: "translate(840 340)" }, ellipsisEls);
    const zzzEls: SVGElement[] = [0, 1, 2].map(() =>
      node("g", { opacity: 0 }, [
        node("path", {
          transform: "translate(800 380)",
          d: "M-22,-22 H22 L-22,22 H22",
          fill: "none",
          stroke: ink,
          "stroke-width": 10,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
      ]),
    );
    const zzz = node("g", { opacity: 0 }, zzzEls);
    const inkGroup = node("g", { fill: ink }, [lamp, exclaim, question, rays, ellipsis, zzz]);

    const root = node("g", {}, [center, inkGroup]);

    const sparkEls = SPARKS.map((sp) =>
      node("path", { d: SPARK_PATH, fill: sp.alt ? accent : "currentColor" }),
    );
    const sparks = node("g", { visibility: "hidden" }, sparkEls);

    const el = node("svg", { viewBox: VIEWBOX_ATTR }, [defs, shadow, root, sparks]);
    el.style.display = "block";
    el.style.flexShrink = "0";
    el.style.overflow = "visible";
    el.style.userSelect = "none";

    if (svg) {
      io?.unobserve(svg);
      svg.removeEventListener("pointerenter", onEnter);
      svg.removeEventListener("pointerleave", onLeave);
      svg.removeEventListener("pointerdown", onDown);
      svg.replaceWith(el);
    } else host.appendChild(el);
    svg = el;
    parts = {
      shadow,
      root,
      center,
      body,
      scale,
      bodyPath,
      partsGroup,
      appendages,
      core,
      eyes,
      smoke,
      smokeEls,
      embers,
      emberEls,
      object,
      orbit,
      orbitEls,
      check,
      code,
      codeEls,
      sides: sideDots,
      bubble,
      lamp,
      exclaim,
      question,
      rays,
      ellipsis,
      ellipsisEls,
      zzz,
      zzzEls,
      sparks,
      sparkEls,
    };
    svg.addEventListener("pointerenter", onEnter);
    svg.addEventListener("pointerleave", onLeave);
    svg.addEventListener("pointerdown", onDown);
    lastColor = "";
    lastRound = -1;
    applyAttrs();
    applyEyeShape();
    io?.observe(svg);
    // A complete first pose, synchronously: colours, eyes and appendages are
    // never left unposed, even off-screen, paused or in a hidden tab.
    if (lastPose) render(lastPose);
    else paintNow();
  }

  /** Attributes that can change without rebuilding. */
  function applyAttrs() {
    const size = cur.size;
    if (size !== undefined) {
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(Math.round(size * ASPECT)));
      svg.style.width = "";
      svg.style.height = "";
    } else {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "100%";
      svg.style.height = "auto";
    }
    if (raw.label) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", raw.label);
      svg.removeAttribute("aria-hidden");
    } else {
      svg.setAttribute("aria-hidden", "true");
      svg.removeAttribute("role");
      svg.removeAttribute("aria-label");
    }
    if (raw.className !== undefined) svg.setAttribute("class", raw.className);
    else svg.removeAttribute("class");
    svg.style.cursor = cur.interactive ? "pointer" : "";
    svg.style.touchAction = cur.interactive ? "manipulation" : "";
    if (parts.core) parts.core.setAttribute("opacity", cur.glow ? "1" : "0");
  }

  /** The eye's resting shape: written once, not every frame. */
  function applyEyeShape() {
    const shape = cur.rig.eyeStyles[cur.eyeStyle];
    for (const { open } of parts.eyes) {
      open.setAttribute("x", String(-shape.w / 2));
      open.setAttribute("y", String(-shape.h / 2));
      open.setAttribute("width", String(shape.w));
      open.setAttribute("height", String(shape.h));
      open.setAttribute("rx", String(shape.w / 2));
    }
  }

  /* ---------- writing the pose ---------- */

  /** Writes one eye's pose: position, scale, eyelids (clip) and happy arc. */
  function applyEye(eye: EyeParts, base: Point, shape: EyeShape, o: EyePose) {
    eye.g.setAttribute(
      "transform",
      `translate(${n(base.x + o.x)} ${n(base.y + o.y)}) rotate(${n(shape.tilt + o.rot)}) scale(${n(o.sx)} ${n(o.sy)})`,
    );
    const { w, h } = shape;
    // Eyelids: a line on top and another below; the clip is what is left between them.
    const k = Math.tan((o.lidAngle * Math.PI) / 180) * Math.min(1, o.lidTop * 4);
    const yTop = -h / 2 - 2 + o.lidTop * (h + 2);
    const yBot = Math.max(yTop + 1, h / 2 + 2 - o.lidBottom * (h + 2));
    eye.clip.setAttribute(
      "points",
      `${-w},${n(yTop - k * w)} ${w},${n(yTop + k * w)} ${w},${n(yBot)} ${-w},${n(yBot)}`,
    );
    eye.open.setAttribute("opacity", n(1 - Math.min(1, o.happy * 1.6)));
    eye.arc.setAttribute("opacity", n(Math.max(0, o.happy * 1.6 - 0.6)));
    // The arc does not follow the eye's `sy` (otherwise the blink would erase it).
    eye.arc.setAttribute(
      "transform",
      `scale(${n(w / 80)} ${n(((0.6 + 0.4 * o.happy) * (w / 80)) / Math.max(o.sy, 0.2))})`,
    );
  }

  function render(pose: Pose) {
    const p = parts;
    const rig = cur.rig;
    const { ground, center, accessory, anchor } = rig;
    p.root.setAttribute("transform", `translate(0 ${n(pose.rootY)})`);
    p.root.setAttribute("opacity", n(pose.opacity));
    p.center.setAttribute("transform", around(center, `rotate(${n(pose.centerRotate)})`));
    p.body.setAttribute(
      "transform",
      around(ground, `rotate(${n(pose.bodyRotate)}) scale(${n(pose.bodySx)} ${n(pose.bodySy)})`),
    );
    // Scale is around the ground; during the transformation, around the anchor.
    const pivot = {
      x: ground.x + (anchor.x - ground.x) * pose.morph,
      y: ground.y + (anchor.y - ground.y) * pose.morph,
    };
    p.scale.setAttribute("transform", around(pivot, `scale(${n(pose.scale)})`));
    const asObject = pose.swap >= 0.5;
    p.scale.setAttribute("visibility", asObject ? "hidden" : "visible");
    p.object.setAttribute("visibility", asObject ? "visible" : "hidden");
    const round = Math.min(1, Math.max(0, pose.round));
    if (Math.abs(round - lastRound) > 0.0005 || (round === 0) !== (lastRound === 0)) {
      p.bodyPath.setAttribute(
        "d",
        round === 0 ? rig.body : mixPath(roundGeo.body, roundGeo.circle, round),
      );
      lastRound = round;
    }
    p.partsGroup.setAttribute("transform", `translate(${n(pose.partsX)} 0)`);

    for (const a of p.appendages) {
      const angle = a.role === "C" ? pose.partC : a.role === "L" ? pose.partL : pose.partR;
      const bend = a.role === "C" ? pose.bendC : a.role === "L" ? pose.bendL : pose.bendR;
      a.g.setAttribute(
        "transform",
        around(a.pivot, `rotate(${n(angle)}) scale(${n(Math.max(0, 1 - pose.retract))})`),
      );
      if (Math.abs(bend - a.lastBend) >= 0.08) {
        a.lastBend = bend;
        a.path.setAttribute("d", bendPath(a.cmds, a.axis, bend));
      }
    }

    const shape = rig.eyeStyles[cur.eyeStyle];
    applyEye(
      p.eyes[0],
      { x: rig.eyes.left.x + shape.dx, y: rig.eyes.left.y + shape.dy },
      shape,
      pose.leftEye,
    );
    applyEye(
      p.eyes[1],
      { x: rig.eyes.right.x - shape.dx, y: rig.eyes.right.y + shape.dy },
      shape,
      pose.rightEye,
    );

    // Loses its colour (put out, at risk): mixes with gray.
    const nowColor =
      pose.gray > 0.005
        ? `color-mix(in oklab, ${cur.color}, ${cur.grayColor} ${Math.round(pose.gray * 100)}%)`
        : cur.color;
    if (nowColor !== lastColor) {
      svg.style.color = nowColor;
      lastColor = nowColor;
    }
    p.core?.setAttribute("opacity", n(Math.max(cur.glow ? 1 : 0, pose.core) * (1 - pose.gray)));

    // Embers and smoke come off the tip of the middle tongue, in a loop.
    const top = rig.appendages.find((a) => a.role === "C")?.tip ?? accessory;
    const tb = pose.time;
    p.embers.setAttribute("opacity", n(pose.embers));
    if (pose.embers > 0)
      p.emberEls.forEach((el, i) => {
        const u = (tb * 0.8 + i / EMBERS.length) % 1;
        const x = top.x + EMBERS[i].dx * u + Math.sin(tb * 3 + i) * 16;
        const y = top.y + 220 - u * 420;
        el.setAttribute("transform", `translate(${n(x)} ${n(y)}) scale(${n(1 - 0.7 * u)})`);
        el.setAttribute("opacity", n(Math.sin(u * Math.PI)));
      });
    p.smoke.setAttribute("opacity", n(pose.smoke));
    if (pose.smoke > 0)
      p.smokeEls.forEach((el, i) => {
        const u = (tb * 0.45 + i / SMOKE_PUFFS) % 1;
        const x = top.x + Math.sin(u * 5 + i) * 40 + u * 60;
        const y = top.y + 60 - u * 320;
        el.setAttribute("transform", `translate(${n(x)} ${n(y)}) scale(${n(0.5 + u)})`);
        el.setAttribute("opacity", n(0.5 * Math.sin(u * Math.PI)));
      });

    p.shadow.setAttribute("transform", around(rig.shadow, `scale(${n(pose.shadowScale)})`));
    p.shadow.setAttribute("opacity", n(pose.shadowOpacity));

    // Sparks: leave the center, spin and fade.
    const f = pose.sparks;
    p.sparks.setAttribute("visibility", f > 0 ? "visible" : "hidden");
    if (f > 0) {
      const e = 1 - (1 - f) ** 3;
      const op = f < 0.25 ? f / 0.25 : 1 - (f - 0.25) / 0.75;
      p.sparkEls.forEach((el, i) => {
        const { dx, dy } = SPARKS[i];
        el.setAttribute(
          "transform",
          `translate(${n(center.x + dx * e)} ${n(center.y + dy * e)}) rotate(${n(f * 90)}) scale(${n(1 - 0.4 * f)})`,
        );
        el.setAttribute("opacity", n(op));
      });
    }

    const pop = (g: SVGGElement, v: number, extra = "") => {
      g.setAttribute("opacity", n(v));
      g.setAttribute(
        "transform",
        `translate(${accessory.x} ${accessory.y}) scale(${n(0.6 + 0.4 * v)}) ${extra}`,
      );
    };
    const t = pose.time;
    pop(p.lamp, pose.lamp, `rotate(${n(Math.sin(t * 3) * 6)})`);
    pop(p.exclaim, pose.exclaim, `rotate(${n(Math.sin(t * 30) * 4 * pose.exclaim)})`);
    pop(p.question, pose.question, `rotate(${n(Math.sin(t * 2) * 10)})`);
    const rays = cur.fixedRays ? Math.max(pose.rays, 1) : pose.rays;
    pop(p.rays, rays, `scale(${n(1 + Math.sin(t * 5) * 0.06)})`);

    p.ellipsis.setAttribute("opacity", n(pose.ellipsis));
    p.ellipsisEls.forEach((el, i) => {
      const u = (t * 0.9 - i * 0.18) % 1;
      const v = u < 0 ? 0 : Math.sin(Math.min(1, u / 0.6) * Math.PI);
      el.setAttribute("transform", `translate(0 ${n(-v * 16)})`);
      el.setAttribute("opacity", n(0.35 + 0.65 * v));
    });

    p.zzz.setAttribute("opacity", n(pose.zzz));
    p.zzzEls.forEach((el, i) => {
      const u = (t * 0.35 + i / 3) % 1;
      el.setAttribute(
        "transform",
        `translate(${n(u * 70 + Math.sin(u * 6 + i) * 10)} ${n(-u * 150)}) scale(${n(0.6 + u * 0.6)})`,
      );
      el.setAttribute("opacity", n(Math.sin(u * Math.PI)));
    });

    /* ---------- object (transformation) ---------- */
    if (asObject) {
      const R = Math.max(0, pose.bubbleR);
      const hole = Math.min(R, Math.max(0, pose.bubbleHole));
      p.object.setAttribute(
        "transform",
        `translate(${anchor.x} ${anchor.y}) scale(${n(1 + pose.objScale)})`,
      );
      // Bouncing dots: the middle one is the bubble itself.
      const bounce = (i: number) =>
        -Math.max(0, Math.sin(t * 9 - i * 0.9)) * 26 * Math.max(0, pose.dotsBounce);
      // Bubble: a stroked circle. With no hole, the stroke covers center to edge (a disc).
      const r = (R + hole) / 2;
      const C = 2 * Math.PI * r;
      const b = p.bubble;
      b.setAttribute("r", n(r));
      b.setAttribute("stroke-width", n(R - hole));
      b.setAttribute(
        "stroke-dasharray",
        `${n(C * (1 - Math.max(0, pose.bubbleArc)))} ${n(C + 1)}`,
      );
      b.setAttribute(
        "transform",
        `translate(${n(pose.bubbleX)} ${n(pose.bubbleY + bounce(1))}) rotate(${n(pose.objRotate - 90)})`,
      );
      p.sides.forEach((el, i) => {
        const side = i === 0 ? -1 : 1;
        el.setAttribute("r", n(R));
        el.setAttribute(
          "transform",
          `translate(${n(pose.bubbleX + side * pose.dotsDist)} ${n(pose.bubbleY + bounce(i === 0 ? 0 : 2))})`,
        );
      });
      const ck = pose.checkDraw;
      p.check.setAttribute("visibility", ck > 0 ? "visible" : "hidden");
      p.check.setAttribute("stroke-dashoffset", n(CHECK.length * (1 - ck)));
      const cd = pose.codeDraw;
      p.code.setAttribute("visibility", cd > 0 ? "visible" : "hidden");
      p.codeEls.forEach((el, i) =>
        el.setAttribute("stroke-dashoffset", n(CODE.lengths[i] * (1 - cd))),
      );
      const open = Math.max(0, pose.orbitOpen);
      p.orbit.setAttribute("visibility", open > 0 ? "visible" : "hidden");
      if (open > 0)
        p.orbitEls.forEach((el, i) => {
          const ang = (i / ORBIT.radii.length) * Math.PI * 2 + (pose.objRotate * Math.PI) / 180;
          const dist = (ORBIT.R + Math.sin(t * 6 + i) * 24) * open;
          el.setAttribute("r", n(R + (ORBIT.radii[i] - R) * Math.min(1, open)));
          el.setAttribute(
            "transform",
            `translate(${n(pose.bubbleX + Math.cos(ang) * dist)} ${n(pose.bubbleY + Math.sin(ang) * dist)})`,
          );
        });
    }
  }

  /* ---------- frame ---------- */

  const media =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  let systemReduced = media?.matches ?? false;
  const onMedia = () => (systemReduced = media?.matches ?? false);
  media?.addEventListener("change", onMedia);

  const focus: FocusState = newFocusState();
  let stopPage: (() => void) | null = null;
  /** The page observer only runs while a `free`/`focus` gaze needs it. */
  function syncPageObserver() {
    const need = cur.gaze === "free" || cur.gaze === "focus";
    if (need && !stopPage) stopPage = observePage();
    else if (!need && stopPage) {
      stopPage();
      stopPage = null;
    }
  }

  function frame(now: number) {
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.6;
    const recent = pointer.inside && now - pointer.last < 2500;
    // Cursor near the character: draws attention (and, right on top, crosses the eyes).
    const proximity = recent
      ? Math.min(1, Math.max(0, 1 - Math.hypot(pointer.x - cx, pointer.y - cy) / (r.width * 1.8)))
      : 0;
    let target: { x: number; y: number } | null = null;
    let point: { x: number; y: number } | null = null;
    let interest = 0;
    let glide: number | undefined;
    const gs = gazeState;
    gs.mode = gs.reason = null;
    const g = cur.gaze;
    if (g === "pointer") {
      // Recent pointer, or outside the window: looks at the edge it left through.
      if (!pointer.inside || recent) point = pointer;
    } else if (g === "free" || g === "focus") {
      const l = decideGaze(focus, now, Math.random, r, pointer, g);
      interest = l.interest;
      glide = l.glide || undefined;
      gs.mode = l.mode;
      gs.reason = l.reason;
      if (l.point === "screen") target = { x: 0, y: 0.05 };
      else point = l.point;
    } else if (typeof g === "function") point = g();
    else if (typeof g === "object") point = g;
    if (point) {
      target = {
        x: (point.x - cx) / (window.innerWidth * 0.35),
        y: (point.y - cy) / (window.innerHeight * 0.35),
      };
    }
    gs.gliding = !!glide;
    // An unmeasured host (off-screen, hidden, not laid out yet) reads as width 0: assume full detail.
    const width = cur.size ?? r.width;
    const detail = width > 0 && width < 48 ? "simple" : "full";
    const reduced = cur.reducedMotion === "auto" ? systemReduced : cur.reducedMotion;
    const pose = brain.step(now, {
      gaze: target,
      hover: hovering,
      reduced,
      mood: cur.mood,
      activity: cur.activity,
      detail,
      bend: cur.bend,
      interest,
      glide,
      proximity: g === "none" ? 0 : proximity,
    });
    gs.attention = pose.attention;
    gs.boredom = pose.boredom;
    lastPose = pose;
    render(pose);
  }

  /** Steps the brain once and paints, outside the ticker (the first frame). */
  function paintNow() {
    frame(performance.now());
  }

  /* ---------- running only when on screen and the tab is visible ---------- */

  let onScreen = typeof IntersectionObserver === "undefined";
  let tabVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
  let unsubscribe: (() => void) | null = null;
  function syncRunning() {
    const should = !destroyed && onScreen && tabVisible;
    if (should && !unsubscribe) {
      // Frames were not running: do not integrate across the gap.
      brain.resume();
      unsubscribe = subscribe(frame);
    }
    else if (!should && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }
  const io =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1].isIntersecting;
          syncRunning();
        });
  const onVisibility = () => {
    tabVisible = document.visibilityState !== "hidden";
    syncRunning();
  };
  document.addEventListener("visibilitychange", onVisibility);

  /* ---------- interaction ---------- */

  function onEnter(e: PointerEvent) {
    if (!cur.interactive || e.pointerType !== "mouse") return;
    hovering = true;
    const gesture = brain.hoverEnter(performance.now());
    if (gesture) raw.onEvent?.({ type: "hover", name: gesture });
  }
  function onLeave() {
    hovering = false;
  }
  function onDown(e: PointerEvent) {
    if (!cur.interactive) return;
    raw.onEvent?.({ type: "click", name: brain.tap(performance.now()) });
    if (e.pointerType !== "mouse") {
      hovering = true;
      if (touchTimer) clearTimeout(touchTimer);
      touchTimer = setTimeout(() => (hovering = false), 900);
    }
  }

  /* ---------- start ---------- */

  build();
  syncPageObserver();
  syncRunning();

  return {
    brain,
    get svg() {
      return svg;
    },
    update(patch) {
      if (destroyed) return;
      const before = cur;
      const beforeRaw = raw;
      raw = { ...raw, ...patch };
      cur = resolve(raw);
      if (cur.rig !== before.rig) brain.setConfig(cur.rig);
      if (raw.library !== beforeRaw.library) brain.setLibrary(raw.library);
      if (raw.interactions !== beforeRaw.interactions) brain.setInteractions(raw.interactions);
      const rebuild =
        cur.rig !== before.rig ||
        raw.appendages !== beforeRaw.appendages ||
        raw.eyeColor !== beforeRaw.eyeColor ||
        raw.inkColor !== beforeRaw.inkColor ||
        raw.accentColor !== beforeRaw.accentColor ||
        raw.lampColor !== beforeRaw.lampColor ||
        raw.raysColor !== beforeRaw.raysColor ||
        cur.grayColor !== before.grayColor;
      if (rebuild) build();
      else {
        applyAttrs();
        if (cur.eyeStyle !== before.eyeStyle) applyEyeShape();
        if (cur.color !== before.color) lastColor = "";
      }
      syncPageObserver();
    },
    react: (name) => brain.react(name, performance.now()),
    jump: () => brain.jump(),
    currentReaction: () => brain.currentReaction,
    getGazeState: () => ({ ...gazeState }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      syncRunning();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      media?.removeEventListener("change", onMedia);
      stopPage?.();
      stopPage = null;
      if (touchTimer) clearTimeout(touchTimer);
      svg.removeEventListener("pointerenter", onEnter);
      svg.removeEventListener("pointerleave", onLeave);
      svg.removeEventListener("pointerdown", onDown);
      svg.remove();
    },
  };
}
