import type { DeltaField, PartialDelta } from './delta.js';
import { type Keyframe, type Tracks, track } from './motion.js';
import { CHECK, CODE, DOT_R, DOT_SCALE, RING } from './rig.js';

/*
 * Seamless transformations, in Pumpy's style. Three phases:
 *
 * 1. Entry: anticipates (squashes and stretches), the silhouette becomes a
 *    perfect circle around the anchor, the parts retract inwards, the eyes
 *    close and vanish, and the circle shrinks to the exact radius of the
 *    bubble (`DOT_R`).
 * 2. Object: at the swap frame, the body vanishes and the bubble appears at the
 *    same center, with the same radius and the same colour, so nothing changes
 *    on screen. From there the bubble becomes dots, disc, ring, check or </>
 *    purely through continuous geometry: the dots are born under it, the ring
 *    is a disc that opens a hole, the check and the </> are strokes with the
 *    width of the bubble that grow out of it.
 * 3. Exit: the same path in reverse. The object goes back to being the bubble,
 *    swaps for the circle and the circle grows, overshoots and goes back to
 *    being a strawberry.
 *
 * Everything in seconds in here; the brain receives progress from 0 to 1.
 */

function fromCues(cues: Tracks) {
  const fns = Object.entries(cues).map(([k, c]) => [k, track(c!)] as const);
  return (s: number): PartialDelta => {
    const d: PartialDelta = {};
    for (const [k, f] of fns) d[k as DeltaField] = f(s);
    return d;
  };
}

/** Scale (delta) of the round body at the size of the bubble. */
const DOT_DELTA = DOT_SCALE - 1;

const ENTRY = 0.66;
const entry = fromCues({
  bodySx: [
    [0, 0],
    [0.1, 0.1],
    [0.22, -0.04],
    [0.34, 0],
  ],
  bodySy: [
    [0, 0],
    [0.1, -0.1],
    [0.22, 0.06],
    [0.34, 0],
  ],
  round: [
    [0.06, 0],
    [0.4, 1],
  ],
  retract: [
    [0.04, 0, 'easeIn'],
    [0.3, 1],
  ],
  eyeSy: [
    [0.08, 0],
    [0.2, -0.9],
  ],
  eyesVanish: [
    [0.18, 0],
    [0.34, 1],
  ],
  scale: [
    [0, 0],
    [0.1, -0.04],
    [0.36, -0.08],
    [ENTRY, DOT_DELTA],
  ],
});

const EXIT = 0.95;
function leave(options: { hop?: number; happy?: boolean; sparks?: boolean }) {
  const extra = options.hop ?? 0.1;
  const f = fromCues({
    // Grows from rest (the bubble was still at the swap frame).
    scale: [
      [0, DOT_DELTA],
      [0.34, extra],
      [0.48, -0.04],
      [0.6, 0.01],
      [0.7, 0],
    ],
    round: [
      [0.16, 1],
      [0.5, 0],
    ],
    retract: [
      [0.26, 1, 'easeOut'],
      [0.46, -0.18],
      [0.62, 0.05],
      [0.72, 0],
    ],
    eyesVanish: [
      [0.16, 1],
      [0.32, 0],
    ],
    eyeSy: [
      [0.26, -0.9],
      [0.42, 0.1],
      [0.5, 0],
    ],
    bodySx: [
      [0.3, 0],
      [0.4, 0.06],
      [0.52, -0.03],
      [0.64, 0.01],
      [0.7, 0],
    ],
    bodySy: [
      [0.3, 0],
      [0.4, -0.06],
      [0.52, 0.03],
      [0.64, -0.01],
      [0.7, 0],
    ],
    happy: options.happy
      ? [
          [0.3, 0],
          [0.4, 1],
          [0.8, 1],
          [0.95, 0],
        ]
      : [[0, 0]],
    sparks: options.sparks
      ? [
          [0.05, 0, 'linear'],
          [0.75, 1],
          [0.7501, 0],
        ]
      : [[0, 0]],
  });
  return f;
}

/** Bubble pulse right after the swap: adds life without moving the center. */
const BUBBLE_PULSE: readonly Keyframe[] = [
  [0, DOT_R],
  [0.08, DOT_R + 6],
  [0.2, DOT_R],
];

/**
 * Builds a transformation: entry, `middle` seconds of object and exit. The object
 * returns only its own fields; the rest (hidden body, bubble at the right radius)
 * comes from here, and the bubble radius must return to `DOT_R` at the end of the middle.
 */
