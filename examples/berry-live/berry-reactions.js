/**
 * Ported verbatim from DevBerry's `lib/berry/reacoes.ts` (Berry's reactions
 * and activities only — the Chama's reactions/activities and the Pumpy-style
 * object transformations are not ported; see `berry-case-study.md`). Field
 * names translated to English (see `berry-delta.js`), every keyframe value
 * and curve unchanged.
 */
import { track, fromTracks } from "./berry-motor.js";

function success(level) {
  const h = { exercise: 110, lesson: 170, module: 220 }[level];
  const leaf = { exercise: 20, lesson: 26, module: 32 }[level];
  const base = fromTracks({
    rootY: [[0, 0], [0.1, 0, "easeOut"], [0.333, -h], [0.433, -h, "easeIn"], [0.6, 0]],
    bodySx: [[0, 0], [0.1, 0.12], [0.2, -0.1], [0.333, 0], [0.433, -0.04], [0.6, 0.14], [0.7, -0.03], [0.82, 0.02], [1, 0]],
    bodySy: [[0, 0], [0.1, -0.16], [0.2, 0.14], [0.333, 0], [0.433, 0.05], [0.6, -0.18], [0.7, 0.05], [0.82, -0.02], [1, 0]],
    leafL: [[0, 0], [0.1, -10], [0.333, leaf], [0.6, -12], [0.75, 6], [1, 0]],
    leafR: [[0, 0], [0.1, 10], [0.333, -leaf], [0.6, 12], [0.75, -6], [1, 0]],
    leafC: [[0, 0], [0.1, -3], [0.333, 7], [0.6, -5], [0.8, 3], [1, 0]],
    happy: [[0, 0], [0.15, 0], [0.3, 1], [0.85, 1], [1, 0]],
    holdGaze: [[0, 0], [0.15, 0.8], [0.85, 0.8], [1, 0]],
    sparks: [[0, 0], [0.3, 0, "linear"], [0.9, 1], [0.9001, 0]],
  });
  if (level !== "module") return base;
  const spin = track([[0, 0], [0.12, 0], [0.52, 360]]);
  return (t) => ({ ...base(t), centerRotate: spin(t) });
}

const almostThere = fromTracks({
  bodyRotate: [[0, 0], [0.2, -6], [0.3, 5], [0.4, -4], [0.5, 3], [0.6, 0]],
  bodySx: [[0, 0], [0.08, 0.06], [0.2, 0], [0.75, 0.04], [0.86, -0.02], [1, 0]],
  bodySy: [[0, 0], [0.08, -0.06], [0.2, 0], [0.75, -0.03], [0.86, 0.04], [1, 0]],
  eyeY: [[0, 0], [0.1, 16], [0.6, 16], [0.78, -4], [1, 0]],
  lidTop: [[0, 0], [0.1, 0.3], [0.6, 0.3], [0.78, 0]],
  lidAngle: [[0, 0], [0.1, -18], [0.6, -18], [0.78, 8], [1, 0]],
  leafL: [[0, 0], [0.15, -18], [0.6, -18], [0.8, 6], [1, 0]],
  leafR: [[0, 0], [0.15, 18], [0.6, 18], [0.8, -6], [1, 0]],
  leafC: [[0, 0], [0.15, 14], [0.6, 14], [0.8, -4], [1, 0]],
  rootY: [[0, 0], [0.15, 10], [0.6, 10], [0.8, 0]],
  holdGaze: [[0, 0], [0.1, 0.9], [0.7, 0.9], [1, 0]],
});

const fright = fromTracks({
  rootY: [[0, 0], [0.12, -45, "easeIn"], [0.3, 0]],
  bodyRotate: [[0, 0], [0.12, -5], [0.5, -3], [1, 0]],
  bodySx: [[0, 0], [0.12, -0.08], [0.3, 0.12], [0.42, -0.03], [0.55, 0]],
  bodySy: [[0, 0], [0.12, 0.1], [0.3, -0.14], [0.42, 0.04], [0.55, 0]],
  eyeSx: [[0, 0], [0.08, -0.45], [0.7, -0.45], [1, 0]],
  eyeSy: [[0, 0], [0.08, -0.62], [0.7, -0.62], [1, 0]],
  leafL: [[0, 0], [0.12, 24], [0.5, 10], [1, 0]],
  leafR: [[0, 0], [0.12, -24], [0.5, -10], [1, 0]],
  leafC: [[0, 0], [0.12, -10], [0.5, 4], [1, 0]],
  exclaim: [[0, 0], [0.08, 1], [0.8, 1], [1, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.7, 1], [1, 0]],
});

