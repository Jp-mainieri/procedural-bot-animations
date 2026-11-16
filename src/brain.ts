import { MOTION_FIELDS, type Delta, addDelta, zeroDelta } from "./delta.js";
import { Gaze } from "./gaze.js";
import {
  CLICK_CHAIN_INTERVAL_MS,
  HOVER_CUDDLE_MS,
  HOVER_NAP_MS,
  INTERACTIONS,
  type Gesture,
  type Interactions,
  pickGesture,
} from "./interactions.js";
import { DEFAULT_LIBRARY, type Library } from "./library.js";
import {
  type Damped,
  type Jump,
  type Rng,
  type Spring,
  type Squash,
  atRest,
  clamp,
  launch,
  newBlink,
  newDamped,
  newHold,
  smooth,
  smoothDamp,
  spring,
  stepBlink,
  stepHold,
  stepJump,
} from "./motion.js";
import { stepTip } from "./parts.js";
import type { Rig, Role } from "./rig.js";

/*
 * The brain separates intention from body (the Rain World lesson): it decides
 * the targets (where to look, which mood, which reaction) and the physics
 * (springs, gravity, smoothing) carries the pieces there. It knows nothing
 * about the DOM: it receives time and input, and returns numbers. The renderer
 * only applies the pose to the SVG.
 */

export type BrainInput = {
  /** Gaze target, normalised from −1 to 1 relative to the character. `null` makes it wander. */
  gaze: { x: number; y: number } | null;
  hover: boolean;
  /** Reduced motion: no idle, no jump; only changes of expression. */
  reduced: boolean;
  /** Mood weights by name (names unknown to the library are ignored). */
  mood: Record<string, number>;
  /** Activity name, or `null`. */
  activity: string | null;
  /** `simple` (small sizes): no appendage sway and no accessories. */
  detail: "full" | "simple";
  /** Appendage tips bend with physics. Default: on. */
  bend?: boolean;
  /** Something new on the page caught the attention this frame (0 to 1). */
  interest?: number;
  /** How close the cursor is (0 far, 1 right on top). */
  proximity?: number;
  /** Seconds for the eye to glide to the target; absent = saccade (see `GazeInput`). */
  glide?: number;
};

export type EyePose = {
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Eyelids: 0 to 1, and the tilt in degrees (already mirrored for this eye). */
  lidTop: number;
  lidBottom: number;
  lidAngle: number;
  /** 0 open eye, 1 happy arc (^). */
  happy: number;
  /** Extra tilt of the eye, in degrees (added to the style's). */
  rot: number;
};

/** Transformation fields, passed straight through to the renderer. */
const OBJECT_FIELDS = [
  "morph",
  "round",
  "retract",
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
] as const;
type Objects = Pick<Delta, (typeof OBJECT_FIELDS)[number]>;

export type Pose = Objects & {
  rootY: number;
  opacity: number;
  bodyRotate: number;
  centerRotate: number;
  bodySx: number;
  bodySy: number;
  scale: number;
  partsX: number;
  partC: number;
  partL: number;
  partR: number;
  /** How much each appendage tip bends, in degrees (0 = straight). */
  bendC: number;
  bendL: number;
  bendR: number;
  leftEye: EyePose;
  rightEye: EyePose;
  shadowScale: number;
  shadowOpacity: number;
  /** 0 = no sparks; otherwise, progress of the burst (0 to 1). */
  sparks: number;
  lamp: number;
  exclaim: number;
  question: number;
  ellipsis: number;
  zzz: number;
  rays: number;
  /** Gaze state, for debugging and for anyone who wants to react to it. */
  attention: number;
  boredom: number;
  gray: number;
  core: number;
  embers: number;
  smoke: number;
  /** Seconds since the page started, for the accessories' loops. */
  time: number;
};

/**
 * What the brain needs from a rig. `appendages` is optional: without it, the
 * three roles (C, L, R) are assumed; with it, only the roles present are
 * simulated (a rig may have fewer than three, or none).
 */
export type BrainConfig = Pick<Rig, "id" | "baseHeight" | "idleAppendage" | "flicker"> & {
  appendages?: readonly { role: Role }[];
};

export const DEFAULT_BRAIN_CONFIG: BrainConfig = {
  id: "berry",
  baseHeight: 535,
  idleAppendage: { amp: 1, freq: 1 },
  flicker: 0,
};

