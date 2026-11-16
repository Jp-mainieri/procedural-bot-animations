import type { PartialDelta } from './delta.js';
import { clamp, fromTracks, track } from './motion.js';
import { TRANSFORMATIONS } from './transformations.js';

/*
 * Reactions: one-shot, added on top of the base layer, and they fade away by
 * themselves. Each one is a function of progress t (0 to 1) that returns a Delta.
 * Activities: loops that last while the app stays in that state
 * (thinking, loading, sleeping), as a function of time in seconds.
 *
 * Several reactions follow Pumpy's grammar: squash, vanish into an object
 * (dots, loading ring, check, </>), the object does its thing, and the
 * character comes back inflating with a bounce.
 */

/* ---------- success, in three levels ---------- */

export type SuccessLevel = 'exercise' | 'lesson' | 'module';

function success(level: SuccessLevel) {
  const h = { exercise: 110, lesson: 170, module: 220 }[level];
  const part = { exercise: 20, lesson: 26, module: 32 }[level];
  const base = fromTracks({
    rootY: [
      [0, 0],
      [0.1, 0, 'easeOut'],
      [0.333, -h],
      [0.433, -h, 'easeIn'],
      [0.6, 0],
    ],
    bodySx: [
      [0, 0],
      [0.1, 0.12],
      [0.2, -0.1],
      [0.333, 0],
      [0.433, -0.04],
      [0.6, 0.14],
      [0.7, -0.03],
      [0.82, 0.02],
      [1, 0],
    ],
    bodySy: [
      [0, 0],
      [0.1, -0.16],
      [0.2, 0.14],
      [0.333, 0],
      [0.433, 0.05],
      [0.6, -0.18],
      [0.7, 0.05],
      [0.82, -0.02],
      [1, 0],
    ],
    partL: [
      [0, 0],
      [0.1, -10],
      [0.333, part],
      [0.6, -12],
      [0.75, 6],
      [1, 0],
    ],
    partR: [
      [0, 0],
      [0.1, 10],
      [0.333, -part],
      [0.6, 12],
      [0.75, -6],
      [1, 0],
    ],
    partC: [
      [0, 0],
      [0.1, -3],
      [0.333, 7],
      [0.6, -5],
      [0.8, 3],
      [1, 0],
    ],
    happy: [
      [0, 0],
      [0.15, 0],
      [0.3, 1],
      [0.85, 1],
      [1, 0],
    ],
    holdGaze: [
      [0, 0],
      [0.15, 0.8],
      [0.85, 0.8],
      [1, 0],
    ],
    sparks: [
      [0, 0],
      [0.3, 0, 'linear'],
      [0.9, 1],
      [0.9001, 0],
    ],
  });
  if (level !== 'module') return base;
  // Module: a somersault in the air (360° equals 0°, so it does not need to return).
  const spin = track([
    [0, 0],
    [0.12, 0],
    [0.52, 360],
  ]);
  return (t: number) => ({ ...base(t), centerRotate: spin(t) });
}

/* ---------- expression reactions ---------- */

const almostThere = fromTracks({
  bodyRotate: [
    [0, 0],
    [0.2, -6],
    [0.3, 5],
    [0.4, -4],
    [0.5, 3],
    [0.6, 0],
  ],
  bodySx: [
    [0, 0],
    [0.08, 0.06],
    [0.2, 0],
    [0.75, 0.04],
    [0.86, -0.02],
    [1, 0],
  ],
  bodySy: [
    [0, 0],
    [0.08, -0.06],
    [0.2, 0],
    [0.75, -0.03],
    [0.86, 0.04],
    [1, 0],
  ],
  eyeY: [
    [0, 0],
    [0.1, 16],
    [0.6, 16],
    [0.78, -4],
    [1, 0],
  ],
  lidTop: [
    [0, 0],
    [0.1, 0.3],
    [0.6, 0.3],
    [0.78, 0],
  ],
  lidAngle: [
    [0, 0],
    [0.1, -18],
    [0.6, -18],
    [0.78, 8],
    [1, 0],
  ],
  partL: [
    [0, 0],
    [0.15, -18],
    [0.6, -18],
    [0.8, 6],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.15, 18],
    [0.6, 18],
    [0.8, -6],
    [1, 0],
  ],
  partC: [
    [0, 0],
    [0.15, 14],
    [0.6, 14],
    [0.8, -4],
    [1, 0],
  ],
  rootY: [
    [0, 0],
    [0.15, 10],
    [0.6, 10],
    [0.8, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 0.9],
    [0.7, 0.9],
    [1, 0],
  ],
});

const fright = fromTracks({
  rootY: [
    [0, 0],
    [0.12, -45, 'easeIn'],
    [0.3, 0],
  ],
  bodyRotate: [
    [0, 0],
    [0.12, -5],
    [0.5, -3],
    [1, 0],
  ],
  bodySx: [
    [0, 0],
    [0.12, -0.08],
    [0.3, 0.12],
    [0.42, -0.03],
    [0.55, 0],
  ],
  bodySy: [
    [0, 0],
    [0.12, 0.1],
    [0.3, -0.14],
    [0.42, 0.04],
    [0.55, 0],
  ],
  // Eyes become tiny dots (• •), Pumpy's fright.
  eyeSx: [
    [0, 0],
    [0.08, -0.45],
    [0.7, -0.45],
    [1, 0],
  ],
  eyeSy: [
    [0, 0],
    [0.08, -0.62],
    [0.7, -0.62],
    [1, 0],
  ],
  partL: [
    [0, 0],
    [0.12, 24],
    [0.5, 10],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.12, -24],
    [0.5, -10],
    [1, 0],
  ],
  partC: [
    [0, 0],
    [0.12, -10],
    [0.5, 4],
    [1, 0],
  ],
  exclaim: [
    [0, 0],
    [0.08, 1],
    [0.8, 1],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.7, 1],
    [1, 0],
  ],
});