const idea = fromTracks({
  rootY: [[0, 0], [0.12, 0], [0.24, -40, "easeIn"], [0.4, 0]],
  bodySy: [[0, 0], [0.12, -0.06], [0.24, 0.06], [0.4, -0.04], [0.5, 0]],
  leafC: [[0, 0], [0.2, -14], [0.4, 6], [0.6, -3], [1, 0]],
  eyeX: [[0, 0], [0.15, 22], [0.85, 22], [1, 0]],
  eyeY: [[0, 0], [0.15, -22], [0.85, -22], [1, 0]],
  eyeSy: [[0, 0], [0.15, 0.12], [0.85, 0.12], [1, 0]],
  lamp: [[0, 0], [0.15, 1], [0.85, 1], [1, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.85, 1], [1, 0]],
});

/** "You copied that, huh?": turns the whole face sideways and narrows the eyes, suspicious. */
const copiedThat = fromTracks({
  turn: [[0, 0], [0.15, -0.9], [0.85, -0.9], [1, 0]],
  lidTop: [[0, 0], [0.2, 0.5], [0.85, 0.5], [1, 0]],
  lidBottom: [[0, 0], [0.2, 0.15], [0.85, 0.15], [1, 0]],
  lidAngle: [[0, 0], [0.2, 20], [0.85, 20], [1, 0]],
  eyeX: [[0, 0], [0.15, 18], [0.85, 18], [1, 0]],
  leafL: [[0, 0], [0.2, -12], [0.85, -12], [1, 0]],
  leafR: [[0, 0], [0.2, 12], [0.85, 12], [1, 0]],
  bodyRotate: [[0, 0], [0.2, -3], [0.85, -3], [1, 0]],
  bodySy: [[0, 0], [0.2, 0.03], [0.85, 0.03], [1, 0]],
  holdGaze: [[0, 0], [0.12, 1], [0.88, 1], [1, 0]],
});

const welcome = fromTracks({
  rootY: [[0, 430, "easeOut"], [0.25, -60, "easeIn"], [0.35, 0]],
  opacity: [[0, -1], [0.15, 0]],
  bodySx: [[0, -0.1], [0.25, -0.06], [0.35, 0.14], [0.45, -0.03], [0.55, 0]],
  bodySy: [[0, 0.2], [0.25, 0.1], [0.35, -0.16], [0.45, 0.04], [0.55, 0]],
  leafR: [[0, 0], [0.55, 0], [0.63, -36], [0.71, -8], [0.79, -36], [0.87, -8], [0.95, 0]],
  leafL: [[0, 0], [0.4, -8], [0.6, 6], [0.8, -2], [1, 0]],
  leafC: [[0, 0], [0.3, 10], [0.5, -5], [0.7, 3], [1, 0]],
  happyRight: [[0, 0], [0.55, 0], [0.6, 1], [0.92, 1], [1, 0]],
  shadow: [[0, -0.7], [0.35, 0]],
});

/** Easter egg: eyes spinning in a circle, body staggering. */
function dizzy(t) {
  const envelope = track([[0, 0], [0.15, 1], [0.75, 1], [1, 0]])(t);
  const a = t * Math.PI * 6;
  return {
    eyeX: Math.cos(a) * 26 * envelope,
    eyeY: Math.sin(a) * 26 * envelope,
    eyeSx: -0.3 * envelope,
    eyeSy: -0.5 * envelope,
    bodyRotate: Math.sin(t * Math.PI * 4) * 7 * envelope,
    leafL: Math.sin(t * Math.PI * 5) * 14 * envelope,
    leafR: Math.sin(t * Math.PI * 5 + 1) * 14 * envelope,
    holdGaze: envelope,
  };
}

const wake = fromTracks({
  rootY: [[0, 0], [0.3, -60, "easeIn"], [0.6, 0]],
  eyeSy: [[0, 0], [0.25, 0.2], [1, 0]],
  leafL: [[0, 0], [0.3, 20], [1, 0]],
  leafR: [[0, 0], [0.3, -20], [1, 0]],
});