export type BrainOptions = {
  /** What can be played, by name. Default: `DEFAULT_LIBRARY`. */
  library?: Library;
  /** Hover/click/cuddle/nap behaviour. Default: `INTERACTIONS[config.id] ?? INTERACTIONS.berry`. */
  interactions?: Interactions;
  rng?: Rng;
  /** Initial time (ms), the first blink is scheduled relative to it. Default: `performance.now()`. */
  now?: number;
};

type ActiveReaction = { name: string; t0: number };
/** Replaced reaction: keeps playing and fades out in `REACTION_FADE_MS`. */
type LeavingReaction = ActiveReaction & { cut: number };
const REACTION_FADE_MS = 350;

/** After a hover gesture, waits this long before another. */
const HOVER_PAUSE_MS = 1200;
/** A gesture in the queue is valid for this long; after that, it lost its charm. */
const PENDING_VALIDITY_MS = 1600;
/** A gesture requested during another one: waits for it to end (the most important stays). */
type Pending = { gesture: Gesture; t: number; weight: number };

const ROLES: readonly Role[] = ["C", "L", "R"];
const SIDE: Record<Role, -1 | 0 | 1> = { C: 0, L: -1, R: 1 };

const interactionsFor = (c: BrainConfig): Interactions =>
  INTERACTIONS[c.id] ?? INTERACTIONS.berry;

const rolesOf = (c: BrainConfig): readonly Role[] =>
  c.appendages ? ROLES.filter((r) => c.appendages!.some((a) => a.role === r)) : ROLES;

const own = <T>(rec: Record<string, T>, name: string): T | undefined =>
  Object.hasOwn(rec, name) ? rec[name] : undefined;

export class Brain {
  private readonly rng: Rng;
  private cfg: BrainConfig;
  private library: Library;
  private interactions: Interactions;
  /** True when the caller passed their own interactions (they then ignore `config.id`). */
  private customInteractions: boolean;
  /** Roles simulated (those the rig has). */
  private roles: readonly Role[];
  private last: number | null = null;
  private blink;
  private gaze = new Gaze();
  private wander = { x: 0, y: 0, next: 0 };
  private parts: Record<Role, Spring> = {
    C: { a: 0, v: 0 },
    L: { a: 0, v: 0 },
    R: { a: 0, v: 0 },
  };
  /** Tip link of each appendage (a two-link chain). */
  private tips: Record<Role, Spring> = {
    C: { a: 0, v: 0 },
    L: { a: 0, v: 0 },
    R: { a: 0, v: 0 },
  };
  private targets: Record<Role, number> = { C: 0, L: 0, R: 0 };
  /** Velocities of the previous frame, to measure acceleration. */
  private previous = { baseY: 0, vy: 0, rot: 0, vPart: { C: 0, L: 0, R: 0 } };
  private jumpState: Jump = { y: 0, vy: 0 };
  private squash: Squash = { s: 0, v: 0 };
  private hover = 0;
  private moodSprings: Record<string, Damped> = {};
  private moodWeights: Record<string, number> = {};
  private activitySprings: Record<string, Damped> = {};
  private activityWeights: Record<string, number> = {};
  private reaction: ActiveReaction | null = null;
  private leaving: LeavingReaction | null = null;
  /** Requested during a transformation: starts when it ends. */
  private queue: string | null = null;
  /** Last value of `morph`: during the transformation, it does not jump. */
  private morph = 0;
  private chain = 0;
  private lastTap = -Infinity;
  private lastGesture: Gesture | null = null;
  private lastHover = -Infinity;
  private hoverSince: number | null = null;
  private pending: Pending | null = null;
  private cuddle = newDamped();
  private nap = newDamped();
  /*
   * Expression without jerks: every input that changes the shape of the eyes
   * goes through a critically damped spring, and the states (hover, near,
   * attention) hold their peak for a while before releasing. Putting the mouse
   * in and out quickly does not make the eye flicker between two shapes: it
   * stays in the "alert" shape and only relaxes afterwards.
   */
  private smoothed: Record<string, Damped> = {};
  private hoverHold = newHold();
  private nearHold = newHold();
  private attentionHold = newHold();
  private sv(name: string, start = 0): Damped {
    return (this.smoothed[name] ??= newDamped(start));
  }

