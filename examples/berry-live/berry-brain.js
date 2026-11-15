/**
 * Ported from DevBerry's `lib/berry/cerebro.ts` (`CerebroBerry`), the real
 * orchestrator: it separates intent from body (mood, reaction, where to
 * look) from physics (springs, gravity, smoothing). It knows nothing about
 * the DOM — it takes time and input, and returns numbers; a renderer applies
 * the pose. Field names translated to English (`berry-delta.js`); formulas
 * and constants unchanged, with one simplification: DevBerry's version also
 * queues a reaction behind an in-progress *transformation* (the Pumpy-style
 * morph into a loading spinner/checkmark) — that system isn't ported here
 * (see `berry-case-study.md`), so that branch is dropped; everything else —
 * mood blending, activities, the hover/click gesture picker with its
 * pending-gesture queue, gaze, the eye's reactive shape, leaf physics — is
 * intact.
 */
import { addDelta, MOTION_FIELDS, zeroDelta } from "./berry-delta.js";
import { Gaze } from "./berry-gaze.js";
import {
  CLICK_CHAIN_INTERVAL_MS, HOVER_CUDDLE_MS, HOVER_NAP_MS, INTERACTIONS, pickGesture,
} from "./berry-interactions.js";
import { MOOD_NAMES, MOODS } from "./berry-moods.js";
import {
  atRest, axisOf, bendPath, clamp, launch, newBlink, parsePath, smooth, smoothDamp, spring,
  stepBlink, stepHold, stepJump, stepTip,
} from "./berry-motor.js";
import { ACTIVITIES, ACTIVITY_NAMES, REACTIONS } from "./berry-reactions.js";

const HOVER_PAUSE_MS = 1200;
const PENDING_VALID_MS = 1600;

export class BerryBrain {
  #rng;
  #cfg;
  #lastT = null;
  #blink;
  #gaze = new Gaze();
  #wander = { x: 0, y: 0, next: 0 };
  #leafBase = { C: { a: 0, v: 0 }, L: { a: 0, v: 0 }, R: { a: 0, v: 0 } };
  #leafTip = { C: { a: 0, v: 0 }, L: { a: 0, v: 0 }, R: { a: 0, v: 0 } };
  #prev = { baseY: 0, vy: 0, rot: 0, leafVel: { C: 0, L: 0, R: 0 } };
  #jump = { y: 0, vy: 0 };
  #squash = { s: 0, v: 0 };
  #hover = 0;
  #moodWeight = Object.fromEntries(MOOD_NAMES.map((m) => [m, m === "neutral" ? 1 : 0]));
  #activityWeight = Object.fromEntries(ACTIVITY_NAMES.map((a) => [a, 0]));
  #reaction = null;
  #fadingReaction = null;
  #lastClickT = -Infinity;
  #lastGesture = null;
  #lastHoverT = -Infinity;
  #hoverSince = null;
  #pending = null;
  #cuddle = { x: 0, v: 0 };
  #nap = { x: 0, v: 0 };
  #smooths = {};
  #hoverHold = { v: 0, until: 0 };
  #nearHold = { v: 0, until: 0 };
  #attentionHold = { v: 0, until: 0 };
  #clickChain = 0;

  constructor(now, rng = Math.random, cfg = {}) {
    this.#rng = rng;
    this.#cfg = { legHeight: 535, idleLeaf: { amp: 1, freq: 1 }, ...cfg };
    this.#blink = newBlink(now);
  }

  #sv(name, init = 0) {
    return (this.#smooths[name] ??= { x: init, v: 0 });
  }

  /** Name of the reaction currently playing, or `null`. */
  get currentReaction() {
    return this.#reaction?.name ?? null;
  }

