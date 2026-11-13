import { BlinkScheduler, type BlinkOptions } from "./blink.js";
import { fakeTurn, type FakeTurnOptions } from "./fake3d.js";
import { GazeEngine, type GazeEngineOptions, type GazeTarget } from "./gaze.js";
import { MoodBlender, type MoodBlenderOptions, type MoodWeights } from "./moods.js";
import { breathing } from "./noise.js";
import { ReactionPlayer, type ReactionPlayerOptions } from "./reactions.js";
import { addPose, neutralPose, resolveDelta, type Pose } from "./types.js";

export interface BrainOptions {
  gaze?: GazeEngineOptions;
  moods?: MoodBlenderOptions;
  reactions?: ReactionPlayerOptions;
  blink?: BlinkOptions;
  fakeTurn?: FakeTurnOptions;
  /** How much of the gaze's vertical offset becomes eye slide, in viewBox units. Default 2.5. */
  gazeRangeY?: number;
  /** Breathing cycles/sec and amount; see `noise.ts#breathing`. */
  breathing?: { frequency?: number; depthAmount?: number };
}

/**
 * The pure, DOM-free core: combines mood blending, gaze (with the fake-3D
 * turn), blinking and one-shot reactions into a single `Pose` every frame.
 * No rendering, no `requestAnimationFrame` — a DOM binder (see
 * `examples/states-demo.html` or write your own) reads `update()`'s output
 * and calls `MountedRig.applyPose`.
 */
export class Brain {
  readonly gazeEngine: GazeEngine;
  readonly moodBlender: MoodBlender;
  readonly reactionPlayer: ReactionPlayer;
  readonly blinkScheduler: BlinkScheduler;
  private clock = 0;
  private readonly opts: BrainOptions;

  constructor(options: BrainOptions = {}) {
    this.opts = options;
    this.gazeEngine = new GazeEngine(options.gaze);
    this.moodBlender = new MoodBlender(options.moods);
    this.reactionPlayer = new ReactionPlayer(options.reactions);
    this.blinkScheduler = new BlinkScheduler(options.blink);
  }

  setMood(weights: MoodWeights): void {
    this.moodBlender.set(weights);
  }

  react(name: string): boolean {
    return this.reactionPlayer.play(name);
  }

  update(dt: number, gazeTarget: GazeTarget | null): Pose {
    this.clock += dt;
    const t = this.clock;

    let pose = neutralPose();

    const moodDelta = this.moodBlender.update(dt);
    pose = addPose(pose, resolveDelta(moodDelta));

    const gaze = this.gazeEngine.update(dt, gazeTarget, t);
    const turnDelta = fakeTurn(gaze.offset.x, this.opts.fakeTurn);
    pose = addPose(pose, resolveDelta(turnDelta));
    pose = addPose(pose, resolveDelta({ eyes: { offsetY: gaze.offset.y * (this.opts.gazeRangeY ?? 2.5) } }));

    const attentionScale = 1 + gaze.attention * 0.15;
    const boredomScale = 1 - gaze.boredom * 0.3;
    pose = addPose(pose, resolveDelta({ eyes: { scaleX: attentionScale * boredomScale, scaleY: attentionScale * boredomScale, shut: gaze.boredom * 0.25 } }));

    const blinkShut = this.blinkScheduler.update(t);
    pose = addPose(pose, resolveDelta({ eyes: { shut: blinkShut } }));

    const breathe = breathing(t, this.opts.breathing);
    pose = addPose(pose, resolveDelta({ body: { scaleY: breathe, scaleX: 1 + (1 - breathe) * 0.5 } }));

    const reactionDelta = this.reactionPlayer.update(dt);
    if (reactionDelta) pose = addPose(pose, resolveDelta(reactionDelta));

    return pose;
  }
}
