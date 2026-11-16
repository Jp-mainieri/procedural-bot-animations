import type { Rig } from "../rig.js";

/*
 * Flame: the outline generated with the open-bot-avatar skill (100×100 box,
 * scaled 9.5× to our system), cut into pieces to gain physics: a round body,
 * the main tongue (C), the left shoulder tongue (L) and, only on the 1-day
 * ember, a third one on the right (R). The tongue bases go inside the body, so
 * bending the tip never opens a gap.
 */
export const RIG_FLAME: Rig = {
  id: "flame",
  body: "M627,960 C456,960 323,846 323,694 C323,608 352,561 399,528 C466,485 560,490 646,490 C741,490 817,490 874,528 C922,570 950,628 950,694 C950,846 817,960 627,960 Z",
  appendages: [
    {
      role: "C",
      path: "M489,570 C489,456 542,352 622,257 C636,240 657,242 667,261 C703,333 755,376 817,433 C874,485 912,542 922,599 L741,675 L532,675 Z",
      pivot: { x: 694, y: 580 },
      tip: { x: 644, y: 248 },
    },
    {
      role: "L",
      path: "M352,599 C352,552 380,509 408,480 C423,461 442,466 446,490 C454,523 470,552 499,575 L494,656 L370,656 Z",
      pivot: { x: 428, y: 580 },
      tip: { x: 430, y: 469 },
    },
    {
      role: "R",
      path: "M826,570 C846,523 874,490 898,466 C912,452 926,461 926,480 C926,514 936,552 945,599 L912,666 L836,656 Z",
      pivot: { x: 893, y: 590 },
      tip: { x: 917, y: 461 },
    },
  ],
  eyes: { left: { x: 560, y: 722 }, right: { x: 712, y: 722 } },
  eyeStyles: {
    classic: { w: 80, h: 140, tilt: 0, dx: 0, dy: 0 },
    pumpy: { w: 86, h: 112, tilt: 0, dx: 2, dy: 8 },
    big: { w: 100, h: 156, tilt: 14, dx: -4, dy: 6 },
  },
  ground: { x: 627, y: 960 },
  center: { x: 636, y: 694 },
  shadow: { x: 627, y: 985, rx: 280, ry: 22 },
  accessory: { x: 800, y: 330 },
  anchor: { x: 627, y: 660 },
  baseHeight: 380,
  idleAppendage: { amp: 2.4, freq: 2.6 },
  flicker: 1,
  core: "M627,922 C532,922 466,860 466,780 C466,704 508,656 551,613 C560,656 584,680 613,689 C608,618 641,552 689,499 C732,570 788,637 788,760 C788,856 722,922 627,922 Z",
};