const idea = fromTracks({
  rootY: [
    [0, 0],
    [0.12, 0],
    [0.24, -40, 'easeIn'],
    [0.4, 0],
  ],
  bodySy: [
    [0, 0],
    [0.12, -0.06],
    [0.24, 0.06],
    [0.4, -0.04],
    [0.5, 0],
  ],
  partC: [
    [0, 0],
    [0.2, -14],
    [0.4, 6],
    [0.6, -3],
    [1, 0],
  ],
  eyeX: [
    [0, 0],
    [0.15, 22],
    [0.85, 22],
    [1, 0],
  ],
  eyeY: [
    [0, 0],
    [0.15, -22],
    [0.85, -22],
    [1, 0],
  ],
  eyeSy: [
    [0, 0],
    [0.15, 0.12],
    [0.85, 0.12],
    [1, 0],
  ],
  lamp: [
    [0, 0],
    [0.15, 1],
    [0.85, 1],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.85, 1],
    [1, 0],
  ],
});

/** "Copied that, huh?": turns the face sideways and squints, suspicious. */
const copiedThat = fromTracks({
  turn: [
    [0, 0],
    [0.15, -0.9],
    [0.85, -0.9],
    [1, 0],
  ],
  lidTop: [
    [0, 0],
    [0.2, 0.5],
    [0.85, 0.5],
    [1, 0],
  ],
  lidBottom: [
    [0, 0],
    [0.2, 0.15],
    [0.85, 0.15],
    [1, 0],
  ],
  lidAngle: [
    [0, 0],
    [0.2, 20],
    [0.85, 20],
    [1, 0],
  ],
  eyeX: [
    [0, 0],
    [0.15, 18],
    [0.85, 18],
    [1, 0],
  ],
  partL: [
    [0, 0],
    [0.2, -12],
    [0.85, -12],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.2, 12],
    [0.85, 12],
    [1, 0],
  ],
  bodyRotate: [
    [0, 0],
    [0.2, -3],
    [0.85, -3],
    [1, 0],
  ],
  bodySy: [
    [0, 0],
    [0.2, 0.03],
    [0.85, 0.03],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.12, 1],
    [0.88, 1],
    [1, 0],
  ],
});

const welcome = fromTracks({
  rootY: [
    [0, 430, 'easeOut'],
    [0.25, -60, 'easeIn'],
    [0.35, 0],
  ],
  opacity: [
    [0, -1],
    [0.15, 0],
  ],
  bodySx: [
    [0, -0.1],
    [0.25, -0.06],
    [0.35, 0.14],
    [0.45, -0.03],
    [0.55, 0],
  ],
  bodySy: [
    [0, 0.2],
    [0.25, 0.1],
    [0.35, -0.16],
    [0.45, 0.04],
    [0.55, 0],
  ],
  partR: [
    [0, 0],
    [0.55, 0],
    [0.63, -36],
    [0.71, -8],
    [0.79, -36],
    [0.87, -8],
    [0.95, 0],
  ],
  partL: [
    [0, 0],
    [0.4, -8],
    [0.6, 6],
    [0.8, -2],
    [1, 0],
  ],
  partC: [
    [0, 0],
    [0.3, 10],
    [0.5, -5],
    [0.7, 3],
    [1, 0],
  ],
  happyRight: [
    [0, 0],
    [0.55, 0],
    [0.6, 1],
    [0.92, 1],
    [1, 0],
  ],
  shadow: [
    [0, -0.7],
    [0.35, 0],
  ],
});

const DIZZY_ENVELOPE = track([
  [0, 0],
  [0.15, 1],
  [0.75, 1],
  [1, 0],
]);

/** Easter egg: eyes spinning in a circle and the body staggering. */
function dizzy(t: number): PartialDelta {
  const e = DIZZY_ENVELOPE(t);
  const a = t * Math.PI * 6;
  return {
    eyeX: Math.cos(a) * 26 * e,
    eyeY: Math.sin(a) * 26 * e,
    eyeSx: -0.3 * e,
    eyeSy: -0.5 * e,
    bodyRotate: Math.sin(t * Math.PI * 4) * 7 * e,
    partL: Math.sin(t * Math.PI * 5) * 14 * e,
    partR: Math.sin(t * Math.PI * 5 + 1) * 14 * e,
    holdGaze: e,
  };
}

const wake = fromTracks({
  rootY: [
    [0, 0],
    [0.3, -60, 'easeIn'],
    [0.6, 0],
  ],
  eyeSy: [
    [0, 0],
    [0.25, 0.2],
    [1, 0],
  ],
  partL: [
    [0, 0],
    [0.3, 20],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.3, -20],
    [1, 0],
  ],
});

/* ---------- new reactions, Pumpy style ---------- */

/** Wink: one eye arcs happy, the body leans, a small hop. */
const wink = fromTracks({
  happyRight: [
    [0, 0],
    [0.12, 1],
    [0.7, 1],
    [0.85, 0],
  ],
  lidBottom: [
    [0, 0],
    [0.12, 0.25],
    [0.7, 0.25],
    [0.85, 0],
  ],
  bodyRotate: [
    [0, 0],
    [0.15, 7],
    [0.7, 7],
    [1, 0],
  ],
  rootY: [
    [0, 0],
    [0.08, -26, 'easeIn'],
    [0.2, 0],
  ],
  partR: [
    [0, 0],
    [0.15, -22],
    [0.35, -6],
    [0.55, -18],
    [1, 0],
  ],
  turn: [
    [0, 0],
    [0.15, 0.35],
    [0.7, 0.35],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.8, 1],
    [1, 0],
  ],
});

