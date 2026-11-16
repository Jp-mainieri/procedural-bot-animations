/*
 * Original example characters and animations, written as plain data in the
 * two JSON formats (see docs/character-format.md and docs/animation-format.md).
 * Every entry validates with zero warnings.
 */

import type { AnimationDefinition } from "./animation.js";
import type { CharacterDefinition } from "./character.js";

export const EXAMPLE_CHARACTERS: CharacterDefinition[] = [
  {
    // A soft rounded blob, wider than tall. No parts.
    version: 1,
    id: "blob",
    name: "Blob",
    body: {
      path: "M50 24 C70 24 86 38 86 58 C86 78 74 90 50 90 C26 90 14 78 14 58 C14 38 30 24 50 24 Z",
    },
    eyes: { x: 50, y: 54, spacing: 21, scale: 1.55 },
    rig: { color: "#ff8fb1" },
  },
  {
    // A dome with three scallops along the bottom. No parts.
    version: 1,
    id: "ghost",
    name: "Ghost",
    body: {
      path: "M20 50 C20 28 33 14 50 14 C67 14 80 28 80 50 L80 82 C80 90 60 90 60 82 C60 90 40 90 40 82 C40 90 20 90 20 82 L20 50 Z",
    },
    eyes: { x: 50, y: 43, spacing: 18, scale: 1.7 },
    rig: { color: "#8b7fe8" },
  },
  {
    // A round body with three leaves on top. Each leaf base sits inside the body, so bending never opens a gap.
    version: 1,
    id: "sprout",
    name: "Sprout",
    body: {
      path: "M50 36 C70 36 82 50 82 65 C82 80 70 90 50 90 C30 90 18 80 18 65 C18 50 30 36 50 36 Z",
    },
    eyes: { x: 50, y: 64, spacing: 19, scale: 1.3 },
    rig: {
      parts: [
        {
          role: "C",
          path: "M44 46 C42 32 46 18 50 10 C54 18 58 32 56 46 Z",
          pivot: [50, 43],
          tip: [50, 10],
        },
        {
          role: "L",
          path: "M34 46 C32 36 26 28 18 24 C26 20 36 22 42 30 C45 34 46 40 46 46 Z",
          pivot: [40, 44],
          tip: [18, 24],
        },
        {
          role: "R",
          path: "M66 46 C68 36 74 28 82 24 C74 20 64 22 58 30 C55 34 54 40 54 46 Z",
          pivot: [60, 44],
          tip: [82, 24],
        },
      ],
      color: "#4fae6a",
    },
  },
  {
    // A rounded square with two antennas (L and R).
    version: 1,
    id: "robot",
    name: "Robot",
    body: {
      path: "M30 30 L70 30 C75.5 30 80 34.5 80 40 L80 80 C80 85.5 75.5 90 70 90 L30 90 C24.5 90 20 85.5 20 80 L20 40 C20 34.5 24.5 30 30 30 Z",
    },
    eyes: { x: 50, y: 59, spacing: 18, scale: 1.45 },
    rig: {
      parts: [
        {
          role: "L",
          path: "M29 38 C27 31 24.5 24 22.8 17.5 C19 16 18.5 7.5 24 7.5 C29.5 7.5 29.5 16 26.2 17.5 C28 24 31 31 33 38 Z",
          pivot: [31, 36],
          tip: [24, 8],
        },
        {
          role: "R",
          path: "M71 38 C73 31 75.5 24 77.2 17.5 C81 16 81.5 7.5 76 7.5 C70.5 7.5 70.5 16 73.8 17.5 C72 24 69 31 67 38 Z",
          pivot: [69, 36],
          tip: [76, 8],
        },
      ],
      idle: { amp: 0.6, freq: 1.4 },
      color: "#6c8cff",
    },
  },
];