  constructor(config: BrainConfig = DEFAULT_BRAIN_CONFIG, options: BrainOptions = {}) {
    this.cfg = config;
    this.rng = options.rng ?? Math.random;
    this.library = options.library ?? DEFAULT_LIBRARY;
    this.customInteractions = !!options.interactions;
    this.interactions = options.interactions ?? interactionsFor(config);
    this.roles = rolesOf(config);
    this.blink = newBlink(options.now ?? performance.now());
  }

  /**
   * Swaps the physical configuration (another rig) keeping the state: reaction
   * in progress, mood weights, gaze. Appendages that no longer exist are zeroed.
   */
  setConfig(config: BrainConfig) {
    this.cfg = config;
    this.roles = rolesOf(config);
    if (!this.customInteractions) this.interactions = interactionsFor(config);
    for (const k of ROLES)
      if (!this.roles.includes(k)) {
        this.parts[k].a = this.parts[k].v = 0;
        this.tips[k].a = this.tips[k].v = 0;
      }
  }

  /** Swaps what can be played (reactions, activities, moods). Default: `DEFAULT_LIBRARY`. */
  setLibrary(library: Library = DEFAULT_LIBRARY) {
    this.library = library;
  }

  /** Swaps the interactions; `undefined` goes back to the one for `config.id`. */
  setInteractions(interactions?: Interactions) {
    this.customInteractions = !!interactions;
    this.interactions = interactions ?? interactionsFor(this.cfg);
  }

  /**
   * Forget the last frame time. Call it when frames stop for a while (the
   * character left the screen, the tab was hidden): the next `step` then
   * treats the gap as a fresh start instead of integrating across it.
   */
  resume() {
    this.last = null;
  }

  /** Name of the reaction in progress, or `null`. */
  get currentReaction(): string | null {
    return this.reaction?.name ?? null;
  }

  /** Progress (0 to 1+) of a reaction; 1 if its definition no longer exists. */
  private progress(r: ActiveReaction, now: number): number {
    const def = own(this.library.reactions, r.name);
    return def ? (now - r.t0) / 1000 / def.duration : 1;
  }

  /**
   * Fires a reaction. A new one replaces the previous one, which fades out in
   * 350 ms instead of cutting off. During a transformation (the body does not
   * even exist), the new one waits in the queue. An unknown name is ignored
   * and returns `false`.
   */
  react(name: string, now: number): boolean {
    if (!own(this.library.reactions, name)) return false;
    const current = this.reaction;
    if (current && this.library.exclusive.has(current.name) && this.progress(current, now) < 1) {
      this.queue = name;
      return true;
    }
    if (current) this.leaving = { ...current, cut: now };
    this.reaction = { name, t0: now };
    return true;
  }

  jump(vy?: number) {
    if (this.morph > 0.01) return;
    launch(this.jumpState, vy);
  }

  /**
   * Busy: a reaction playing or the body in the air. Hover and click gestures
   * do not cut what is happening (that is what made the character shake with
   * fast clicks): they wait their turn. App reactions (`react`) still enter at once.
   */
  busy(now: number): boolean {
    if (this.reaction && this.progress(this.reaction, now) < 1) return true;
    return !atRest(this.jumpState);
  }

  /** Gesture waiting, for debugging. */
  get pendingGesture(): Gesture | null {
    return this.pending?.gesture ?? null;
  }

  private perform(g: Gesture, now: number, weight = 1): Gesture {
    if (this.busy(now)) {
      // The most important stays (sequence > gesture > hop); a tie: the newest.
      if (!this.pending || weight >= this.pending.weight)
        this.pending = { gesture: g, t: now, weight };
      return g;
    }
    this.lastGesture = g;
    if (g === "hop") this.jump();
    else this.react(g, now);
    return g;
  }

  /** Cursor entered: a drawn gesture, if not in the middle of another. */
  hoverEnter(now: number): Gesture | null {
    if (this.busy(now) || now - this.lastHover < HOVER_PAUSE_MS) return null;
    this.lastHover = now;
    return this.perform(pickGesture(this.interactions.hover, this.rng, this.lastGesture), now);
  }