/** Cheerful: sways from side to side with arc eyes (column 2 of the video). */
function cheerful(t: number): PartialDelta {
  const e = track([
    [0, 0],
    [0.12, 1],
    [0.85, 1],
    [1, 0],
  ])(t);
  const phase = t * Math.PI * 6;
  const side = Math.sin(phase);
  return {
    happy: e,
    bodyRotate: side * 9 * e,
    rootY: -Math.abs(Math.cos(phase)) * 22 * e,
    bodySx: Math.abs(side) * 0.04 * e,
    bodySy: -Math.abs(side) * 0.05 * e,
    partL: (10 + side * 8) * e,
    partR: (-10 + side * 8) * e,
    turn: side * 0.35 * e,
    holdGaze: e,
  };
}

/** Profile: looks around by turning the whole face sideways, until in profile. */
const profile = fromTracks({
  turn: [
    [0, 0],
    [0.14, 1.55],
    [0.42, 1.55],
    [0.56, -1.55],
    [0.84, -1.55],
    [1, 0],
  ],
  eyeY: [
    [0, 0],
    [0.14, -8],
    [0.84, -8],
    [1, 0],
  ],
  bodyRotate: [
    [0, 0],
    [0.14, 3],
    [0.42, 3],
    [0.56, -3],
    [0.84, -3],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.08, 1],
    [0.92, 1],
    [1, 0],
  ],
});

/** Flatten: lies on the floor like play dough, line eyes, and pops back (start of column 6). */
const flatten = fromTracks({
  bodySy: [
    [0, 0],
    [0.18, -0.42, 'easeOut'],
    [0.7, -0.42],
    [0.82, 0.1],
    [0.92, -0.03],
    [1, 0],
  ],
  bodySx: [
    [0, 0],
    [0.18, 0.26, 'easeOut'],
    [0.7, 0.26],
    [0.82, -0.06],
    [0.92, 0.02],
    [1, 0],
  ],
  eyeSy: [
    [0, 0],
    [0.2, -0.88],
    [0.7, -0.88],
    [0.8, 0],
  ],
  partL: [
    [0, 0],
    [0.2, -26],
    [0.7, -26],
    [0.82, 12],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.2, 26],
    [0.7, 26],
    [0.82, -12],
    [1, 0],
  ],
  zzz: [
    [0, 0],
    [0.3, 0],
    [0.38, 1],
    [0.66, 1],
    [0.72, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.15, 1],
    [0.8, 1],
    [1, 0],
  ],
});

/** Confused: dot eyes, tilted head, a swaying "?". */
const confused = fromTracks({
  eyeSx: [
    [0, 0],
    [0.12, -0.4],
    [0.8, -0.4],
    [1, 0],
  ],
  eyeSy: [
    [0, 0],
    [0.12, -0.55],
    [0.8, -0.55],
    [1, 0],
  ],
  bodyRotate: [
    [0, 0],
    [0.15, -10],
    [0.45, -10],
    [0.55, 8],
    [0.8, 8],
    [1, 0],
  ],
  turn: [
    [0, 0],
    [0.15, -0.3],
    [0.45, -0.3],
    [0.55, 0.3],
    [0.8, 0.3],
    [1, 0],
  ],
  partC: [
    [0, 0],
    [0.15, -12],
    [0.45, -12],
    [0.55, 12],
    [0.8, 12],
    [1, 0],
  ],
  question: [
    [0, 0],
    [0.12, 1],
    [0.85, 1],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.85, 1],
    [1, 0],
  ],
});

/** Somersault: prepares, jumps high, does a full turn in the air, lands happy. */
const somersault = fromTracks({
  rootY: [
    [0, 0],
    [0.16, 0, 'easeOut'],
    [0.42, -250],
    [0.5, -250, 'easeIn'],
    [0.7, 0],
  ],
  bodySx: [
    [0, 0],
    [0.16, 0.18],
    [0.24, -0.1],
    [0.4, 0],
    [0.7, 0.16],
    [0.8, -0.04],
    [0.9, 0],
  ],
  bodySy: [
    [0, 0],
    [0.16, -0.24],
    [0.24, 0.16],
    [0.4, 0],
    [0.7, -0.2],
    [0.8, 0.05],
    [0.9, 0],
  ],
  centerRotate: [
    [0, 0],
    [0.2, 0],
    [0.64, 360],
  ],
  lidTop: [
    [0, 0],
    [0.12, 0.5],
    [0.18, 0],
  ],
  happy: [
    [0, 0],
    [0.7, 0],
    [0.76, 1],
    [0.95, 1],
    [1, 0],
  ],
  partL: [
    [0, 0],
    [0.16, -16],
    [0.3, 24],
    [0.7, -14],
    [0.85, 6],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.16, 16],
    [0.3, -24],
    [0.7, 14],
    [0.85, -6],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.9, 1],
    [1, 0],
  ],
});

/** Ignite (Flame): is born from an ember, grows past the mark and throws out rays. */
const ignite = fromTracks({
  scale: [
    [0, -0.75],
    [0.35, 0.22, 'easeOut'],
    [0.5, -0.06],
    [0.62, 0],
  ],
  bodySy: [
    [0, -0.2],
    [0.35, 0.12],
    [0.5, -0.04],
    [0.62, 0],
  ],
  partC: [
    [0, -20],
    [0.35, 16],
    [0.5, -8],
    [0.7, 0],
  ],
  rays: [
    [0, 0],
    [0.3, 0],
    [0.38, 1],
    [0.85, 1],
    [1, 0],
  ],
  happy: [
    [0, 0],
    [0.38, 0],
    [0.44, 1],
    [0.85, 1],
    [1, 0],
  ],
  shadow: [
    [0, -0.8],
    [0.35, 0],
  ],
  embers: [
    [0, 0],
    [0.3, 0],
    [0.38, 1],
    [0.8, 1],
    [1, 0],
  ],
  core: [
    [0, 0],
    [0.3, 0],
    [0.38, 0.8],
    [0.65, 0],
  ],
});