/** Wink: one eye arcs happy, body leans, a small hop. */
const wink = fromTracks({
  happyRight: [[0, 0], [0.12, 1], [0.7, 1], [0.85, 0]],
  lidBottom: [[0, 0], [0.12, 0.25], [0.7, 0.25], [0.85, 0]],
  bodyRotate: [[0, 0], [0.15, 7], [0.7, 7], [1, 0]],
  rootY: [[0, 0], [0.08, -26, "easeIn"], [0.2, 0]],
  leafR: [[0, 0], [0.15, -22], [0.35, -6], [0.55, -18], [1, 0]],
  turn: [[0, 0], [0.15, 0.35], [0.7, 0.35], [1, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.8, 1], [1, 0]],
});

/** Cheerful: sways side to side with arc eyes. */
function cheerful(t) {
  const e = track([[0, 0], [0.12, 1], [0.85, 1], [1, 0]])(t);
  const phase = t * Math.PI * 6;
  const side = Math.sin(phase);
  return {
    happy: e,
    bodyRotate: side * 9 * e,
    rootY: -Math.abs(Math.cos(phase)) * 22 * e,
    bodySx: Math.abs(side) * 0.04 * e,
    bodySy: -Math.abs(side) * 0.05 * e,
    leafL: (10 + side * 8) * e,
    leafR: (-10 + side * 8) * e,
    turn: side * 0.35 * e,
    holdGaze: e,
  };
}

/** Profile: looks around by turning the whole face sideways, until in profile. */
const profile = fromTracks({
  turn: [[0, 0], [0.14, 1.55], [0.42, 1.55], [0.56, -1.55], [0.84, -1.55], [1, 0]],
  eyeY: [[0, 0], [0.14, -8], [0.84, -8], [1, 0]],
  bodyRotate: [[0, 0], [0.14, 3], [0.42, 3], [0.56, -3], [0.84, -3], [1, 0]],
  holdGaze: [[0, 0], [0.08, 1], [0.92, 1], [1, 0]],
});

/** Flatten: squashes down like dough, eyes turn to slits, then pops back. */
const flatten = fromTracks({
  bodySy: [[0, 0], [0.18, -0.42, "easeOut"], [0.7, -0.42], [0.82, 0.1], [0.92, -0.03], [1, 0]],
  bodySx: [[0, 0], [0.18, 0.26, "easeOut"], [0.7, 0.26], [0.82, -0.06], [0.92, 0.02], [1, 0]],
  eyeSy: [[0, 0], [0.2, -0.88], [0.7, -0.88], [0.8, 0]],
  leafL: [[0, 0], [0.2, -26], [0.7, -26], [0.82, 12], [1, 0]],
  leafR: [[0, 0], [0.2, 26], [0.7, 26], [0.82, -12], [1, 0]],
  holdGaze: [[0, 0], [0.15, 1], [0.8, 1], [1, 0]],
});

/** Confused: eyes shrink to dots, head tilts, "?" bobs. */
const confused = fromTracks({
  eyeSx: [[0, 0], [0.12, -0.4], [0.8, -0.4], [1, 0]],
  eyeSy: [[0, 0], [0.12, -0.55], [0.8, -0.55], [1, 0]],
  bodyRotate: [[0, 0], [0.15, -10], [0.45, -10], [0.55, 8], [0.8, 8], [1, 0]],
  turn: [[0, 0], [0.15, -0.3], [0.45, -0.3], [0.55, 0.3], [0.8, 0.3], [1, 0]],
  leafC: [[0, 0], [0.15, -12], [0.45, -12], [0.55, 12], [0.8, 12], [1, 0]],
  question: [[0, 0], [0.12, 1], [0.85, 1], [1, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.85, 1], [1, 0]],
});

/** Somersault: prepares, jumps high, spins 360° in the air, lands happy. */
const somersault = fromTracks({
  rootY: [[0, 0], [0.16, 0, "easeOut"], [0.42, -250], [0.5, -250, "easeIn"], [0.7, 0]],
  bodySx: [[0, 0], [0.16, 0.18], [0.24, -0.1], [0.4, 0], [0.7, 0.16], [0.8, -0.04], [0.9, 0]],
  bodySy: [[0, 0], [0.16, -0.24], [0.24, 0.16], [0.4, 0], [0.7, -0.2], [0.8, 0.05], [0.9, 0]],
  centerRotate: [[0, 0], [0.2, 0], [0.64, 360]],
  lidTop: [[0, 0], [0.12, 0.5], [0.18, 0]],
  happy: [[0, 0], [0.7, 0], [0.76, 1], [0.95, 1], [1, 0]],
  leafL: [[0, 0], [0.16, -16], [0.3, 24], [0.7, -14], [0.85, 6], [1, 0]],
  leafR: [[0, 0], [0.16, 16], [0.3, -24], [0.7, 14], [0.85, -6], [1, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.9, 1], [1, 0]],
});

