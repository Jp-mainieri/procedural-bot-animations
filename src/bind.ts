import { Bounce, GazeController, breathingDepth, neverRepeating, velocityLean, type Point2D } from "./motion.js";
import { safeDt } from "./spring.js";
import type { BotStateMachine } from "./state-machine.js";

/**
 * The slice of Open Bot Avatar's `MountedAvatar` this module needs. Written
 * as a local, duck-typed interface (not imported from `open-bot-avatar`) so
 * this package has zero required runtime dependency on it and can drive any
 * renderer exposing the same shape.
 */
export interface UpdatableAvatar {
  update(options: {
    mood?: string;
    lookAt?: Point2D | null;
    depth?: number;
    view?: { yaw?: number; pitch?: number };
  }): void;
}

export interface StatePreset {
  /** Mood to request from the avatar for this state. */
  mood?: string;
  /** Base depth for breathing, overriding the binder's default. */
  baseDepth?: number;
  /** Disables autonomous gaze wandering while in this state (e.g. "sleeping"). */
  freezeGaze?: boolean;
  /** Triggers a `Bounce` impulse once on entering this state (e.g. "success"). */
  bounceOnEnter?: boolean;
  /** Extra yaw/pitch (radians) added on top of breathing, e.g. a head tilt for "thinking". */
  viewOffset?: { yaw?: number; pitch?: number };
}

export interface BindOptions<S extends string> {
  avatar: UpdatableAvatar;
  /** The element whose CSS transform receives squash/stretch/lean. Optional: skip if you don't need it. */
  host?: HTMLElement;
  machine: BotStateMachine<S, string, unknown>;
  /** Per-state visual presets; states without one just keep the avatar's default mood/motion. */
  presets?: Partial<Record<S, StatePreset>>;
  /** Live pointer target in -1..1, or null/undefined when there is none right now. */
  getPointerTarget?: () => Point2D | null;
  /** Live horizontal velocity (px/s) for the lean effect, e.g. during drag or auto-scroll. */
  getVelocityX?: () => number;
  defaultDepth?: number;
}

export interface BoundBot {
  /** Advance one animation frame. `nowMs` should be a monotonically increasing clock, e.g. from rAF. */
  tick(nowMs: number): void;
  /** Stops owning any further `requestAnimationFrame` loop started by `start()`. */
  stop(): void;
  /** Runs `tick` on `requestAnimationFrame` until `stop()` is called. */
  start(): void;
}

/**
 * Wires a state machine and the procedural motion helpers to an Open Bot
 * Avatar (or compatible) instance: every frame it computes breathing depth,
 * gaze (pointer-follow or autonomous wander), and an optional bounce/lean on
 * the host element, then calls `avatar.update(...)`.
 */
export function bindBotStateMachine<S extends string>(opts: BindOptions<S>): BoundBot {
  const { avatar, host, machine, getPointerTarget, getVelocityX, defaultDepth = 6 } = opts;
  const presets: Partial<Record<S, StatePreset>> = opts.presets ?? {};

  const gaze = new GazeController();
  const bounce = new Bounce();
  let lastMs: number | null = null;
  let elapsed = 0;
  let rafId: number | null = null;
  let lastState = machine.getState();

  const triggerPresetEffects = (state: S) => {
    const preset = presets[state];
    if (preset?.bounceOnEnter) bounce.trigger();
  };
  triggerPresetEffects(lastState);
  machine.subscribe((state) => triggerPresetEffects(state));

  function tick(nowMs: number) {
    const dt = safeDt(lastMs === null ? 16 : nowMs - lastMs);
    lastMs = nowMs;
    elapsed += dt;

    machine.tick(dt * 1000);
    const state = machine.getState();
    if (state !== lastState) lastState = state;
    const preset = presets[state];

    const pointerTarget = preset?.freezeGaze ? null : getPointerTarget?.() ?? null;
    const gazeValue = preset?.freezeGaze ? { x: 0, y: 0 } : gaze.update(dt, pointerTarget);

    const depth = breathingDepth(elapsed, preset?.baseDepth ?? defaultDepth, { seed: 0 });
    const wobble = neverRepeating(elapsed, 1) * 0.04;

    avatar.update({
      mood: preset?.mood,
      lookAt: gazeValue,
      depth,
      view: {
        yaw: (preset?.viewOffset?.yaw ?? 0) + wobble,
        pitch: (preset?.viewOffset?.pitch ?? 0) + wobble * 0.5,
      },
    });

    if (host) {
      const b = bounce.update(dt);
      const velocityX = getVelocityX?.() ?? 0;
      const lean = velocityLean(velocityX);
      host.style.transform = `translateY(${b.y.value}px) rotate(${lean}deg) scale(${1 + b.squashX}, ${1 + b.squashY})`;
    }
  }

  return {
    tick,
    start() {
      const loop = (nowMs: number) => {
        tick(nowMs);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      lastMs = null;
    },
  };
}