/* ---------- Flame only ---------- */

/**
 * Extinguish: the scare of losing the streak. Smoke, squeezed eyes, a
 * shiver. The extinguished state itself is the `out` activity.
 */
const extinguish = fromTracks({
  smoke: [
    [0, 0],
    [0.1, 1],
    [0.7, 1],
    [1, 0],
  ],
  bodySy: [
    [0, 0],
    [0.08, 0.12],
    [0.2, -0.16],
    [0.32, 0.05],
    [0.45, -0.02],
    [0.6, 0],
  ],
  bodySx: [
    [0, 0],
    [0.08, -0.06],
    [0.2, 0.12],
    [0.32, -0.03],
    [0.6, 0],
  ],
  partC: [
    [0, 0],
    [0.1, 12],
    [0.18, -10],
    [0.26, 7],
    [0.34, -4],
    [0.5, 0],
  ],
  closeLeft: [
    [0, 0],
    [0.08, 1],
    [0.6, 1],
    [0.8, 0],
  ],
  closeRight: [
    [0, 0],
    [0.08, 1],
    [0.6, 1],
    [0.8, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.08, 1],
    [0.8, 1],
    [1, 0],
  ],
});

/** Streak milestone: becomes a blaze, rises, lights the core, throws embers and sparks. */
const blaze = fromTracks({
  rootY: [
    [0, 0],
    [0.12, 0, 'easeOut'],
    [0.3, -120],
    [0.45, -120, 'easeIn'],
    [0.6, 0],
  ],
  bodySy: [
    [0, 0],
    [0.1, -0.18],
    [0.25, 0.35],
    [0.45, 0.3],
    [0.6, -0.15],
    [0.72, 0.06],
    [0.85, 0],
  ],
  bodySx: [
    [0, 0],
    [0.1, 0.14],
    [0.25, -0.12],
    [0.45, -0.1],
    [0.6, 0.16],
    [0.72, -0.04],
    [0.85, 0],
  ],
  partC: [
    [0, 0],
    [0.1, -14],
    [0.25, 18],
    [0.4, -12],
    [0.55, 10],
    [0.7, -5],
    [0.85, 0],
  ],
  partL: [
    [0, 0],
    [0.1, -10],
    [0.25, 24],
    [0.6, -10],
    [0.8, 0],
  ],
  partR: [
    [0, 0],
    [0.1, 10],
    [0.25, -24],
    [0.6, 10],
    [0.8, 0],
  ],
  core: [
    [0, 0],
    [0.2, 0],
    [0.3, 1],
    [0.8, 1],
    [1, 0],
  ],
  rays: [
    [0, 0],
    [0.25, 0],
    [0.3, 1],
    [0.85, 1],
    [1, 0],
  ],
  embers: [
    [0, 0],
    [0.25, 0],
    [0.3, 1],
    [0.85, 1],
    [1, 0],
  ],
  happy: [
    [0, 0],
    [0.2, 0],
    [0.3, 1],
    [0.85, 1],
    [1, 0],
  ],
  sparks: [
    [0, 0],
    [0.28, 0, 'linear'],
    [0.85, 1],
    [0.8501, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.15, 0.8],
    [0.85, 0.8],
    [1, 0],
  ],
});

/** Gust of wind from the left: leans over, squints, holds and comes back swaying. */
const gust = fromTracks({
  bodyRotate: [
    [0, 0],
    [0.1, 4],
    [0.2, 14],
    [0.5, 12],
    [0.6, -6],
    [0.7, 4],
    [0.8, -2],
    [0.9, 0],
  ],
  bodySx: [
    [0, 0],
    [0.2, 0.08],
    [0.5, 0.06],
    [0.6, -0.04],
    [0.75, 0],
  ],
  bodySy: [
    [0, 0],
    [0.2, -0.12],
    [0.5, -0.1],
    [0.6, 0.06],
    [0.75, 0],
  ],
  scale: [
    [0, 0],
    [0.2, -0.08],
    [0.5, -0.06],
    [0.65, 0.04],
    [0.8, 0],
  ],
  partC: [
    [0, 0],
    [0.15, 20],
    [0.25, 30],
    [0.35, 24],
    [0.5, 30],
    [0.6, -14],
    [0.72, 8],
    [0.85, -3],
    [1, 0],
  ],
  partL: [
    [0, 0],
    [0.15, 20],
    [0.25, 26],
    [0.5, 24],
    [0.6, -12],
    [0.75, 4],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.15, 20],
    [0.25, 26],
    [0.5, 24],
    [0.6, -12],
    [0.75, 4],
    [1, 0],
  ],
  lidTop: [
    [0, 0],
    [0.12, 0.45],
    [0.5, 0.45],
    [0.62, 0],
  ],
  lidBottom: [
    [0, 0],
    [0.12, 0.3],
    [0.5, 0.3],
    [0.62, 0],
  ],
  eyeX: [
    [0, 0],
    [0.15, 18],
    [0.5, 18],
    [0.62, 0],
  ],
  turn: [
    [0, 0],
    [0.15, -0.3],
    [0.5, -0.3],
    [0.62, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.6, 1],
    [0.8, 0],
  ],
});

