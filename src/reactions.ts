import { clamp } from "./spring.js";
import type { PoseDelta } from "./types.js";

export interface ReactionDefinition {
  durationSeconds: number;
  /** `t` is 0..1 progress through the reaction. Returns the delta to layer on top of the base pose. */
  curve(t: number): PoseDelta;
  /** Higher wins when two reactions are both requested; see `ReactionPlayer`. Default 0. */
  priority?: number;
}

function squashLaunchLand(t: number, launchWindow = 0.15, landWindow = 0.15): { squash: number; stretch: number } {
  const launch = clamp(1 - t / launchWindow, 0, 1);
  const land = clamp((t - (1 - landWindow)) / landWindow, 0, 1);
  return { squash: launch * 0.5 + land, stretch: 1 - launch - land * 0.3 };
}

/** A single hop with squash-on-takeoff and squash-on-landing, no real physics integration needed since the whole arc is a closed-form curve of `t`. */
export const bounce: ReactionDefinition = {
  durationSeconds: 0.55,
  priority: 1,
  curve(t) {
    const { squash, stretch } = squashLaunchLand(t);
    const flight = clamp((t - 0.12) / 0.76, 0, 1);
    const y = -18 * Math.sin(Math.PI * flight);
    return {
      body: {
        y,
        scaleY: 1 - squash * 0.16 + (1 - squash) * (stretch - 1) * 0.1,
        scaleX: 1 + squash * 0.1,
      },
    };
  },
};

/** Eyes widen fast, body flinches back, both settle — a startle reaction. */
export const fright: ReactionDefinition = {
  durationSeconds: 0.5,
  priority: 3,
  curve(t) {
    const attack = clamp(t / 0.08, 0, 1);
    const release = 1 - clamp((t - 0.08) / 0.42, 0, 1);
    const shakeEnvelope = Math.max(0, 1 - t / 0.35);
    return {
      eyes: { scaleY: 1 + attack * release * 0.3 },
      body: { x: Math.sin(t * 55) * shakeEnvelope * 2.2, rotate: Math.sin(t * 40) * shakeEnvelope * 3 },
    };
  },
};

/** Two quick blinks in a row. */
export const doubleBlink: ReactionDefinition = {
  durationSeconds: 0.45,
  curve(t) {
    const cycle = (phase: number) => {
      const local = clamp((t - phase) / 0.12, 0, 1);
      return local < 1 ? Math.sin(Math.PI * local) : 0;
    };
    return { eyes: { shut: Math.max(cycle(0), cycle(0.2)) } };
  },
};

/** A small forward-back head nod, e.g. for acknowledging something. */
export const nod: ReactionDefinition = {
  durationSeconds: 0.6,
  curve(t) {
    const envelope = Math.sin(Math.PI * t);
    return { body: { rotate: Math.sin(t * Math.PI * 3) * envelope * 4 } };
  },
};

export const builtinReactions: Record<string, ReactionDefinition> = { bounce, fright, doubleBlink, nod };

interface PlayingReaction {
  name: string;
  def: ReactionDefinition;
  t: number;
}

interface PendingReaction {
  name: string;
  def: ReactionDefinition;
  requestedAt: number;
}

export interface ReactionPlayerOptions {
  /** A request older than this (seconds) is dropped instead of starting once its turn comes. Default 1.6, matching DevBerry's calibration. */
  maxQueueAgeSeconds?: number;
  reactions?: Record<string, ReactionDefinition>;
}

/**
 * Plays one reaction at a time. A second request while one is already
 * playing doesn't cut it off: it waits as the single pending slot (a third
 * request only overwrites the pending one if it has equal or higher
 * priority), and starts when the current reaction ends — unless it's gone
 * stale (older than `maxQueueAgeSeconds`), in which case it's dropped
 * instead of surprising the user with a late reaction.
 */
export class ReactionPlayer {
  private current: PlayingReaction | null = null;
  private pending: PendingReaction | null = null;
  private clock = 0;
  private readonly maxQueueAgeSeconds: number;
  private readonly reactions: Record<string, ReactionDefinition>;

  constructor(options: ReactionPlayerOptions = {}) {
    this.maxQueueAgeSeconds = options.maxQueueAgeSeconds ?? 1.6;
    this.reactions = options.reactions ?? builtinReactions;
  }

  get isPlaying(): boolean {
    return this.current !== null;
  }

  get currentName(): string | null {
    return this.current?.name ?? null;
  }

  /** Requests `name` to play. Returns true if it started immediately, false if queued/dropped. */
  play(name: string): boolean {
    const def = this.reactions[name];
    if (!def) return false;

    if (!this.current) {
      this.current = { name, def, t: 0 };
      return true;
    }

    const currentPriority = this.current.def.priority ?? 0;
    const pendingPriority = this.pending ? this.pending.def.priority ?? 0 : -Infinity;
    const requestedPriority = def.priority ?? 0;

    if (requestedPriority >= currentPriority && requestedPriority >= pendingPriority) {
      this.pending = { name, def, requestedAt: this.clock };
    }
    return false;
  }

  /** Advances the clock; returns the active reaction's pose delta, or `null` when nothing is playing. */
  update(dt: number): PoseDelta | null {
    this.clock += dt;

    if (this.current) {
      this.current.t += dt / this.current.def.durationSeconds;
      if (this.current.t >= 1) {
        this.current = null;
      }
    }

    if (!this.current && this.pending) {
      const age = this.clock - this.pending.requestedAt;
      const { name, def } = this.pending;
      this.pending = null;
      if (age <= this.maxQueueAgeSeconds) {
        this.current = { name, def, t: 0 };
      }
    }

    if (!this.current) return null;
    return this.current.def.curve(clamp(this.current.t, 0, 1));
  }
}