  /** Starts a reaction. A new one replaces the current, which fades out over 250ms instead of cutting. */
  react(name, now) {
    if (this.#reaction) this.#fadingReaction = { ...this.#reaction, cut: now };
    this.#reaction = { name, t0: now };
  }

  jump(vy) {
    launch(this.#jump, vy);
  }

  /** Busy: a reaction is playing, or the body is airborne. Hover/click gestures wait their turn; `react()` always goes immediately. */
  busy(now) {
    if (this.#reaction) {
      const t = (now - this.#reaction.t0) / 1000 / REACTIONS[this.#reaction.name].duration;
      if (t < 1) return true;
    }
    return !atRest(this.#jump);
  }

  get pendingGesture() {
    return this.#pending?.gesture ?? null;
  }

  #perform(g, now, weight = 1) {
    if (this.busy(now)) {
      if (!this.#pending || weight >= this.#pending.weight) this.#pending = { gesture: g, t: now, weight };
      return g;
    }
    this.#lastGesture = g;
    if (g === "jump") this.jump();
    else this.react(g, now);
    return g;
  }

  /** Cursor entered: a picked gesture, if nothing else is happening. */
  hoverEnter(now) {
    if (this.busy(now) || now - this.#lastHoverT < HOVER_PAUSE_MS) return null;
    this.#lastHoverT = now;
    return this.#perform(pickGesture(INTERACTIONS.hover, this.#rng, this.#lastGesture), now);
  }

  /**
   * Click or tap. An isolated click picks a gesture; clicks within 0.7s of
   * each other chain, jumping along until the chain hits 3rd/5th/8th, which
   * fire the named reactions. Also wakes a napping character.
   */
  tap(now) {
    if (this.#hoverSince !== null) this.#hoverSince = now;
    if (this.#nap.x > 0.5) {
      this.#clickChain = 0;
      this.react("wake", now);
      return "wake";
    }
    this.#clickChain = now - this.#lastClickT < CLICK_CHAIN_INTERVAL_MS ? this.#clickChain + 1 : 1;
    this.#lastClickT = now;
    const { chain, click } = INTERACTIONS;
    const step = chain.find((q) => q.n === this.#clickChain);
    if (step) {
      if (this.#clickChain >= chain[chain.length - 1].n) this.#clickChain = 0;
      return this.#perform(step.reaction, now, 3);
    }
    if (this.#clickChain > 1) return this.#perform("jump", now, 1);
    return this.#perform(pickGesture(click, this.#rng, this.#lastGesture), now, 2);
  }

  /**
   * Advances one frame. `input`:
   * `{ gaze: {x,y}|null, hover, reducedMotion, mood: {name:weight}, activity: name|null,
   *    detail: 'full'|'simple', bend, interest, proximity, glideSeconds }`
   */
  step(now, input) {
    const dt = this.#lastT === null ? 0 : Math.min(0.05, Math.max(0, now - this.#lastT) / 1000);
    this.#lastT = now;
    const s = now / 1000;
    const amp = input.reducedMotion ? 0 : 1;
    const first = dt === 0;

    if (this.#pending && !this.busy(now)) {
      const p = this.#pending;
      this.#pending = null;
      if (now - p.t < PENDING_VALID_MS) this.#perform(p.gesture, now, p.weight);
    }

    for (const m of MOOD_NAMES) {
      const target = input.mood?.[m] ?? 0;
      const st = this.#sv(`m:${m}`, target);
      this.#moodWeight[m] = first ? (st.x = target) : smoothDamp(st, target, 0.45, dt);
    }
    for (const a of ACTIVITY_NAMES) {
      const target = input.activity === a ? 1 : 0;
      const st = this.#sv(`a:${a}`, target);
      this.#activityWeight[a] = first ? (st.x = target) : smoothDamp(st, target, 0.4, dt);
    }

    const d = zeroDelta();
    for (const m of MOOD_NAMES) if (this.#moodWeight[m] > 0.001) addDelta(d, MOODS[m], this.#moodWeight[m]);
    for (const a of ACTIVITY_NAMES) {
      const w = this.#activityWeight[a];
      if (w > 0.001) addDelta(d, ACTIVITIES[a](s), w);
    }
    if (this.#fadingReaction) {
      const { name, t0, cut } = this.#fadingReaction;
      const t = (now - t0) / 1000 / REACTIONS[name].duration;
      const weight = 1 - smooth(0, 1, (now - cut) / 350);
      if (t >= 1 || weight <= 0) this.#fadingReaction = null;
      else addDelta(d, REACTIONS[name].sample(Math.max(0, t)), weight);
    }
    if (this.#reaction) {
      const { name, t0 } = this.#reaction;
      const t = (now - t0) / 1000 / REACTIONS[name].duration;
      if (t >= 1) this.#reaction = null;
      else addDelta(d, REACTIONS[name].sample(Math.max(0, t)));
    }

    if (input.hover && this.#hoverSince === null) this.#hoverSince = now;
    if (!input.hover) this.#hoverSince = null;
    const hoveredFor = this.#hoverSince === null ? 0 : now - this.#hoverSince;
    const free = this.#reaction === null;
    const napTarget = (free || this.#nap.x > 0.5) && hoveredFor > HOVER_NAP_MS ? 1 : 0;
    const cuddleTarget = (free || this.#cuddle.x > 0.5) && hoveredFor > HOVER_CUDDLE_MS && !napTarget ? 1 : 0;
    const cuddle = first ? (this.#cuddle.x = cuddleTarget) : clamp(smoothDamp(this.#cuddle, cuddleTarget, 0.6, dt), 0, 1);
    const nap = first ? (this.#nap.x = napTarget) : clamp(smoothDamp(this.#nap, napTarget, 0.9, dt), 0, 1);
    if (cuddle > 0.001) addDelta(d, INTERACTIONS.cuddle(s), cuddle);
    if (nap > 0.001) addDelta(d, INTERACTIONS.nap(s), nap);
    if (input.reducedMotion) for (const k of MOTION_FIELDS) d[k] = 0;
    const holdGaze = clamp(d.holdGaze, 0, 1);
    const alive = 1; // no transformation system ported, so the character is always "alive"

    // ---------- gaze ----------
    let tx, ty;
    if (input.gaze) {
      tx = clamp(input.gaze.x, -1, 1);
      ty = clamp(input.gaze.y, -1, 1);
    } else {
      if (now > this.#wander.next) {
        if (this.#rng() < 0.3) this.#wander.x = this.#wander.y = 0;
        else {
          this.#wander.x = (this.#rng() * 2 - 1) * 0.8;
          this.#wander.y = this.#rng() * 0.8 - 0.5;
        }
        this.#wander.next = now + 1200 + this.#rng() * 2600;
      }
      tx = this.#wander.x;
      ty = this.#wander.y;
    }
    tx *= (1 - holdGaze) * alive;
    ty *= (1 - holdGaze) * alive;
    const near = smoothDamp(
      this.#sv("near"),
      stepHold(this.#nearHold, (input.proximity ?? 0) * alive, now, 900, 1.2, dt),
      0.3,
      dt,
    );
    const look = this.#gaze.step(
      { target: { x: tx, y: ty }, reducedMotion: input.reducedMotion, interest: (input.interest ?? 0) * alive, proximity: near, glideSeconds: input.glideSeconds },
      now,
      dt,
      this.#rng,
    );
    if (look.blink && !this.#blink.active) this.#blink.next = now;
    const freeGaze = (1 - holdGaze * 0.7) * alive;
    const attention = clamp(
      smoothDamp(this.#sv("attention"), stepHold(this.#attentionHold, look.attention * freeGaze, now, 1200, 0.8, dt), 0.35, dt),
      0,
      1,
    );
    const boredom = clamp(smoothDamp(this.#sv("boredom"), look.boredom * freeGaze * (1 - nap), 0.8, dt), 0, 1);

    // ---------- blink ----------
    const sleepingAmount = Math.max(this.#activityWeight.sleeping, nap);
    const blinkAmount = amp && sleepingAmount < 0.5 ? stepBlink(this.#blink, now, this.#rng) : 0;

    // ---------- jump, squash, hover ----------
    if (input.reducedMotion) {
      this.#jump.y = this.#jump.vy = 0;
      this.#squash.s = this.#squash.v = 0;
    } else stepJump(this.#jump, this.#squash, dt);
    this.#hover = clamp(smoothDamp(this.#sv("hover"), stepHold(this.#hoverHold, input.hover ? 1 : 0, now, 600, 2, dt), 0.25, dt), 0, 1);
    const hover = this.#hover * alive;
    const stretch = clamp(-this.#jump.vy / 12000, -0.05, 0.1) * amp * alive;

    // ---------- leaves (springs) ----------
    const { idleLeaf: idle } = this.#cfg;
    const leafAmp = Math.max(0, 1 + d.leafAmp) * amp * idle.amp * (input.detail === "simple" ? 0 : 1);
    const f = idle.freq;
    const lagY = clamp(this.#jump.vy * 0.003, -18, 22) * amp;
    const targets = {
      C: (3 * Math.sin(s * 1.1 * f) + 1.5 * Math.sin(s * 2.3 * f + 1)) * leafAmp - look.x * 4 + d.leafC,
      L: 2.5 * Math.sin(s * 0.9 * f + 2) * leafAmp + lagY + 20 * hover + 10 * attention - 7 * boredom + d.leafL,
      R: 2.5 * Math.sin(s * 1.0 * f + 4) * leafAmp - lagY - 20 * hover - 10 * attention + 7 * boredom + d.leafR,
    };
    for (const k of ["C", "L", "R"]) {
      if (input.reducedMotion || first) this.#leafBase[k] = { a: targets[k], v: 0 };
      else spring(this.#leafBase[k], targets[k], 120, 11, dt);
    }

    // ---------- body ----------
    const turn = clamp(look.x * 0.35 * alive + d.turn, -1.6, 1.6);
    const absTurn = Math.abs(turn);
    const profileAmount = clamp((absTurn - 1) / 0.6, 0, 1);
    const breathe = Math.sin(s * 1.65) * amp * (1 - sleepingAmount) * alive;
    const amassado = this.#squash.s * alive;
    const bodySx = (1 - 0.012 * breathe + amassado - stretch * 0.5 + d.bodySx) * (1 - Math.min(absTurn, 1) * 0.03 - profileAmount * 0.14);
    const bodySy = 1 + 0.024 * breathe - amassado + stretch + d.bodySy + 0.02 * attention - 0.015 * boredom;
    const bodyRotate = look.x * 2.2 * alive + d.bodyRotate;
    const rootY = this.#jump.y * alive + d.rootY;
    const scale = Math.max(0, 1 + d.scale);

    // ---------- eyes: 3D turn, lids, reactive shape ----------
    const ex = look.x * 32 + d.eyeX;
    const ey = look.y * 24 + d.eyeY;
    const vel = Math.hypot(look.vx, look.vy);
    const fast = smooth(2, 9, vel);
    const stretchEye = 0.3 * fast * amp * alive;
    const ux = vel > 1e-6 ? Math.abs(look.vx) / vel : 0;
    const uy = vel > 1e-6 ? Math.abs(look.vy) / vel : 0;
    const follow = (name, target, attack, release) => {
      const st = this.#sv(name);
      return smoothDamp(st, target, Math.abs(target) > Math.abs(st.x) ? attack : release, dt);
    };
    const stretchX = follow("stretchX", stretchEye * (ux - 0.6 * uy), 0.05, 0.22);
    const stretchY = follow("stretchY", stretchEye * (uy - 0.6 * ux), 0.05, 0.22);
    const tilt = follow("tilt", clamp(look.vx * 1.6, -16, 16) * fast * amp * alive, 0.06, 0.45) + smoothDamp(this.#sv("tiltX"), look.x * 6 * alive, 0.3, dt);
    const lookY = first ? (this.#sv("lookY").x = look.y) : smoothDamp(this.#sv("lookY"), look.y, 0.25, dt);
    const up = Math.max(0, -lookY);
    const down = Math.max(0, lookY);
    const size = 1 + 0.16 * attention;
    const eyeSx = (1 + d.eyeSx + hover * 0.04) * size * (1 + stretchX);
    const eyeSyBase = (1 + d.eyeSy + hover * 0.08) * (size + 0.06 * attention) * (1 + stretchY) * (1 + 0.07 * up * alive - 0.04 * down * alive - 0.06 * boredom);
    const vanish = 1 - clamp(d.eyesVanish, 0, 1);
    const lidTop = clamp(d.lidTop + 0.3 * boredom + 0.16 * down * alive - 0.15 * attention, 0, 1);
    const lidBottom = clamp(d.lidBottom, 0, 1);
    const convergence = clamp(smoothDamp(this.#sv("convergence"), look.convergence * freeGaze, 0.35, dt), 0, 1);
    const shrink = (side) => {
      const g = Math.max(side * turn, 0);
      return g <= 1 ? 1 - 0.3 * g : 0.7 * (1 - profileAmount);
    };
    const slide = (near_) => turn * (near_ ? 34 : 48) + Math.sign(turn) * profileAmount * 40;
    const eye = (side) => {
      const close = clamp(side < 0 ? d.closeLeft : d.closeRight, 0, 1);
      const happy = clamp(d.happy + (side < 0 ? d.happyLeft : d.happyRight), 0, 1);
      return {
        x: ex + slide(side * turn > 0) - side * convergence * 16,
        y: ey,
        sx: eyeSx * shrink(side) * vanish,
        sy: Math.max(0.04, eyeSyBase * (1 - blinkAmount * 0.93 * alive) * (1 - close * 0.94)) * vanish,
        lidTop,
        lidBottom,
        lidAngle: side < 0 ? d.lidAngle : -d.lidAngle,
        happy,
        rotate: tilt - side * convergence * 9,
      };
    };
    const eyeLeft = eye(-1);
    const eyeRight = eye(1);

    // ---------- leaf tips (inertia chain) ----------
    const baseY = rootY - this.#cfg.legHeight * bodySy * scale;
    const totalRotate = bodyRotate + d.centerRotate;
    let dRot = totalRotate - this.#prev.rot;
    dRot = (((dRot + 180) % 360) + 360) % 360 - 180;
    const prev = this.#prev;
    if (first || input.reducedMotion || input.detail === "simple" || input.bend === false) {
      for (const k of ["C", "L", "R"]) this.#leafTip[k] = { a: 0, v: 0 };
      prev.vy = 0;
      prev.leafVel = { C: 0, L: 0, R: 0 };
    } else {
      const vy = (baseY - prev.baseY) / dt;
      const vRot = dRot / dt;
      const dvy = clamp(vy - prev.vy, -3000, 3000);
      for (const [k, side] of [["C", 0], ["L", -1], ["R", 1]]) {
        const leafVel = this.#leafBase[k].v + vRot;
        const dv = clamp(leafVel - prev.leafVel[k], -2000, 2000);
        stepTip(this.#leafTip[k], dv, dvy, side, dt);
        prev.leafVel[k] = leafVel;
      }
      prev.vy = vy;
    }
    prev.baseY = baseY;
    prev.rot = totalRotate;

    const opacity = clamp(1 + d.opacity, 0, 1);
    const shadowScale = clamp(1 + Math.min(0, rootY) / 450, 0.4, 1) * Math.min(1, 0.3 + scale);
    const simple = input.detail === "simple";
    const accessory = (v) => (simple ? 0 : clamp(v, 0, 1));

    return {
      rootY,
      opacity,
      bodyRotate,
      centerRotate: d.centerRotate,
      bodySx,
      bodySy,
      scale,
      leafTurnX: clamp(turn, -1, 1) * 14 + Math.sign(turn) * profileAmount * 20,
      leafC: this.#leafBase.C.a,
      leafL: this.#leafBase.L.a,
      leafR: this.#leafBase.R.a,
      bendC: this.#leafTip.C.a,
      bendL: this.#leafTip.L.a,
      bendR: this.#leafTip.R.a,
      eyeLeft,
      eyeRight,
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
      time: s,
    };
  }
}