/** Crackle: three little pops, each with a small hop and a happy blink, throwing embers. */
const crackle = fromTracks({
  rootY: [
    [0, 0],
    [0.06, 0, 'easeOut'],
    [0.14, -50, 'easeIn'],
    [0.22, 0],
    [0.3, 0, 'easeOut'],
    [0.38, -70, 'easeIn'],
    [0.46, 0],
    [0.56, 0, 'easeOut'],
    [0.66, -40, 'easeIn'],
    [0.76, 0],
  ],
  bodySy: [
    [0, 0],
    [0.05, -0.1],
    [0.1, 0.08],
    [0.22, -0.08],
    [0.28, 0.06],
    [0.46, -0.1],
    [0.52, 0.05],
    [0.76, -0.06],
    [0.85, 0],
  ],
  bodySx: [
    [0, 0],
    [0.05, 0.06],
    [0.1, -0.04],
    [0.22, 0.05],
    [0.28, -0.03],
    [0.46, 0.06],
    [0.52, -0.02],
    [0.76, 0.04],
    [0.85, 0],
  ],
  partC: [
    [0, 0],
    [0.14, 10],
    [0.22, -8],
    [0.38, 12],
    [0.46, -10],
    [0.66, 8],
    [0.76, -6],
    [0.9, 0],
  ],
  embers: [
    [0, 0],
    [0.1, 1],
    [0.8, 1],
    [1, 0],
  ],
  happyLeft: [
    [0, 0],
    [0.1, 1],
    [0.24, 1],
    [0.3, 0],
  ],
  happyRight: [
    [0, 0],
    [0.3, 0],
    [0.36, 1],
    [0.5, 1],
    [0.56, 0],
  ],
  happy: [
    [0, 0],
    [0.56, 0],
    [0.64, 1],
    [0.9, 1],
    [1, 0],
  ],
});

/** Sneeze: "a... a..." (stretches, eyes closing, leans back) and "achoo!" with sparks. */
const sneeze = fromTracks({
  bodySy: [
    [0, 0],
    [0.15, 0.08],
    [0.3, 0.12],
    [0.42, 0.2],
    [0.48, -0.26],
    [0.56, 0.08],
    [0.64, -0.04],
    [0.75, 0],
  ],
  bodySx: [
    [0, 0],
    [0.42, -0.08],
    [0.48, 0.2],
    [0.56, -0.05],
    [0.64, 0.02],
    [0.75, 0],
  ],
  bodyRotate: [
    [0, 0],
    [0.15, -3],
    [0.3, -5],
    [0.42, -9],
    [0.48, 16],
    [0.58, -6],
    [0.68, 3],
    [0.8, 0],
  ],
  scale: [
    [0, 0],
    [0.46, 0],
    [0.5, -0.12],
    [0.62, 0.03],
    [0.75, 0],
  ],
  partC: [
    [0, 0],
    [0.42, -12],
    [0.48, 26],
    [0.58, -12],
    [0.7, 6],
    [0.85, 0],
  ],
  closeLeft: [
    [0, 0],
    [0.15, 0.3],
    [0.3, 0.45],
    [0.42, 0.8],
    [0.46, 1],
    [0.6, 1],
    [0.7, 0],
  ],
  closeRight: [
    [0, 0],
    [0.15, 0.3],
    [0.3, 0.45],
    [0.42, 0.8],
    [0.46, 1],
    [0.6, 1],
    [0.7, 0],
  ],
  lidAngle: [
    [0, 0],
    [0.3, -14],
    [0.46, -14],
    [0.6, 0],
  ],
  eyeY: [
    [0, 0],
    [0.42, -14],
    [0.48, 10],
    [0.6, 0],
  ],
  sparks: [
    [0, 0],
    [0.46, 0, 'linear'],
    [0.95, 1],
    [0.9501, 0],
  ],
  embers: [
    [0, 0],
    [0.46, 0],
    [0.5, 1],
    [0.85, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.75, 1],
    [0.9, 0],
  ],
});

/** Tier up: squashes, leaps spinning, grows in the air (the colour swaps here) and lands happy. */
const tierUp = fromTracks({
  rootY: [
    [0, 0],
    [0.12, 0, 'easeOut'],
    [0.4, -180],
    [0.5, -180, 'easeIn'],
    [0.68, 0],
  ],
  centerRotate: [
    [0, 0],
    [0.14, 0],
    [0.5, 360],
  ],
  bodySy: [
    [0, 0],
    [0.1, -0.2],
    [0.2, 0.12],
    [0.4, 0],
    [0.68, -0.2],
    [0.78, 0.06],
    [0.9, 0],
  ],
  bodySx: [
    [0, 0],
    [0.1, 0.16],
    [0.2, -0.08],
    [0.4, 0],
    [0.68, 0.18],
    [0.78, -0.04],
    [0.9, 0],
  ],
  scale: [
    [0, 0],
    [0.1, -0.1],
    [0.3, -0.2],
    [0.48, 0.25],
    [0.62, 0.1],
    [0.72, -0.05],
    [0.85, 0],
  ],
  core: [
    [0, 0],
    [0.35, 0],
    [0.45, 1],
    [0.7, 1],
    [0.9, 0],
  ],
  sparks: [
    [0, 0],
    [0.45, 0, 'linear'],
    [0.95, 1],
    [0.9501, 0],
  ],
  happy: [
    [0, 0],
    [0.5, 0],
    [0.56, 1],
    [0.9, 1],
    [1, 0],
  ],
  rays: [
    [0, 0],
    [0.5, 0],
    [0.56, 1],
    [0.9, 1],
    [1, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.9, 1],
    [1, 0],
  ],
});

/** Moment of the `tierUp` reaction at which the tier (the colour) swaps, from 0 to 1. */
export const TIER_SWAP_T = 0.45;

/* ---------- interactions (cursor and clicks) ---------- */

