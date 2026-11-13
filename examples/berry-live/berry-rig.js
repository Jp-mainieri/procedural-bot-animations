/**
 * Berry's exact rig data, copied verbatim from DevBerry's
 * `lib/berry/rig.ts` (branch `feat/berry-simulador-mascote`, confirmed
 * identical there and on `main` at the time of writing), with Portuguese
 * identifiers translated to English. Geometry (coordinates, viewBox, eye
 * size) is byte-for-byte the same — nothing rescaled or approximated.
 *
 * This is a reference/demo file, not part of the installable
 * `procedural-bot-animations` package: Berry is DevBerry's own mascot,
 * included here with its owner's permission to show this skill's engine
 * techniques applied to a real production character, including the parts
 * (per-leaf spring physics) that a single-silhouette Open Bot Avatar
 * definition can't express.
 */

export const VIEWBOX = { x: 190, y: 60, w: 880, h: 990 };
export const VIEWBOX_ATTR = `${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`;

export const RIG_BERRY = {
  id: "berry",
  body: "M463,408 C380,434 320,502 320,596 C320,722 440,862 540,926 C580,951 606,960 628,960 C652,960 678,951 718,926 C818,862 934,722 934,596 C934,502 876,434 792,408 C760,398 700,392 628,392 C560,392 500,398 463,408 Z",
  appendages: [
    {
      role: "C",
      path: "M563,342 C563,292 594,252 627,252 C660,252 692,292 692,342 L692,430 L563,430 Z",
      pivot: { x: 627, y: 425 },
      tip: { x: 627, y: 252 },
    },
    {
      role: "L",
      path: "M463,408 C437,386 421,360 425,342 C429,320 470,309 512,316 C536,321 553,331 565,342 L565,430 L480,430 Z",
      pivot: { x: 565, y: 425 },
      tip: { x: 425, y: 342 },
    },
    {
      role: "R",
      path: "M792,408 C818,386 834,360 830,342 C826,320 785,309 743,316 C719,321 702,331 690,342 L690,430 L775,430 Z",
      pivot: { x: 690, y: 425 },
      tip: { x: 830, y: 342 },
    },
  ],
  eyes: { left: { x: 513, y: 600 }, right: { x: 691, y: 600 } },
  // "classico" eye style only (the rig also defines "pumpy" and "grande").
  eyeShape: { w: 80, h: 160, tilt: 0, dx: 0, dy: 0 },
  ground: { x: 627, y: 960 },
  center: { x: 628, y: 660 },
  shadow: { x: 628, y: 990, rx: 250, ry: 22 },
};