function makeTransformation(
  middle: number,
  obj: (s: number) => PartialDelta,
  options: Parameters<typeof leave>[0] = {},
) {
  const exitSampler = leave(options);
  const duration = ENTRY + middle + EXIT;
  const morph = track([
    [0, 0],
    [0.1, 1],
    [duration - 0.25, 1],
    [duration, 0],
  ]);
  const hold = track([
    [0, 0],
    [0.08, 1],
    [duration - 0.35, 1],
    [duration, 0],
  ]);
  // Before returning, the bubble "inhales" (shrinks a little and returns to the exact radius, still).
  const inhale = track([
    [middle - 0.3, DOT_R],
    [middle - 0.15, DOT_R - 6],
    [middle - 0.02, DOT_R],
  ]);
  const sample = (t: number): PartialDelta => {
    const s = t * duration;
    let d: PartialDelta;
    if (s < ENTRY) d = entry(s);
    else if (s < ENTRY + middle) {
      const objT = s - ENTRY;
      d = {
        scale: DOT_DELTA,
        round: 1,
        retract: 1,
        eyeSy: -0.9,
        eyesVanish: 1,
        swap: 1,
        bubbleR: DOT_R,
        ...obj(objT),
      };
      if (objT > middle - 0.3) d.bubbleR = inhale(objT);
    } else d = exitSampler(s - ENTRY - middle);
    return { ...d, morph: morph(s), holdGaze: hold(s) };
  };
  return { duration, sample };
}

/* ---------- becomes loading: dots → disc → spinning ring → disc → bubble ---------- */

const loading = fromCues({
  bubbleR: [
    ...BUBBLE_PULSE,
    [1.15, DOT_R, 'easeOut'],
    [1.45, RING.R],
    [2.75, RING.R],
    [3.05, DOT_R],
  ],
  dotsDist: [
    [0.15, 0, 'easeOut'],
    [0.45, 90],
    [0.9, 90],
    [1.15, 0],
  ],
  dotsBounce: [
    [0.2, 0],
    [0.45, 1],
    [0.85, 1],
    [1.05, 0],
  ],
  bubbleHole: [
    [1.45, 0],
    [1.7, RING.hole],
    [2.45, RING.hole],
    [2.7, 0],
  ],
  bubbleArc: [
    [1.7, 0],
    [1.95, 0.72],
    [2.2, 0.72],
    [2.42, 0],
  ],
});

function loadingSpin(s: number) {
  // Starts spinning when it becomes a disc (invisible until the ring opens) and accelerates.
  const x = Math.max(0, s - 1.45);
  return x < 0.4 ? 450 * x * x : 72 + 360 * (x - 0.4);
}

/* ---------- becomes check: the bubble walks to the start of the check and draws it ---------- */

const check = fromCues({
  bubbleR: BUBBLE_PULSE,
  bubbleX: [
    [0.15, 0, 'easeOut'],
    [0.42, CHECK.start.x],
    [1.75, CHECK.start.x],
    [2.0, 0],
  ],
  bubbleY: [
    [0.15, 0, 'easeOut'],
    [0.42, CHECK.start.y],
    [1.75, CHECK.start.y],
    [2.0, 0],
  ],
  checkDraw: [
    [0.42, 0, 'easeOut'],
    [0.8, 1],
    [1.45, 1, 'easeIn'],
    [1.75, 0],
  ],
  objScale: [
    [0.8, 0],
    [0.9, 0.1],
    [1.04, -0.03],
    [1.14, 0],
  ],
});

/* ---------- becomes </>: three dots and a stroke leaving each one ---------- */

const code = fromCues({
  bubbleR: [
    ...BUBBLE_PULSE,
    [0.3, DOT_R],
    [0.55, CODE.radius],
    [1.75, CODE.radius],
    [2.0, DOT_R],
  ],
  dotsDist: [
    [0.25, 0, 'easeOut'],
    [0.55, CODE.dist],
    [1.7, CODE.dist, 'easeIn'],
    [1.95, 0],
  ],
  codeDraw: [
    [0.55, 0, 'easeOut'],
    [0.9, 1],
    [1.35, 1, 'easeIn'],
    [1.65, 0],
  ],
  objScale: [
    [0.9, 0],
    [1.0, 0.08],
    [1.12, -0.02],
    [1.22, 0],
  ],
});

/* ---------- energy: eight dots come out from under the bubble and orbit ---------- */

const energy = fromCues({
  bubbleR: [...BUBBLE_PULSE, [0.3, DOT_R], [0.55, 28], [1.55, 28], [1.8, 48], [1.95, DOT_R]],
  orbitOpen: [
    [0.25, 0, 'easeOut'],
    [0.65, 1],
    [1.3, 1, 'easeIn'],
    [1.65, 0],
  ],
});

export const TRANSFORMATIONS = {
  morphLoading: makeTransformation(3.4, (s) => ({ ...loading(s), objRotate: loadingSpin(s) })),
  morphCheck: makeTransformation(2.35, check, { happy: true }),
  morphCode: makeTransformation(2.35, code),
  energy: makeTransformation(2.3, (s) => ({ ...energy(s), objRotate: 260 * s + 160 * s * s }), {
    hop: 0.2,
    sparks: true,
  }),
};

/** Reactions that cannot be interrupted: in the middle of them the body does not even exist. */
export const EXCLUSIVE: ReadonlySet<string> = new Set(Object.keys(TRANSFORMATIONS));