/** Cursor arrived: widens the eyes toward it, stretches a little, parts standing up. */
const peek = fromTracks({
  eyeSy: [
    [0, 0],
    [0.12, 0.16],
    [0.6, 0.12],
    [1, 0],
  ],
  eyeSx: [
    [0, 0],
    [0.12, 0.1],
    [0.6, 0.08],
    [1, 0],
  ],
  bodySy: [
    [0, 0],
    [0.1, -0.05],
    [0.24, 0.06],
    [0.4, -0.02],
    [0.55, 0],
  ],
  bodySx: [
    [0, 0],
    [0.1, 0.05],
    [0.24, -0.04],
    [0.4, 0.01],
    [0.55, 0],
  ],
  partL: [
    [0, 0],
    [0.15, 16],
    [0.7, 12],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.15, -16],
    [0.7, -12],
    [1, 0],
  ],
  partC: [
    [0, 0],
    [0.12, 6],
    [0.3, -4],
    [0.5, 0],
  ],
});

/** Shy: shrinks, turns the face away, looks down smiling and peeks back. */
const shy = fromTracks({
  scale: [
    [0, 0],
    [0.15, -0.07],
    [0.7, -0.06],
    [0.9, 0],
  ],
  bodyRotate: [
    [0, 0],
    [0.15, -7],
    [0.55, -6],
    [0.75, 2],
    [0.9, 0],
  ],
  turn: [
    [0, 0],
    [0.15, -0.55],
    [0.5, -0.55],
    [0.62, -0.15],
    [0.9, 0],
  ],
  eyeY: [
    [0, 0],
    [0.15, 16],
    [0.5, 16],
    [0.62, 4],
    [0.9, 0],
  ],
  lidBottom: [
    [0, 0],
    [0.15, 0.35],
    [0.75, 0.35],
    [0.95, 0],
  ],
  partL: [
    [0, 0],
    [0.15, -10],
    [0.7, -8],
    [0.9, 0],
  ],
  partR: [
    [0, 0],
    [0.15, 10],
    [0.7, 8],
    [0.9, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.55, 1],
    [0.85, 0],
  ],
});

/** Two small hops, the second higher. */
const doubleHop = fromTracks({
  rootY: [
    [0, 0],
    [0.08, 0, 'easeOut'],
    [0.2, -60, 'easeIn'],
    [0.34, 0],
    [0.4, 0, 'easeOut'],
    [0.56, -110, 'easeIn'],
    [0.74, 0],
  ],
  bodySy: [
    [0, 0],
    [0.06, -0.12],
    [0.14, 0.08],
    [0.34, -0.12],
    [0.42, 0.1],
    [0.74, -0.14],
    [0.84, 0.04],
    [0.95, 0],
  ],
  bodySx: [
    [0, 0],
    [0.06, 0.1],
    [0.14, -0.05],
    [0.34, 0.1],
    [0.42, -0.06],
    [0.74, 0.12],
    [0.84, -0.03],
    [0.95, 0],
  ],
  happy: [
    [0, 0],
    [0.4, 0],
    [0.48, 1],
    [0.85, 1],
    [1, 0],
  ],
});

/** Laugh: fast laughing shake, arc eyes, parts flapping. */
function laugh(t: number): PartialDelta {
  const env = Math.sin(Math.min(1, t / 0.9) * Math.PI) ** 0.6;
  const k = Math.sin(t * 2 * Math.PI * 9);
  return {
    bodySy: 0.05 * k * env,
    bodySx: -0.035 * k * env,
    bodyRotate: 3 * Math.sin(t * 2 * Math.PI * 4.5) * env,
    rootY: -10 * Math.abs(k) * env,
    happy: Math.min(1, t * 10) * (t < 0.85 ? 1 : (1 - t) / 0.15),
    partL: 12 * k * env,
    partR: -12 * k * env,
    partC: 6 * k * env,
    holdGaze: 0.8 * env,
  };
}

/** Huff (three clicks): fills with air, angry face, and lets it all out shaking. */
const huff = fromTracks({
  bodySx: [
    [0, 0],
    [0.3, 0.14, 'easeOut'],
    [0.55, 0.14],
    [0.62, -0.08],
    [0.7, 0.04],
    [0.8, -0.02],
    [0.9, 0],
  ],
  bodySy: [
    [0, 0],
    [0.3, 0.06, 'easeOut'],
    [0.55, 0.06],
    [0.62, -0.08],
    [0.7, 0.03],
    [0.85, 0],
  ],
  lidTop: [
    [0, 0],
    [0.15, 0.36],
    [0.75, 0.36],
    [0.95, 0],
  ],
  lidAngle: [
    [0, 0],
    [0.15, 26],
    [0.75, 26],
    [0.95, 0],
  ],
  partC: [
    [0, 0],
    [0.3, 10],
    [0.55, 10],
    [0.6, -16],
    [0.66, 12],
    [0.72, -8],
    [0.8, 4],
    [0.9, 0],
  ],
  partL: [
    [0, 0],
    [0.3, 18],
    [0.55, 18],
    [0.62, -8],
    [0.75, 0],
  ],
  partR: [
    [0, 0],
    [0.3, -18],
    [0.55, -18],
    [0.62, 8],
    [0.75, 0],
  ],
  exclaim: [
    [0, 0],
    [0.55, 0],
    [0.6, 1],
    [0.85, 1],
    [0.95, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 0.7],
    [0.85, 0.7],
    [1, 0],
  ],
});

