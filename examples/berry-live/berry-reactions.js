/**
 * Three of DevBerry's "Pumpy-style personality" reactions, ported verbatim
 * from `lib/berry/reacoes.ts` (branch `feat/berry-simulador-mascote`):
 * `piscadela` (wink), `achatar` (flatten) and `cambalhota` (somersault).
 * Field names translated to English; every keyframe value is unchanged.
 * `reacoes.ts` holds ~15 of these plus the full accerto/susto/transform
 * catalog (1932 lines) — these three were picked for variety, not because
 * the rest don't port; see `berry-case-study.md`.
 */
import { fromTracks } from "./berry-motor.js";

/** Wink: one eye arcs happy, body leans, a small hop, duration 1.2s. */
export const wink = { duration: 1.2, sample: fromTracks({
  happyRight: [[0, 0], [0.12, 1], [0.7, 1], [0.85, 0]],
  lidBottomRight: [[0, 0], [0.12, 0.25], [0.7, 0.25], [0.85, 0]],
  bodyRotate: [[0, 0], [0.15, 7], [0.7, 7], [1, 0]],
  rootY: [[0, 0], [0.08, -26, "easeIn"], [0.2, 0]],
  leafR: [[0, 0], [0.15, -22], [0.35, -6], [0.55, -18], [1, 0]],
  turn: [[0, 0], [0.15, 0.35], [0.7, 0.35], [1, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.8, 1], [1, 0]],
}) };

/** Flatten: squashes down like dough, then pops back, duration 2.4s. */
export const flatten = { duration: 2.4, sample: fromTracks({
  bodySy: [[0, 0], [0.18, -0.42, "easeOut"], [0.7, -0.42], [0.82, 0.1], [0.92, -0.03], [1, 0]],
  bodySx: [[0, 0], [0.18, 0.26, "easeOut"], [0.7, 0.26], [0.82, -0.06], [0.92, 0.02], [1, 0]],
  eyeSy: [[0, 0], [0.2, -0.88], [0.7, -0.88], [0.8, 0]],
  leafL: [[0, 0], [0.2, -26], [0.7, -26], [0.82, 12], [1, 0]],
  leafR: [[0, 0], [0.2, 26], [0.7, 26], [0.82, -12], [1, 0]],
  holdGaze: [[0, 0], [0.15, 1], [0.8, 1], [1, 0]],
}) };

/** Somersault: prepares, jumps high, spins 360° in the air, lands happy, duration 1.7s. */
export const somersault = { duration: 1.7, sample: fromTracks({
  rootY: [[0, 0], [0.16, 0, "easeOut"], [0.42, -250], [0.5, -250, "easeIn"], [0.7, 0]],
  bodySx: [[0, 0], [0.16, 0.18], [0.24, -0.1], [0.4, 0], [0.7, 0.16], [0.8, -0.04], [0.9, 0]],
  bodySy: [[0, 0], [0.16, -0.24], [0.24, 0.16], [0.4, 0], [0.7, -0.2], [0.8, 0.05], [0.9, 0]],
  centerRotate: [[0, 0], [0.2, 0], [0.64, 360]],
  lidTop: [[0, 0], [0.12, 0.5], [0.18, 0]],
  happy: [[0, 0], [0.7, 0], [0.76, 1], [0.95, 1], [1, 0]],
  leafL: [[0, 0], [0.16, -16], [0.3, 24], [0.7, -14], [0.85, 6], [1, 0]],
  leafR: [[0, 0], [0.16, 16], [0.3, -24], [0.7, 14], [0.85, -6], [1, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.9, 1], [1, 0]],
}) };

export const berryReactions = { wink, flatten, somersault };

/** Plays one reaction at a time (no queue — good enough for a demo/cover driver). */
export class BerryReactionPlayer {
  current = null;
  t = 0;

  play(name) {
    const def = berryReactions[name];
    if (!def) return false;
    this.current = def;
    this.t = 0;
    return true;
  }

  get isPlaying() {
    return this.current !== null;
  }

  /** Advances by `dt` seconds; returns this frame's delta fields, or `null` when idle. */
  update(dt) {
    if (!this.current) return null;
    this.t += dt / this.current.duration;
    if (this.t >= 1) {
      this.current = null;
      return null;
    }
    return this.current.sample(this.t);
  }
}
