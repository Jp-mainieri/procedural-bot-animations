/**
 * Composes `berry-rig.js` + `berry-motor.js` + `berry-reactions.js` into a
 * running character, mounted onto an existing
 * `<svg viewBox="190 60 880 990">`. The idle/gaze/breathing/jump
 * orchestration below is this demo's own (DevBerry's real `cerebro.ts` also
 * wires in app-specific triggers — Piston results, Danki cards — that don't
 * apply to a generic public demo), but every primitive it calls (`spring`,
 * `stepTip`, `bendPath`, `stepJump`, the reaction tracks, ...) is exact
 * ported code. See `berry-case-study.md`.
 */
import { RIG_BERRY } from "./berry-rig.js";
import { clamp, damp, spring, newBlink, stepBlink, atRest, launch, stepJump, axisOf, stepTip, parsePath, bendPath } from "./berry-motor.js";
import { BerryReactionPlayer } from "./berry-reactions.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function mountBerry(svg, options = {}) {
  const {
    color = "#e11d2e",
    eyeColor = "#1b1210",
    interactive = true,
    reducedMotion = false,
    // Personality tuning — same rig, same physics, different parameters
    // (see the motion cookbook's "personality → parameters" table).
    idleAmpDeg = 2.4,
    idleFreqA = 1.3,
    idleFreqB = 2.1,
    leafSpringK = 120,
    leafSpringC = 11,
    gazeRate = 9,
    breatheFreq = 1.65,
    wanderIntervalSeconds = [1.2, 3.8],
  } = options;

  // Outer group: reactions that spin around the body's *center* (e.g. a
  // somersault) rotate this, separate from the inner group's ground-pivoted
  // breathing/tilt/jump transform.
  const spinGroup = document.createElementNS(SVG_NS, "g");
  const bodyGroup = document.createElementNS(SVG_NS, "g");
  spinGroup.appendChild(bodyGroup);

  const bodyPath = document.createElementNS(SVG_NS, "path");
  bodyPath.setAttribute("fill", color);
  bodyPath.setAttribute("d", RIG_BERRY.body);
  bodyGroup.appendChild(bodyPath);

  const leaves = RIG_BERRY.appendages.map((a) => ({
    rig: a,
    axis: axisOf(a),
    cmds: parsePath(a.path),
    base: { a: 0, v: 0 },
    tip: { a: 0, v: 0 },
    prevBaseV: 0,
    phase: Math.random() * Math.PI * 2,
    side: a.role === "L" ? -1 : a.role === "R" ? 1 : 0,
    group: document.createElementNS(SVG_NS, "g"),
    path: document.createElementNS(SVG_NS, "path"),
  }));
  for (const leaf of leaves) {
    leaf.path.setAttribute("fill", color);
    leaf.group.appendChild(leaf.path);
    bodyGroup.appendChild(leaf.group);
  }

  function makeEye(cx, cy) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("transform", `translate(${cx} ${cy})`);
    const lid = document.createElementNS(SVG_NS, "g"); // scaled for blink/squash/lid-close
    const { w, h } = RIG_BERRY.eyeShape;
    const pill = document.createElementNS(SVG_NS, "rect");
    pill.setAttribute("x", String(-w / 2));
    pill.setAttribute("y", String(-h / 2));
    pill.setAttribute("width", String(w));
    pill.setAttribute("height", String(h));
    pill.setAttribute("rx", String(w / 2));
    pill.setAttribute("fill", eyeColor);
    // Happy arc (^), same footprint as the pill, crossfaded in via opacity.
    const arc = document.createElementNS(SVG_NS, "path");
    const aw = w / 2;
    arc.setAttribute("d", `M ${-aw} ${h * 0.16} Q 0 ${-h * 0.42} ${aw} ${h * 0.16} Q 0 ${-h * 0.08} ${-aw} ${h * 0.16} Z`);
    arc.setAttribute("fill", eyeColor);
    arc.setAttribute("opacity", "0");
    lid.append(pill, arc);
    g.appendChild(lid);
    return { g, lid, pill, arc };
  }
  const leftEye = makeEye(RIG_BERRY.eyes.left.x, RIG_BERRY.eyes.left.y);
  const rightEye = makeEye(RIG_BERRY.eyes.right.x, RIG_BERRY.eyes.right.y);
  // Eyes are children of `bodyGroup`, not siblings — they must inherit the
  // body's jump/breathing/tilt transform (set on `bodyGroup` each frame
  // below) or they visibly detach from the body during any of that motion.
  bodyGroup.append(leftEye.g, rightEye.g);
  svg.append(spinGroup);

  let lookX = 0, lookY = 0;
  let pointerTarget = null;
  let idleSeconds = 0;
  let wanderTarget = { x: 0, y: 0 };
  let nextWanderAt = 0;
  const jump = { y: 0, vy: 0 };
  const squash = { s: 0, v: 0 };
  let prevVy = 0;
  const blink = newBlink(performance.now());
  const reactions = new BerryReactionPlayer();
  let lastMs = null;

  if (interactive) {
    svg.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect();
      pointerTarget = { x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: ((e.clientY - rect.top) / rect.height) * 2 - 1 };
    });
    svg.addEventListener("pointerleave", () => { pointerTarget = null; });
    svg.addEventListener("pointerdown", () => launch(jump));
  }

  function tick(nowMs) {
    const dt = clamp(lastMs === null ? 16 : nowMs - lastMs, 0, 50) / 1000;
    lastMs = nowMs;
    const t = nowMs / 1000;

    if (reducedMotion) {
      bodyPath.setAttribute("d", RIG_BERRY.body);
      return;
    }

    const r = reactions.update(dt) ?? {};

    if (!(r.holdGaze > 0.5)) {
      let target;
      if (pointerTarget) {
        idleSeconds = 0;
        target = pointerTarget;
      } else {
        idleSeconds += dt;
        nextWanderAt -= dt;
        if (nextWanderAt <= 0) {
          nextWanderAt = wanderIntervalSeconds[0] + Math.random() * (wanderIntervalSeconds[1] - wanderIntervalSeconds[0]);
          wanderTarget = Math.random() < 0.3 ? { x: 0, y: 0 } : { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
        }
        target = idleSeconds > 2.5 ? wanderTarget : { x: 0, y: 0 };
      }
      lookX = damp(lookX, target.x, gazeRate, dt);
      lookY = damp(lookY, target.y, gazeRate, dt);
    }

    // `turn` (giro): a reaction can slide the eyes toward a side independent of gaze.
    const turn = r.turn ?? 0;
    const eyeDx = lookX * 30 + turn * 20;
    const eyeDy = lookY * 22 + (r.eyeY ?? 0);
    leftEye.g.setAttribute("transform", `translate(${RIG_BERRY.eyes.left.x + eyeDx} ${RIG_BERRY.eyes.left.y + eyeDy})`);
    rightEye.g.setAttribute("transform", `translate(${RIG_BERRY.eyes.right.x + eyeDx} ${RIG_BERRY.eyes.right.y + eyeDy})`);

    stepJump(jump, squash, dt);
    const dBodyVy = jump.vy - prevVy;
    prevVy = jump.vy;

    const leafDeltaByRole = { C: r.leafC ?? 0, L: r.leafL ?? 0, R: r.leafR ?? 0 };
    for (const leaf of leaves) {
      const idleTarget = idleAmpDeg * ((Math.sin(t * idleFreqA + leaf.phase) + Math.sin(t * idleFreqB + leaf.phase * 1.7)) / 2);
      spring(leaf.base, idleTarget, leafSpringK, leafSpringC, dt);
      const dBaseVel = leaf.base.v - leaf.prevBaseV;
      leaf.prevBaseV = leaf.base.v;
      stepTip(leaf.tip, dBaseVel, dBodyVy, leaf.side, dt);
      const total = leaf.base.a + leafDeltaByRole[leaf.rig.role];
      leaf.group.setAttribute("transform", `rotate(${total} ${leaf.rig.pivot.x} ${leaf.rig.pivot.y})`);
      leaf.path.setAttribute("d", bendPath(leaf.cmds, leaf.axis, leaf.tip.a));
    }

    const breathe = Math.sin(t * breatheFreq);
    const stretch = !atRest(jump) ? clamp(-jump.vy / 12000, -0.05, 0.1) : 0;
    const sx = (1 - 0.012 * breathe) * (1 + squash.s * 0.5) * (1 - stretch * 0.5) * (1 + (r.bodySx ?? 0));
    const sy = (1 + 0.024 * breathe) * (1 - squash.s) * (1 + stretch) * (1 + (r.bodySy ?? 0));
    const { x: gx, y: gy } = RIG_BERRY.ground;
    const bodyTilt = lookX * 2.2 + (r.bodyRotate ?? 0);
    const totalY = jump.y + (r.rootY ?? 0);
    bodyGroup.setAttribute(
      "transform",
      `translate(0 ${totalY}) translate(${gx} ${gy}) rotate(${bodyTilt}) scale(${sx} ${sy}) translate(${-gx} ${-gy})`,
    );

    if (r.centerRotate) {
      const { x: cx, y: cy } = RIG_BERRY.center;
      spinGroup.setAttribute("transform", `rotate(${r.centerRotate} ${cx} ${cy})`);
    } else {
      spinGroup.removeAttribute("transform");
    }

    const shut = stepBlink(blink, nowMs, Math.random);
    const extraSquash = r.eyeSy ?? 0;
    const lidTop = Math.max(shut, r.lidTop ?? 0);
    const leftOpen = Math.max(1 - Math.max(lidTop, r.lidBottomLeft ?? 0), 0.04);
    const rightOpen = Math.max(1 - Math.max(lidTop, r.lidBottomRight ?? 0), 0.04);
    leftEye.lid.setAttribute("transform", `scale(1 ${leftOpen * (1 + extraSquash)})`);
    rightEye.lid.setAttribute("transform", `scale(1 ${rightOpen * (1 + extraSquash)})`);

    const happyLeft = Math.max(r.happy ?? 0, r.happyLeft ?? 0);
    const happyRight = Math.max(r.happy ?? 0, r.happyRight ?? 0);
    leftEye.pill.setAttribute("opacity", String(1 - happyLeft));
    leftEye.arc.setAttribute("opacity", String(happyLeft));
    rightEye.pill.setAttribute("opacity", String(1 - happyRight));
    rightEye.arc.setAttribute("opacity", String(happyRight));

    bodyPath.setAttribute("d", RIG_BERRY.body);
  }

  let rafId = null;
  return {
    tick,
    jump: () => launch(jump),
    react: (name) => reactions.play(name),
    start() {
      const loop = (nowMs) => { tick(nowMs); rafId = requestAnimationFrame(loop); };
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}
