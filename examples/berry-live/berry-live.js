/**
 * Mounts a real, running Berry: `berry-rig.js` (exact geometry) rendered as
 * SVG, driven by `BerryBrain` (`berry-brain.js`, the ported `cerebro.ts`),
 * with the page wiring (pointer, hover, click, focus/anchors via
 * `berry-focus.js`) this demo owns. Not part of the installable
 * `procedural-bot-animations` package — see `berry-case-study.md`.
 */
import { BerryBrain } from "./berry-brain.js";
import { decideGaze, newFocusState, observePage } from "./berry-focus.js";
import { axisOf, bendPath, clamp, fmtNum as f, parsePath } from "./berry-motor.js";
import { RIG_BERRY } from "./berry-rig.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function mountBerry(svg, options = {}) {
  const { color = "#e11d2e", eyeColor = "#1b1210", interactive = true, reducedMotion = false, gazeMode = "pointer" } = options;

  const shadow = document.createElementNS(SVG_NS, "ellipse");
  shadow.setAttribute("cx", String(RIG_BERRY.shadow.x));
  shadow.setAttribute("cy", String(RIG_BERRY.shadow.y));
  shadow.setAttribute("rx", String(RIG_BERRY.shadow.rx));
  shadow.setAttribute("ry", String(RIG_BERRY.shadow.ry));
  shadow.setAttribute("fill", "#000");

  const spinGroup = document.createElementNS(SVG_NS, "g"); // reactions that spin around the body's center
  const bodyGroup = document.createElementNS(SVG_NS, "g"); // ground-pivoted breathing/tilt/jump
  spinGroup.appendChild(bodyGroup);

  const bodyPath = document.createElementNS(SVG_NS, "path");
  bodyPath.setAttribute("fill", color);
  bodyPath.setAttribute("d", RIG_BERRY.body);
  bodyGroup.appendChild(bodyPath);

  const leaves = RIG_BERRY.appendages.map((a) => ({
    rig: a,
    axis: axisOf(a),
    cmds: parsePath(a.path),
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
    const lid = document.createElementNS(SVG_NS, "g");
    const { w, h } = RIG_BERRY.eyeShape;
    const pill = document.createElementNS(SVG_NS, "rect");
    pill.setAttribute("x", String(-w / 2));
    pill.setAttribute("y", String(-h / 2));
    pill.setAttribute("width", String(w));
    pill.setAttribute("height", String(h));
    pill.setAttribute("rx", String(w / 2));
    pill.setAttribute("fill", eyeColor);
    const arc = document.createElementNS(SVG_NS, "path");
    const aw = w / 2;
    arc.setAttribute("d", `M ${-aw} ${h * 0.16} Q 0 ${-h * 0.42} ${aw} ${h * 0.16} Q 0 ${-h * 0.08} ${-aw} ${h * 0.16} Z`);
    arc.setAttribute("fill", eyeColor);
    arc.setAttribute("opacity", "0");
    lid.append(pill, arc);
    g.appendChild(lid);
    return { g, lid };
  }
  const eyeLeft = makeEye(RIG_BERRY.eyes.left.x, RIG_BERRY.eyes.left.y);
  const eyeRight = makeEye(RIG_BERRY.eyes.right.x, RIG_BERRY.eyes.right.y);
  bodyGroup.append(eyeLeft.g, eyeRight.g);

  // Simple text accessories (lamp/!/?/.../zzz) — a plain, honest stand-in for
  // DevBerry's illustrated icons; see berry-case-study.md.
  function makeAccessory(symbol, dx) {
    const t = document.createElementNS(SVG_NS, "text");
    t.textContent = symbol;
    t.setAttribute("x", String(RIG_BERRY.center.x + dx));
    t.setAttribute("y", "210");
    t.setAttribute("font-size", "70");
    t.setAttribute("font-family", "system-ui, sans-serif");
    t.setAttribute("font-weight", "700");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", color);
    t.setAttribute("opacity", "0");
    bodyGroup.appendChild(t);
    return t;
  }
  const accessories = {
    exclaim: makeAccessory("!", 110),
    question: makeAccessory("?", 110),
    lamp: makeAccessory("\u{1F4A1}", -110),
    ellipsis: makeAccessory("…", 0),
    zzz: makeAccessory("z z z", 0),
  };

  svg.append(shadow, spinGroup);

  const brain = new BerryBrain(performance.now());
  const focus = newFocusState();
  const stopObserving = interactive ? observePage() : () => {};

  let pointer = null; // {x,y} in client px
  let pointerInside = false;
  let lastPointerMoveT = 0;
  let hovering = false;
  let mood = {};
  let activity = null;
  let bend = true;

  if (interactive) {
    svg.addEventListener("pointerenter", () => {
      hovering = true;
      brain.hoverEnter(performance.now());
    });
    svg.addEventListener("pointerleave", () => { hovering = false; pointerInside = false; });
    svg.addEventListener("pointermove", (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      pointerInside = true;
      lastPointerMoveT = performance.now();
    });
    svg.addEventListener("pointerdown", () => brain.tap(performance.now()));
  }

  function tick(nowMs) {
    const rect = svg.getBoundingClientRect();

    let gazeInput = null;
    let glideSeconds;
    if (gazeMode === "pointer" && pointer) {
      gazeInput = { x: clamp(((pointer.x - rect.left) / rect.width) * 2 - 1, -1, 1), y: clamp(((pointer.y - rect.top) / rect.height) * 2 - 1, -1, 1) };
    } else if (gazeMode !== "pointer") {
      const cursor = { x: pointer?.x ?? -9999, y: pointer?.y ?? -9999, last: lastPointerMoveT, inside: pointerInside };
      const decision = decideGaze(focus, nowMs, Math.random, rect, cursor, gazeMode);
      if (decision.point === "screen") gazeInput = { x: 0, y: -0.15 };
      else if (decision.point) {
        gazeInput = { x: clamp(((decision.point.x - rect.left) / rect.width) * 2 - 1, -1, 1), y: clamp(((decision.point.y - rect.top) / rect.height) * 2 - 1, -1, 1) };
      }
      glideSeconds = decision.glide || undefined;
    }

    const proximity = pointer ? clamp(1 - Math.hypot(pointer.x - (rect.left + rect.width / 2), pointer.y - (rect.top + rect.height / 2)) / (rect.width * 1.2), 0, 1) : 0;

    const pose = brain.step(nowMs, {
      gaze: gazeInput,
      hover: hovering,
      reducedMotion,
      mood,
      activity,
      detail: "full",
      bend,
      proximity,
      glideSeconds,
    });

    applyPose(pose);
  }

  function applyPose(pose) {
    bodyPath.setAttribute("d", RIG_BERRY.body);

    const { x: gx, y: gy } = RIG_BERRY.ground;
    bodyGroup.setAttribute(
      "transform",
      `translate(0 ${f(pose.rootY)}) translate(${f(gx)} ${f(gy)}) rotate(${f(pose.bodyRotate)}) scale(${f(pose.bodySx)} ${f(pose.bodySy)}) translate(${f(-gx)} ${f(-gy)})`,
    );
    if (pose.centerRotate) spinGroup.setAttribute("transform", `rotate(${f(pose.centerRotate)} ${f(RIG_BERRY.center.x)} ${f(RIG_BERRY.center.y)})`);
    else spinGroup.removeAttribute("transform");

    const byRole = { C: pose.leafC, L: pose.leafL, R: pose.leafR };
    const bendByRole = { C: pose.bendC, L: pose.bendL, R: pose.bendR };
    for (const leaf of leaves) {
      leaf.group.setAttribute("transform", `rotate(${f(byRole[leaf.rig.role])} ${f(leaf.rig.pivot.x)} ${f(leaf.rig.pivot.y)})`);
      leaf.path.setAttribute("d", bendPath(leaf.cmds, leaf.axis, bendByRole[leaf.rig.role]));
    }

    const { h: eh } = RIG_BERRY.eyeShape;
    // `pose.eyeLeft/Right.x/y` are offsets from the rig's base eye anchor, not
    // absolute coordinates (matching DevBerry's own `olho()` — see cerebro.ts).
    function applyEye(eye, pos, base) {
      const liftFraction = clamp(pos.lidTop + pos.lidBottom, 0, 0.96);
      const visible = Math.max(0.04, 1 - liftFraction);
      const centerShift = ((pos.lidTop - pos.lidBottom) / 2) * eh * pos.sy;
      eye.g.setAttribute("transform", `translate(${f(base.x + pos.x)} ${f(base.y + pos.y + centerShift)})`);
      eye.lid.setAttribute("transform", `rotate(${f(pos.rotate + pos.lidAngle)}) scale(${f(pos.sx)} ${f(pos.sy * visible)})`);
      const pill = eye.lid.children[0];
      const arc = eye.lid.children[1];
      pill.setAttribute("opacity", String(1 - pos.happy));
      arc.setAttribute("opacity", String(pos.happy));
    }
    applyEye(eyeLeft, pose.eyeLeft, RIG_BERRY.eyes.left);
    applyEye(eyeRight, pose.eyeRight, RIG_BERRY.eyes.right);

    shadow.setAttribute("transform", `translate(${f(RIG_BERRY.shadow.x)} ${f(RIG_BERRY.shadow.y)}) scale(${f(pose.shadowScale)}) translate(${f(-RIG_BERRY.shadow.x)} ${f(-RIG_BERRY.shadow.y)})`);
    shadow.setAttribute("opacity", String(pose.shadowOpacity));

    accessories.exclaim.setAttribute("opacity", String(pose.exclaim));
    accessories.question.setAttribute("opacity", String(pose.question));
    accessories.lamp.setAttribute("opacity", String(pose.lamp));
    accessories.ellipsis.setAttribute("opacity", String(pose.ellipsis));
    accessories.zzz.setAttribute("opacity", String(pose.zzz));
  }

  let rafId = null;
  return {
    brain,
    setMood(weights) { mood = weights; },
    setActivity(name) { activity = name; },
    setBend(v) { bend = v; },
    jump: () => brain.jump(),
    react: (name) => brain.react(name, performance.now()),
    tap: () => brain.tap(performance.now()),
    tick,
    start() {
      const loop = (nowMs) => { tick(nowMs); rafId = requestAnimationFrame(loop); };
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    destroy() {
      this.stop();
      stopObserving();
    },
  };
}
