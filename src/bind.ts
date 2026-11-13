import { Brain, type BrainOptions } from "./brain.js";
import type { GazeTarget } from "./gaze.js";
import { safeDt } from "./spring.js";
import type { AvatarDefinitionLike } from "./types.js";
import { mountRig, type MountedRig, type RenderOptions } from "./render.js";

export interface BoundBot {
  readonly brain: Brain;
  readonly rig: MountedRig;
  /** Advance one frame. `nowMs` should be monotonically increasing, e.g. from `requestAnimationFrame`. */
  tick(nowMs: number): void;
  /** Runs `tick` on `requestAnimationFrame` until `stop()`. */
  start(): void;
  stop(): void;
  destroy(): void;
}

export interface BindOptions extends RenderOptions {
  host: HTMLElement;
  definition: AvatarDefinitionLike;
  brain?: BrainOptions;
  /** Returns the live gaze target (e.g. pointer position relative to the host, -1..1) or `null` for autonomous wandering. */
  getGazeTarget?: () => GazeTarget | null;
}

/**
 * Mounts a definition with `mountRig` and wires a `Brain` to it: every
 * frame it reads the gaze target, advances mood/gaze/blink/reactions, and
 * applies the resulting pose to the rendered SVG.
 */
export function bindBrain(options: BindOptions): BoundBot {
  const rig = mountRig(options.host, options.definition, options);
  const brain = new Brain(options.brain);
  let lastMs: number | null = null;
  let rafId: number | null = null;

  function tick(nowMs: number) {
    const dt = safeDt(lastMs === null ? 16 : nowMs - lastMs);
    lastMs = nowMs;
    const target = options.getGazeTarget?.() ?? null;
    rig.applyPose(brain.update(dt, target));
  }

  return {
    brain,
    rig,
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
    destroy() {
      this.stop();
      rig.destroy();
    },
  };
}