const peek = fromTracks({
  eyeSy: [[0, 0], [0.12, 0.16], [0.6, 0.12], [1, 0]],
  eyeSx: [[0, 0], [0.12, 0.1], [0.6, 0.08], [1, 0]],
  bodySy: [[0, 0], [0.1, -0.05], [0.24, 0.06], [0.4, -0.02], [0.55, 0]],
  bodySx: [[0, 0], [0.1, 0.05], [0.24, -0.04], [0.4, 0.01], [0.55, 0]],
  leafL: [[0, 0], [0.15, 16], [0.7, 12], [1, 0]],
  leafR: [[0, 0], [0.15, -16], [0.7, -12], [1, 0]],
  leafC: [[0, 0], [0.12, 6], [0.3, -4], [0.5, 0]],
});

/** Shy: shrinks, turns away, looks down smiling, then peeks back. */
const shy = fromTracks({
  scale: [[0, 0], [0.15, -0.07], [0.7, -0.06], [0.9, 0]],
  bodyRotate: [[0, 0], [0.15, -7], [0.55, -6], [0.75, 2], [0.9, 0]],
  turn: [[0, 0], [0.15, -0.55], [0.5, -0.55], [0.62, -0.15], [0.9, 0]],
  eyeY: [[0, 0], [0.15, 16], [0.5, 16], [0.62, 4], [0.9, 0]],
  lidBottom: [[0, 0], [0.15, 0.35], [0.75, 0.35], [0.95, 0]],
  leafL: [[0, 0], [0.15, -10], [0.7, -8], [0.9, 0]],
  leafR: [[0, 0], [0.15, 10], [0.7, 8], [0.9, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.55, 1], [0.85, 0]],
});

/** Two hops, the second higher. */
const doubleHop = fromTracks({
  rootY: [[0, 0], [0.08, 0, "easeOut"], [0.2, -60, "easeIn"], [0.34, 0], [0.4, 0, "easeOut"], [0.56, -110, "easeIn"], [0.74, 0]],
  bodySy: [[0, 0], [0.06, -0.12], [0.14, 0.08], [0.34, -0.12], [0.42, 0.1], [0.74, -0.14], [0.84, 0.04], [0.95, 0]],
  bodySx: [[0, 0], [0.06, 0.1], [0.14, -0.05], [0.34, 0.1], [0.42, -0.06], [0.74, 0.12], [0.84, -0.03], [0.95, 0]],
  happy: [[0, 0], [0.4, 0], [0.48, 1], [0.85, 1], [1, 0]],
});

/** Laugh: fast shake, arc eyes, leaves flapping. */
function laugh(t) {
  const env = Math.sin(Math.min(1, t / 0.9) * Math.PI) ** 0.6;
  const k = Math.sin(t * 2 * Math.PI * 9);
  return {
    bodySy: 0.05 * k * env,
    bodySx: -0.035 * k * env,
    bodyRotate: 3 * Math.sin(t * 2 * Math.PI * 4.5) * env,
    rootY: -10 * Math.abs(k) * env,
    happy: Math.min(1, t * 10) * (t < 0.85 ? 1 : (1 - t) / 0.15),
    leafL: 12 * k * env,
    leafR: -12 * k * env,
    leafC: 6 * k * env,
    holdGaze: 0.8 * env,
  };
}

/** Huff (3rd click in a chain): puffs up, cross face, then lets it all out shaking. */
const huff = fromTracks({
  bodySx: [[0, 0], [0.3, 0.14, "easeOut"], [0.55, 0.14], [0.62, -0.08], [0.7, 0.04], [0.8, -0.02], [0.9, 0]],
  bodySy: [[0, 0], [0.3, 0.06, "easeOut"], [0.55, 0.06], [0.62, -0.08], [0.7, 0.03], [0.85, 0]],
  lidTop: [[0, 0], [0.15, 0.36], [0.75, 0.36], [0.95, 0]],
  lidAngle: [[0, 0], [0.15, 26], [0.75, 26], [0.95, 0]],
  leafC: [[0, 0], [0.3, 10], [0.55, 10], [0.6, -16], [0.66, 12], [0.72, -8], [0.8, 4], [0.9, 0]],
  leafL: [[0, 0], [0.3, 18], [0.55, 18], [0.62, -8], [0.75, 0]],
  leafR: [[0, 0], [0.3, -18], [0.55, -18], [0.62, 8], [0.75, 0]],
  exclaim: [[0, 0], [0.55, 0], [0.6, 1], [0.85, 1], [0.95, 0]],
  holdGaze: [[0, 0], [0.1, 0.7], [0.85, 0.7], [1, 0]],
});