/** Hide (eight clicks): flattens on the floor with eyes shut, peeks with one eye and gets up. */
const hide = fromTracks({
  bodySy: [
    [0, 0],
    [0.12, -0.38, 'easeOut'],
    [0.62, -0.36],
    [0.78, 0.1],
    [0.88, -0.03],
    [1, 0],
  ],
  bodySx: [
    [0, 0],
    [0.12, 0.22, 'easeOut'],
    [0.62, 0.2],
    [0.78, -0.06],
    [0.88, 0.02],
    [1, 0],
  ],
  partL: [
    [0, 0],
    [0.12, -24],
    [0.62, -22],
    [0.8, 10],
    [1, 0],
  ],
  partR: [
    [0, 0],
    [0.12, 24],
    [0.62, 22],
    [0.8, -10],
    [1, 0],
  ],
  closeLeft: [
    [0, 0],
    [0.1, 1],
    [0.66, 1],
    [0.76, 0],
  ],
  closeRight: [
    [0, 0],
    [0.1, 1],
    [0.36, 1],
    [0.42, 0.15],
    [0.52, 0.15],
    [0.58, 1],
    [0.66, 1],
    [0.76, 0],
  ],
  eyeX: [
    [0.36, 0],
    [0.42, 26],
    [0.52, 26],
    [0.58, 0],
  ],
  eyeY: [
    [0, 0],
    [0.12, 18],
    [0.66, 18],
    [0.78, 0],
  ],
  lidTop: [
    [0.36, 0],
    [0.42, 0.25],
    [0.52, 0.25],
    [0.58, 0],
  ],
  partAmp: [
    [0, 0],
    [0.12, -0.9],
    [0.62, -0.9],
    [0.8, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.8, 1],
    [1, 0],
  ],
});

/** Warm up (Flame, cursor over it): grows a little, core lights up, little embers, arc eyes. */
const warmUp = fromTracks({
  scale: [
    [0, 0],
    [0.2, 0.1, 'easeOut'],
    [0.32, 0.04],
    [0.7, 0.06],
    [1, 0],
  ],
  bodySy: [
    [0, 0],
    [0.2, 0.08],
    [0.32, -0.02],
    [0.7, 0.03],
    [1, 0],
  ],
  core: [
    [0, 0],
    [0.2, 0.7],
    [0.75, 0.6],
    [1, 0],
  ],
  embers: [
    [0, 0],
    [0.2, 0.7],
    [0.75, 0.6],
    [1, 0],
  ],
  happy: [
    [0, 0],
    [0.18, 1],
    [0.8, 1],
    [1, 0],
  ],
  partC: [
    [0, 0],
    [0.2, -10],
    [0.35, 8],
    [0.5, -4],
    [0.65, 0],
  ],
});

/** Heat up (Flame, three clicks): boils with anger, grows, angry face, rays and "!". */
function heatUp(t: number): PartialDelta {
  const env = track([
    [0, 0],
    [0.15, 1, 'easeOut'],
    [0.8, 1],
    [1, 0],
  ])(t);
  const boil = Math.sin(t * 2 * Math.PI * 7);
  return {
    scale: 0.16 * env,
    bodySy: (0.1 + 0.03 * boil) * env,
    bodySx: -0.03 * boil * env,
    lidTop: 0.36 * env,
    lidAngle: 28 * env,
    partC: 14 * boil * env,
    partL: -10 * boil * env,
    core: 0.8 * env,
    rays: env,
    exclaim: t > 0.2 && t < 0.85 ? 1 : 0,
    embers: env,
    holdGaze: 0.8 * env,
  };
}

/** Burst (Flame, eight clicks): swells, explodes into sparks, becomes a dizzy ember and relights. */
const burst = fromTracks({
  scale: [
    [0, 0],
    [0.12, 0.3, 'easeIn'],
    [0.16, -0.5, 'easeOut'],
    [0.62, -0.5, 'easeOut'],
    [0.76, 0.14],
    [0.84, -0.04],
    [0.92, 0],
  ],
  bodySx: [
    [0, 0],
    [0.12, 0.12],
    [0.16, -0.1],
    [0.22, 0.06],
    [0.3, 0],
  ],
  gray: [
    [0, 0],
    [0.16, 0],
    [0.2, 0.7],
    [0.6, 0.7],
    [0.72, 0],
  ],
  smoke: [
    [0, 0],
    [0.18, 0],
    [0.22, 1],
    [0.55, 0.6],
    [0.7, 0],
  ],
  sparks: [
    [0, 0],
    [0.14, 0, 'linear'],
    [0.6, 1],
    [0.6001, 0],
  ],
  eyeSy: [
    [0, 0],
    [0.12, 0.2],
    [0.16, -0.7],
    [0.6, -0.7],
    [0.7, 0],
  ],
  eyeX: [
    [0.2, 0],
    [0.28, -12],
    [0.36, 12],
    [0.44, -12],
    [0.52, 12],
    [0.6, 0],
  ],
  rays: [
    [0, 0],
    [0.7, 0],
    [0.76, 1],
    [0.92, 1],
    [1, 0],
  ],
  happy: [
    [0, 0],
    [0.72, 0],
    [0.78, 1],
    [0.92, 1],
    [1, 0],
  ],
  embers: [
    [0, 0],
    [0.7, 0],
    [0.76, 1],
    [0.95, 0],
  ],
  holdGaze: [
    [0, 0],
    [0.1, 1],
    [0.9, 1],
    [1, 0],
  ],
});

/** A reaction: its duration in seconds and a sampler of progress t (0 to 1). */
export type ReactionDef = { duration: number; sample: (t: number) => PartialDelta };