export const EXAMPLE_ANIMATIONS: AnimationDefinition[] = [
  {
    // Yes: anticipation up, then two dips that get smaller. Volume is kept (bodySx = -bodySy).
    version: 1,
    kind: "reaction",
    id: "nod",
    name: "Nod",
    duration: 0.9,
    tracks: {
      bodySy: [[0, 0], [0.12, 0.04], [0.3, -0.12], [0.48, 0.02], [0.66, -0.09], [0.84, 0.01], [1, 0]],
      bodySx: [[0, 0], [0.12, -0.04], [0.3, 0.12], [0.48, -0.02], [0.66, 0.09], [0.84, -0.01], [1, 0]],
      eyeY: [[0, 0], [0.12, -3], [0.3, 10], [0.48, -2], [0.66, 8], [0.84, 0], [1, 0]],
      partC: [[0, 0], [0.12, -6], [0.3, 14], [0.48, -5], [0.66, 9], [0.84, -2], [1, 0]],
      partL: [[0, 0], [0.3, -8], [0.48, 3], [0.66, -5], [1, 0]],
      partR: [[0, 0], [0.3, 8], [0.48, -3], [0.66, 5], [1, 0]],
      lidBottom: [[0, 0], [0.25, 0.2], [0.8, 0.2], [1, 0]],
      holdGaze: [[0, 0], [0.06, 1], [0.5, 1], [0.68, 0], [1, 0]],
    },
  },
  {
    // No: the face turns side to side with shrinking swings and a slight frown.
    version: 1,
    kind: "reaction",
    id: "shake",
    name: "Shake",
    duration: 1,
    tracks: {
      turn: [[0, 0], [0.12, 0.35], [0.3, -0.45], [0.48, 0.4], [0.66, -0.3], [0.82, 0.12], [1, 0]],
      eyeX: [[0, 0], [0.12, 8], [0.3, -12], [0.48, 11], [0.66, -8], [0.82, 3], [1, 0]],
      bodyRotate: [[0, 0], [0.12, 2], [0.3, -3], [0.48, 3], [0.66, -2], [0.82, 1], [1, 0]],
      lidTop: [[0, 0], [0.2, 0.15], [0.8, 0.15], [1, 0]],
      lidAngle: [[0, 0], [0.2, 10], [0.8, 10], [1, 0]],
      partL: [[0, 0], [0.3, -8], [0.5, 6], [0.7, -5], [1, 0]],
      partR: [[0, 0], [0.3, 8], [0.5, -6], [0.7, 5], [1, 0]],
      holdGaze: [[0, 0], [0.06, 1], [0.5, 1], [0.68, 0], [1, 0]],
    },
  },
  {
    // Squat (anticipation), a tall stretch with the parts spreading, then a settle with overshoot.
    version: 1,
    kind: "reaction",
    id: "stretch",
    name: "Stretch",
    duration: 1.5,
    tracks: {
      bodySy: [[0, 0], [0.18, -0.14], [0.42, 0.22], [0.58, 0.2], [0.72, -0.05], [0.86, 0.02], [1, 0]],
      bodySx: [[0, 0], [0.18, 0.14], [0.42, -0.22], [0.58, -0.2], [0.72, 0.05], [0.86, -0.02], [1, 0]],
      rootY: [[0, 0], [0.18, 0], [0.42, -18], [0.58, -14], [0.72, 0], [1, 0]],
      partL: [[0, 0], [0.18, -12], [0.42, 30], [0.58, 26], [0.72, -8], [0.86, 3], [1, 0]],
      partR: [[0, 0], [0.18, 12], [0.42, -30], [0.58, -26], [0.72, 8], [0.86, -3], [1, 0]],
      partC: [[0, 0], [0.18, -8], [0.42, 12], [0.58, 10], [0.72, -6], [0.86, 2], [1, 0]],
      lidTop: [[0, 0], [0.18, 0.3], [0.42, 0], [1, 0]],
      lidBottom: [[0, 0], [0.42, 0.3], [0.62, 0.3], [0.86, 0], [1, 0]],
      eyeY: [[0, 0], [0.42, -8], [0.62, -8], [0.86, 0], [1, 0]],
      shadow: [[0, 0], [0.42, -0.15], [0.58, -0.12], [0.72, 0], [1, 0]],
      holdGaze: [[0, 0], [0.08, 1], [0.55, 1], [0.7, 0], [1, 0]],
    },
  },
  {
    // A suspicious glance to the side: turn, squint, a small lean, then back.
    version: 1,
    kind: "reaction",
    id: "sideEye",
    name: "Side eye",
    duration: 1.6,
    tracks: {
      turn: [[0, 0], [0.2, -0.5], [0.7, -0.5], [0.92, 0], [1, 0]],
      eyeX: [[0, 0], [0.2, -26], [0.7, -26], [0.92, 0], [1, 0]],
      lidTop: [[0, 0], [0.2, 0.4], [0.7, 0.4], [0.92, 0], [1, 0]],
      lidBottom: [[0, 0], [0.2, 0.12], [0.7, 0.12], [0.92, 0], [1, 0]],
      lidAngle: [[0, 0], [0.2, 16], [0.7, 16], [0.92, 0], [1, 0]],
      bodyRotate: [[0, 0], [0.2, -3], [0.7, -3], [0.92, 0], [1, 0]],
      bodySy: [[0, 0], [0.1, 0.02], [0.22, -0.03], [0.7, -0.03], [0.92, 0], [1, 0]],
      bodySx: [[0, 0], [0.1, -0.02], [0.22, 0.03], [0.7, 0.03], [0.92, 0], [1, 0]],
      partL: [[0, 0], [0.2, -10], [0.7, -10], [0.92, 0], [1, 0]],
      partR: [[0, 0], [0.2, 10], [0.7, 10], [0.92, 0], [1, 0]],
      holdGaze: [[0, 0], [0.08, 1], [0.6, 1], [0.75, 0], [1, 0]],
    },
  },
  {
    // A loop: swaying side to side while bobbing twice, with a contented smile.
    version: 1,
    kind: "activity",
    id: "humming",
    name: "Humming",
    period: 3.2,
    tracks: {
      bodyRotate: [[0, 0], [0.25, 3], [0.5, 0], [0.75, -3], [1, 0]],
      bodySy: [[0, -0.015], [0.25, 0.02], [0.5, -0.015], [0.75, 0.02], [1, -0.015]],
      bodySx: [[0, 0.015], [0.25, -0.02], [0.5, 0.015], [0.75, -0.02], [1, 0.015]],
      partL: [[0, 0], [0.25, 8], [0.5, 0], [0.75, -4], [1, 0]],
      partR: [[0, 0], [0.25, -4], [0.5, 0], [0.75, 8], [1, 0]],
      partC: [[0, 0], [0.25, 6], [0.5, 0], [0.75, -6], [1, 0]],
      eyeY: [[0, 0], [0.25, -3], [0.5, 0], [0.75, -3], [1, 0]],
      lidBottom: [[0, 0.25], [1, 0.25]],
    },
  },
  {
    // A mood: heavy-lidded, looking up and away, parts relaxed.
    version: 1,
    kind: "mood",
    id: "dreamy",
    name: "Dreamy",
    pose: {
      lidTop: 0.3,
      lidBottom: 0.1,
      lidAngle: -8,
      eyeY: -10,
      turn: 0.2,
      bodyRotate: -3,
      partL: 8,
      partR: -8,
      partC: 5,
      partAmp: -0.4,
      rootY: -4,
    },
  },
];