/** Hide (8th click in a chain): flattens to the ground eyes shut, peeks with one eye, gets up. */
const hide = fromTracks({
  bodySy: [[0, 0], [0.12, -0.38, "easeOut"], [0.62, -0.36], [0.78, 0.1], [0.88, -0.03], [1, 0]],
  bodySx: [[0, 0], [0.12, 0.22, "easeOut"], [0.62, 0.2], [0.78, -0.06], [0.88, 0.02], [1, 0]],
  leafL: [[0, 0], [0.12, -24], [0.62, -22], [0.8, 10], [1, 0]],
  leafR: [[0, 0], [0.12, 24], [0.62, 22], [0.8, -10], [1, 0]],
  closeLeft: [[0, 0], [0.1, 1], [0.66, 1], [0.76, 0]],
  closeRight: [[0, 0], [0.1, 1], [0.36, 1], [0.42, 0.15], [0.52, 0.15], [0.58, 1], [0.66, 1], [0.76, 0]],
  eyeX: [[0.36, 0], [0.42, 26], [0.52, 26], [0.58, 0]],
  eyeY: [[0, 0], [0.12, 18], [0.66, 18], [0.78, 0]],
  lidTop: [[0.36, 0], [0.42, 0.25], [0.52, 0.25], [0.58, 0]],
  leafAmp: [[0, 0], [0.12, -0.9], [0.62, -0.9], [0.8, 0]],
  holdGaze: [[0, 0], [0.1, 1], [0.8, 1], [1, 0]],
});

export const REACTIONS = {
  success: { duration: 1.6, sample: success("lesson") },
  successExercise: { duration: 1.2, sample: success("exercise") },
  successModule: { duration: 2.4, sample: success("module") },
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
  peek: { duration: 1.0, sample: peek },
  shy: { duration: 1.8, sample: shy },
  doubleHop: { duration: 1.3, sample: doubleHop },
  laugh: { duration: 1.3, sample: laugh },
  huff: { duration: 1.8, sample: huff },
  hide: { duration: 3.2, sample: hide },
};
export const REACTION_NAMES = Object.keys(REACTIONS);

/* ---------- activities (loops) ---------- */

const THINK_LOOK_X = track([[0, 0], [0.15, -1], [0.45, -1], [0.58, 1], [0.85, 1], [1, 0]]);
const THINK_LOOK_Y = track([[0, 0], [0.15, -1], [0.85, -1], [1, 0]]);

function thinking(s) {
  const u = (s % 3.6) / 3.6;
  const ox = THINK_LOOK_X(u);
  return {
    eyeX: ox * 22,
    eyeY: THINK_LOOK_Y(u) * 24,
    turn: ox * 0.25,
    lidTop: 0.15,
    lidAngle: -6 * ox,
    bodyRotate: -2 + Math.sin(s * 1.7) * 1.5,
    leafC: 3 + Math.sin(s * 2.4) * 5,
    ellipsis: 1,
    holdGaze: 1,
  };
}

function loading(s) {
  const u = s % 1;
  const height = 4 * u * (1 - u);
  const contact = Math.max(0, Math.min(1, 1 - Math.min(u, 1 - u) / 0.12));
  return {
    rootY: -95 * height,
    bodySx: 0.08 * contact - 0.04 * height,
    bodySy: -0.1 * contact + 0.06 * height,
    eyeX: Math.sin(s * Math.PI) * 14,
    turn: Math.sin(s * Math.PI) * 0.2,
    leafC: Math.sin(s * Math.PI * 2) * 7,
    leafL: -height * 8,
    leafR: height * 8,
    holdGaze: 1,
  };
}

function sleeping(s) {
  const r = Math.sin(s * 1.2);
  return {
    eyeSy: -0.9,
    lidTop: 0.3,
    eyeY: 10,
    bodySy: 0.03 * r,
    bodySx: -0.015 * r,
    leafL: -12,
    leafR: 12,
    leafC: -8,
    rootY: 8,
    zzz: 1,
    holdGaze: 1,
    leafAmp: -0.7,
  };
}

export const ACTIVITIES = { thinking, loading, sleeping };
export const ACTIVITY_NAMES = Object.keys(ACTIVITIES);