export const REACTIONS = {
  success: { duration: 1.6, sample: success('lesson') },
  successExercise: { duration: 1.2, sample: success('exercise') },
  successModule: { duration: 2.4, sample: success('module') },
  almostThere: { duration: 1.6, sample: almostThere },
  fright: { duration: 0.9, sample: fright },
  idea: { duration: 1.6, sample: idea },
  copiedThat: { duration: 2.2, sample: copiedThat },
  welcome: { duration: 2.4, sample: welcome },
  dizzy: { duration: 1.6, sample: dizzy },
  wake: { duration: 0.6, sample: wake },
  wink: { duration: 1.2, sample: wink },
  cheerful: { duration: 2.4, sample: cheerful },
  profile: { duration: 2.8, sample: profile },
  flatten: { duration: 2.4, sample: flatten },
  confused: { duration: 2.0, sample: confused },
  somersault: { duration: 1.7, sample: somersault },
  morphLoading: TRANSFORMATIONS.morphLoading,
  morphCheck: TRANSFORMATIONS.morphCheck,
  morphCode: TRANSFORMATIONS.morphCode,
  energy: TRANSFORMATIONS.energy,
  ignite: { duration: 1.6, sample: ignite },
  extinguish: { duration: 1.8, sample: extinguish },
  blaze: { duration: 2.6, sample: blaze },
  gust: { duration: 2.4, sample: gust },
  crackle: { duration: 1.6, sample: crackle },
  sneeze: { duration: 2.0, sample: sneeze },
  tierUp: { duration: 2.4, sample: tierUp },
  peek: { duration: 1.0, sample: peek },
  shy: { duration: 1.8, sample: shy },
  doubleHop: { duration: 1.3, sample: doubleHop },
  laugh: { duration: 1.3, sample: laugh },
  huff: { duration: 1.8, sample: huff },
  hide: { duration: 3.2, sample: hide },
  warmUp: { duration: 1.8, sample: warmUp },
  heatUp: { duration: 1.8, sample: heatUp },
  burst: { duration: 3.4, sample: burst },
} satisfies Record<string, ReactionDef>;

export type ReactionName = keyof typeof REACTIONS;
export const REACTION_NAMES = Object.keys(REACTIONS) as ReactionName[];

/* ---------- activities (loops) ---------- */

const THINK_LOOK_X = track([
  [0, 0],
  [0.15, -1],
  [0.45, -1],
  [0.58, 1],
  [0.85, 1],
  [1, 0],
]);
const THINK_LOOK_Y = track([
  [0, 0],
  [0.15, -1],
  [0.85, -1],
  [1, 0],
]);

function thinking(s: number): PartialDelta {
  // Looks up to the left, then to the right, and back; 3.6 s cycle.
  const u = (s % 3.6) / 3.6;
  const ox = THINK_LOOK_X(u);
  return {
    eyeX: ox * 22,
    eyeY: THINK_LOOK_Y(u) * 24,
    turn: ox * 0.25,
    lidTop: 0.15,
    lidAngle: -6 * ox,
    bodyRotate: -2 + Math.sin(s * 1.7) * 1.5,
    partC: 3 + Math.sin(s * 2.4) * 5,
    ellipsis: 1,
    holdGaze: 1,
  };
}

function loading(s: number): PartialDelta {
  const u = s % 1;
  const height = 4 * u * (1 - u); // parabola: 0 on the ground, 1 at the top
  const contact = clamp(1 - Math.min(u, 1 - u) / 0.12, 0, 1);
  return {
    rootY: -95 * height,
    bodySx: 0.08 * contact - 0.04 * height,
    bodySy: -0.1 * contact + 0.06 * height,
    eyeX: Math.sin(s * Math.PI) * 14,
    turn: Math.sin(s * Math.PI) * 0.2,
    partC: Math.sin(s * Math.PI * 2) * 7,
    partL: -height * 8,
    partR: height * 8,
    holdGaze: 1,
  };
}

function sleeping(s: number): PartialDelta {
  const r = Math.sin(s * 1.2);
  return {
    eyeSy: -0.9,
    lidTop: 0.3,
    eyeY: 10,
    bodySy: 0.03 * r,
    bodySx: -0.015 * r,
    partL: -12,
    partR: 12,
    partC: -8,
    rootY: 8,
    zzz: 1,
    holdGaze: 1,
    partAmp: -0.7,
  };
}

/** Flame at risk: flickers, loses colour in little jolts, worried look. */
function flickering(s: number): PartialDelta {
  const tremor = Math.sin(s * 13) * Math.sin(s * 3.1);
  // Chokes: now and then it almost goes out.
  const choke = Math.max(0, Math.sin(s * 2.3)) ** 8;
  return {
    scale: -0.12 - 0.16 * choke,
    bodySy: -0.06 + 0.06 * tremor,
    bodySx: 0.03 - 0.03 * tremor,
    bodyRotate: 2.5 * Math.sin(s * 7.7),
    gray: 0.4 + 0.35 * choke,
    lidTop: 0.18,
    lidAngle: -14,
    eyeY: 6,
    eyeSy: -0.1 * choke,
    partC: 6 * Math.sin(s * 11) - 8 * choke,
    partL: 7 * Math.sin(s * 9 + 1),
    partR: -7 * Math.sin(s * 8 + 2),
    partAmp: 0.6,
    smoke: 0.4 * choke,
  };
}

/** Out: a small gray ember, sad eyes, a thread of smoke. */
function out(s: number): PartialDelta {
  const r = Math.sin(s * 1.1);
  return {
    scale: -0.42,
    bodySy: -0.04 + 0.02 * r,
    gray: 1,
    lidTop: 0.5,
    lidAngle: -16,
    eyeY: 12,
    partC: -6,
    partL: -10,
    partR: 10,
    partAmp: -0.8,
    smoke: 0.35,
    holdGaze: 0.5,
  };
}

/** An activity: a loop sampled by time in seconds. */
export type ActivityDef = (s: number) => PartialDelta;

export const ACTIVITIES = { thinking, loading, sleeping, flickering, out } satisfies Record<
  string,
  ActivityDef
>;

export type Activity = keyof typeof ACTIVITIES;
export const ACTIVITY_NAMES = Object.keys(ACTIVITIES) as Activity[];