  /**
   * Click or tap. A single click draws a gesture; successive clicks (less than
   * 0.7 s apart) hop until the sequence asks for something else: the character
   * table's reactions come on the 3rd, 5th and 8th. It also wakes whoever was
   * dozing under the cursor.
   */
  tap(now: number): Gesture {
    if (this.hoverSince !== null) this.hoverSince = now;
    if (this.nap.x > 0.5) {
      this.chain = 0;
      this.react("wake", now);
      return "wake";
    }
    this.chain = now - this.lastTap < CLICK_CHAIN_INTERVAL_MS ? this.chain + 1 : 1;
    this.lastTap = now;
    const { sequence, click } = this.interactions;
    const step = sequence.find((q) => q.n === this.chain);
    if (step) {
      if (this.chain >= sequence[sequence.length - 1].n) this.chain = 0;
      return this.perform(step.reaction, now, 3);
    }
    if (this.chain > 1) return this.perform("hop", now, 1);
    return this.perform(pickGesture(click, this.rng, this.lastGesture), now, 2);
  }

  step(now: number, e: BrainInput): Pose {
    // The single place where time enters the brain. 50 ms caps what one frame
    // can advance; the integrators further split it into steps of at most
    // `MAX_STEP` (20 ms), because the gaze spring (K = 900) diverges above ~38 ms.
    const dt = this.last === null ? 0 : Math.min(0.05, Math.max(0, now - this.last) / 1000);
    this.last = now;
    const s = now / 1000;
    const amp = e.reduced ? 0 : 1;
    const first = dt === 0;
    const lib = this.library;

    /* ---------- queued gesture: enters when the previous one ends ---------- */
    if (this.pending && !this.busy(now)) {
      const p = this.pending;
      this.pending = null;
      if (now - p.t < PENDING_VALIDITY_MS) this.perform(p.gesture, now, p.weight);
    }

    /* ---------- mood and activity weights ---------- */
    for (const h in lib.moods) {
      const target = e.mood[h] ?? 0;
      const m = (this.moodSprings[h] ??= newDamped(target));
      this.moodWeights[h] = first ? (m.x = target) : smoothDamp(m, target, 0.45, dt);
    }
    for (const a in lib.activities) {
      const target = e.activity === a ? 1 : 0;
      const m = (this.activitySprings[a] ??= newDamped(target));
      this.activityWeights[a] = first ? (m.x = target) : smoothDamp(m, target, 0.4, dt);
    }

    /* ---------- sum of the layers ---------- */
    const d = zeroDelta();
    for (const h in lib.moods) {
      const w = this.moodWeights[h];
      if (w > 0.001) addDelta(d, lib.moods[h], w);
    }
    for (const a in lib.activities) {
      const w = this.activityWeights[a];
      if (w > 0.001) addDelta(d, lib.activities[a](s), w);
    }
    if (this.leaving) {
      const { name, t0, cut } = this.leaving;
      const def = own(lib.reactions, name);
      const t = def ? (now - t0) / 1000 / def.duration : 1;
      const weight = 1 - smooth(0, 1, (now - cut) / REACTION_FADE_MS);
      if (!def || t >= 1 || weight <= 0) this.leaving = null;
      else addDelta(d, def.sample(Math.max(0, t)), weight);
    }
    if (this.reaction) {
      const { name, t0 } = this.reaction;
      const def = own(lib.reactions, name);
      const t = def ? (now - t0) / 1000 / def.duration : 1;
      if (t >= 1) {
        this.reaction = null;
        if (this.queue) {
          const next = this.queue;
          this.queue = null;
          if (this.react(next, now)) addDelta(d, lib.reactions[next].sample(0));
        }
      } else addDelta(d, def!.sample(Math.max(0, t)));
    }

    /* ---------- cursor resting on top: cuddle and, later, nap ---------- */
    if (e.hover && this.hoverSince === null) this.hoverSince = now;
    if (!e.hover) this.hoverSince = null;
    const over = this.hoverSince === null ? 0 : now - this.hoverSince;
    // Starts only with the body free but, once on, does not switch off because
    // of a passing reaction (it was another source of on-off flicker).
    const free = this.reaction === null;
    const napTarget = (free || this.nap.x > 0.5) && over > HOVER_NAP_MS ? 1 : 0;
    const cuddleTarget =
      (free || this.cuddle.x > 0.5) && over > HOVER_CUDDLE_MS && !napTarget ? 1 : 0;
    const cuddle = first
      ? (this.cuddle.x = cuddleTarget)
      : clamp(smoothDamp(this.cuddle, cuddleTarget, 0.6, dt), 0, 1);
    const nap = first
      ? (this.nap.x = napTarget)
      : clamp(smoothDamp(this.nap, napTarget, 0.9, dt), 0, 1);
    if (cuddle > 0.001) addDelta(d, this.interactions.cuddle(s), cuddle);
    if (nap > 0.001) addDelta(d, this.interactions.nap(s), nap);
    if (e.reduced) for (const k of MOTION_FIELDS) d[k] = 0;
    const hold = clamp(d.holdGaze, 0, 1);
    // During the transformation, the idle goes quiet: at the swap, the circle
    // has to be exactly where the bubble will appear.
    const m = clamp(d.morph, 0, 1);
    this.morph = m;
    const alive = 1 - m;

    /* ---------- gaze (saccades, pursuit, attention, boredom) ---------- */
    let tx: number;
    let ty: number;
    if (e.gaze) {
      tx = clamp(e.gaze.x, -1, 1);
      ty = clamp(e.gaze.y, -1, 1);
    } else {
      if (now > this.wander.next) {
        if (this.rng() < 0.3) this.wander.x = this.wander.y = 0;
        else {
          this.wander.x = (this.rng() * 2 - 1) * 0.8;
          this.wander.y = this.rng() * 0.8 - 0.5;
        }
        this.wander.next = now + 1200 + this.rng() * 2600;
      }
      tx = this.wander.x;
      ty = this.wander.y;
    }
    tx *= (1 - hold) * alive;
    ty *= (1 - hold) * alive;
    // Proximity holds ~0.9 s and releases slowly: the cursor leaving and
    // coming back does not make the attention and the cross-eyed look oscillate.
    const near = smoothDamp(
      this.sv("near"),
      stepHold(this.nearHold, (e.proximity ?? 0) * alive, now, 900, 1.2, dt),
      0.3,
      dt,
    );
    const look = this.gaze.step(
      {
        target: { x: tx, y: ty },
        reduced: e.reduced,
        interest: (e.interest ?? 0) * alive,
        proximity: near,
        glide: e.glide,
      },
      now,
      dt,
      this.rng,
    );
    if (look.blink && !this.blink.active) this.blink.next = now;
    // How much the gaze rules the expression (reactions can take over).
    const freeGaze = (1 - hold * 0.7) * alive;
    const attention = clamp(
      smoothDamp(
        this.sv("attention"),
        stepHold(this.attentionHold, look.attention * freeGaze, now, 1200, 0.8, dt),
        0.35,
        dt,
      ),
      0,
      1,
    );
    const boredom = clamp(
      smoothDamp(this.sv("boredom"), look.boredom * freeGaze * (1 - nap), 0.8, dt),
      0,
      1,
    );

    /* ---------- blink ---------- */
    const sleeping = Math.max(this.activityWeights.sleeping ?? 0, nap);
    const blinkAmount = amp && sleeping < 0.5 ? stepBlink(this.blink, now, this.rng) : 0;

    /* ---------- jump, squash, hover ---------- */
    if (e.reduced) {
      this.jumpState.y = this.jumpState.vy = 0;
      this.squash.s = this.squash.v = 0;
    } else stepJump(this.jumpState, this.squash, dt);
    // Hover holds 0.6 s after the cursor leaves: going in and out quickly does not shake.
    this.hover = clamp(
      smoothDamp(
        this.sv("hover"),
        stepHold(this.hoverHold, e.hover ? 1 : 0, now, 600, 2, dt),
        0.25,
        dt,
      ),
      0,
      1,
    );
    const hover = this.hover * alive;
    const stretch = clamp(-this.jumpState.vy / 12000, -0.05, 0.1) * amp * alive;

    /* ---------- appendages on springs ---------- */
    const { idleAppendage: idle, flicker } = this.cfg;
    const partAmp = Math.max(0, 1 + d.partAmp) * amp * idle.amp * (e.detail === "simple" ? 0 : 1);
    const f = idle.freq;
    const lagY = clamp(this.jumpState.vy * 0.003, -18, 22) * amp;
    const targets = this.targets;
    targets.C =
      (3 * Math.sin(s * 1.1 * f) + 1.5 * Math.sin(s * 2.3 * f + 1)) * partAmp -
      look.x * 4 +
      d.partC;
    targets.L =
      2.5 * Math.sin(s * 0.9 * f + 2) * partAmp +
      lagY +
      20 * hover +
      10 * attention -
      7 * boredom +
      d.partL;
    targets.R =
      2.5 * Math.sin(s * 1.0 * f + 4) * partAmp -
      lagY -
      20 * hover -
      10 * attention +
      7 * boredom +
      d.partR;
    for (const k of this.roles) {
      if (e.reduced || first) {
        this.parts[k].a = targets[k];
        this.parts[k].v = 0;
      } else spring(this.parts[k], targets[k], 120, 11, dt);
    }

    /* ---------- body ---------- */
    const turn = clamp(look.x * 0.35 * alive + d.turn, -1.6, 1.6);
    const absTurn = Math.abs(turn);
    const profile = clamp((absTurn - 1) / 0.6, 0, 1);
    const breath = Math.sin(s * 1.65) * amp * (1 - sleeping) * alive;
    const flickX = flicker * 0.012 * Math.sin(s * 9.1) * amp * alive;
    const flickY = flicker * 0.022 * Math.sin(s * 7.3) * amp * alive;
    const squashed = this.squash.s * alive;
    const bodySx =
      (1 - 0.012 * breath + squashed - stretch * 0.5 + d.bodySx - flickX) *
      (1 - Math.min(absTurn, 1) * 0.03 - profile * 0.14);
    const bodySy =
      1 + 0.024 * breath - squashed + stretch + d.bodySy + flickY + 0.02 * attention - 0.015 * boredom;
    const bodyRotate = (look.x * 2.2 + flicker * 1.4 * Math.sin(s * 5.3) * amp) * alive + d.bodyRotate;
    const rootY = this.jumpState.y * alive + d.rootY;
    const scale = Math.max(0, 1 + d.scale);

    /* ---------- eyes: 3D turn, eyelids and reactive shape ---------- */
    const ex = look.x * 32 + d.eyeX;
    const ey = look.y * 24 + d.eyeY;
    // Gaze velocity: in a saccade the eye stretches along the movement and
    // tilts toward where it is going (like a cartoon motion blur).
    // Microsaccades (low velocity) do not deform; and the shape does not
    // follow the raw velocity: stretch and tilt go through springs, so the
    // saccade leaves the eye tilted for a moment and it comes back without a jerk.
    const vel = Math.hypot(look.vx, look.vy);
    const fast = smooth(2, 9, vel);
    const stretchAmount = 0.3 * fast * amp * alive;
    const ux = vel > 1e-6 ? Math.abs(look.vx) / vel : 0;
    const uy = vel > 1e-6 ? Math.abs(look.vy) / vel : 0;
    // Fast attack, slow release: the deformation arrives with the saccade and
    // stays a little after it, slowly coming back.
    const follow = (name: string, target: number, attack: number, release: number) => {
      const sm = this.sv(name);
      return smoothDamp(sm, target, Math.abs(target) > Math.abs(sm.x) ? attack : release, dt);
    };
    const stretchX = follow("stretchX", stretchAmount * (ux - 0.6 * uy), 0.05, 0.22);
    const stretchY = follow("stretchY", stretchAmount * (uy - 0.6 * ux), 0.05, 0.22);
    const tilt =
      follow("tilt", clamp(look.vx * 1.6, -16, 16) * fast * amp * alive, 0.06, 0.45) +
      smoothDamp(this.sv("tiltX"), look.x * 6 * alive, 0.3, dt);
    // Attention: bigger, more open eyes. Boredom: heavy eyelids.
    // Looking up, the eye grows; looking down, the eyelid comes down with it.
    const lookY = first
      ? (this.sv("lookY").x = look.y)
      : smoothDamp(this.sv("lookY"), look.y, 0.25, dt);
    const up = Math.max(0, -lookY);
    const down = Math.max(0, lookY);
    const size = 1 + 0.16 * attention;
    const sx = (1 + d.eyeSx + hover * 0.04) * size * (1 + stretchX);
    const syBase =
      (1 + d.eyeSy + hover * 0.08) *
      (size + 0.06 * attention) *
      (1 + stretchY) *
      (1 + 0.07 * up * alive - 0.04 * down * alive - 0.06 * boredom);
    const vanish = 1 - clamp(d.eyesVanish, 0, 1);
    const lidTop = clamp(d.lidTop + 0.3 * boredom + 0.16 * down * alive - 0.15 * attention, 0, 1);
    const lidBottom = clamp(d.lidBottom, 0, 1);
    const converge = clamp(smoothDamp(this.sv("converge"), look.convergence * freeGaze, 0.35, dt), 0, 1);
    // Up to |turn| = 1, the eye on the side it turns toward shrinks 30%; in profile, it vanishes.
    const shrink = (side: number) => {
      const g = Math.max(side * turn, 0);
      return g <= 1 ? 1 - 0.3 * g : 0.7 * (1 - profile);
    };
    const shift = (nearSide: boolean) =>
      turn * (nearSide ? 34 : 48) + Math.sign(turn) * profile * 40;
    const eye = (side: -1 | 1): EyePose => {
      const close = clamp(side < 0 ? d.closeLeft : d.closeRight, 0, 1);
      const happy = clamp(d.happy + (side < 0 ? d.happyLeft : d.happyRight), 0, 1);
      return {
        x: ex + shift(side * turn > 0) - side * converge * 16,
        y: ey,
        sx: sx * shrink(side) * vanish,
        sy: Math.max(0.04, syBase * (1 - blinkAmount * 0.93 * alive) * (1 - close * 0.94)) * vanish,
        lidTop,
        lidBottom,
        lidAngle: side < 0 ? d.lidAngle : -d.lidAngle,
        happy,
        rot: tilt - side * converge * 9,
      };
    };
    const leftEye = eye(-1);
    const rightEye = eye(1);

    /* ---------- appendage tips (a chain with inertia) ---------- */
    const baseY = rootY - this.cfg.baseHeight * bodySy * scale;
    const rotTotal = bodyRotate + d.centerRotate;
    let dRot = rotTotal - this.previous.rot;
    dRot = ((((dRot + 180) % 360) + 360) % 360) - 180; // a 360° turn is not a jerk
    const prev = this.previous;
    if (first || e.reduced || e.detail === "simple" || e.bend === false) {
      for (const k of ROLES) {
        this.tips[k].a = 0;
        this.tips[k].v = 0;
      }
      prev.vy = 0;
      prev.vPart.C = prev.vPart.L = prev.vPart.R = 0;
    } else {
      const vy = (baseY - prev.baseY) / dt;
      const vRot = dRot / dt;
      const dvy = clamp(vy - prev.vy, -3000, 3000);
      for (const k of this.roles) {
        const vPart = this.parts[k].v + vRot;
        const dv = clamp(vPart - prev.vPart[k], -2000, 2000);
        stepTip(this.tips[k], dv, dvy, SIDE[k], dt);
        prev.vPart[k] = vPart;
      }
      prev.vy = vy;
    }
    prev.baseY = baseY;
    prev.rot = rotTotal;

    /* ---------- the rest ---------- */
    const opacity = clamp(1 + d.opacity, 0, 1);
    const shadowScale = clamp(1 + Math.min(0, rootY) / 450, 0.4, 1) * Math.min(1, 0.3 + scale);
    const simple = e.detail === "simple";
    const accessory = (v: number) => (simple ? 0 : clamp(v, 0, 1));

    return {
      rootY,
      opacity,
      bodyRotate,
      centerRotate: d.centerRotate,
      bodySx,
      bodySy,
      scale,
      partsX: clamp(turn, -1, 1) * 14 + Math.sign(turn) * profile * 20,
      partC: this.parts.C.a,
      partL: this.parts.L.a,
      partR: this.parts.R.a,
      bendC: this.tips.C.a,
      bendL: this.tips.L.a,
      bendR: this.tips.R.a,
      leftEye,
      rightEye,
      shadowScale,
      shadowOpacity: 0.14 * shadowScale * opacity * clamp(1 + d.shadow, 0, 1),
      sparks: simple ? 0 : clamp(d.sparks, 0, 1),
      lamp: accessory(d.lamp),
      exclaim: accessory(d.exclaim),
      question: accessory(d.question),
      ellipsis: accessory(d.ellipsis),
      zzz: accessory(d.zzz),
      rays: accessory(d.rays),
      attention,
      boredom,
      gray: clamp(d.gray, 0, 1),
      core: clamp(d.core, 0, 1),
      embers: accessory(d.embers),
      smoke: accessory(d.smoke),
      morph: m,
      round: d.round,
      retract: d.retract,
      swap: d.swap,
      bubbleR: d.bubbleR,
      bubbleHole: d.bubbleHole,
      bubbleArc: d.bubbleArc,
      bubbleX: d.bubbleX,
      bubbleY: d.bubbleY,
      dotsDist: d.dotsDist,
      dotsBounce: d.dotsBounce,
      checkDraw: d.checkDraw,
      codeDraw: d.codeDraw,
      orbitOpen: d.orbitOpen,
      objScale: d.objScale,
      objRotate: d.objRotate,
      time: s,
    };
  }
}
