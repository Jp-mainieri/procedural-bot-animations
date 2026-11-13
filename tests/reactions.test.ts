import { describe, expect, it } from "vitest";
import { ReactionPlayer, bounce } from "../src/reactions.js";

describe("bounce curve", () => {
  it("starts and ends at rest (no vertical offset)", () => {
    expect(bounce.curve(0).body?.y).toBeCloseTo(0, 1);
    expect(bounce.curve(1).body?.y).toBeCloseTo(0, 1);
  });

  it("goes up (negative y) at the midpoint", () => {
    expect(bounce.curve(0.5).body!.y!).toBeLessThan(0);
  });
});

describe("ReactionPlayer", () => {
  it("starts a reaction immediately when idle", () => {
    const player = new ReactionPlayer();
    expect(player.play("bounce")).toBe(true);
    expect(player.isPlaying).toBe(true);
    expect(player.currentName).toBe("bounce");
  });

  it("returns false for an unknown reaction and does not start it", () => {
    const player = new ReactionPlayer();
    expect(player.play("not-a-real-reaction")).toBe(false);
    expect(player.isPlaying).toBe(false);
  });

  it("finishes and clears after its duration", () => {
    const player = new ReactionPlayer();
    player.play("doubleBlink");
    for (let i = 0; i < 60; i++) player.update(1 / 60);
    expect(player.isPlaying).toBe(false);
  });

  it("queues a second request instead of cutting the first one off", () => {
    const player = new ReactionPlayer();
    player.play("bounce"); // priority 1
    const startedImmediately = player.play("doubleBlink"); // priority 0, queued behind bounce's higher priority
    expect(startedImmediately).toBe(false);
    expect(player.currentName).toBe("bounce");
  });

  it("promotes the queued reaction once the current one ends", () => {
    const player = new ReactionPlayer();
    player.play("doubleBlink");
    player.play("nod");
    for (let i = 0; i < 40; i++) player.update(1 / 60); // doubleBlink (0.45s) finishes
    expect(player.currentName).toBe("nod");
  });

  it("drops a queued reaction that has gone stale", () => {
    const player = new ReactionPlayer({ maxQueueAgeSeconds: 0.1 });
    player.play("doubleBlink");
    player.play("nod");
    // Let more than maxQueueAgeSeconds pass before doubleBlink's own 0.45s finishes it.
    for (let i = 0; i < 30; i++) player.update(1 / 60); // ~0.5s
    expect(player.currentName).toBeNull();
    expect(player.isPlaying).toBe(false);
  });

  it("a higher-priority request overrides a lower-priority pending one", () => {
    const player = new ReactionPlayer();
    player.play("bounce"); // priority 1, playing
    player.play("nod"); // priority 0, queued
    player.play("fright"); // priority 3, should replace nod as pending
    for (let i = 0; i < 40; i++) player.update(1 / 60); // bounce (0.55s) finishes
    expect(player.currentName).toBe("fright");
  });
});
