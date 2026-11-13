import { describe, expect, it } from "vitest";
import { createStateMachine, type CommonBotState } from "../src/state-machine.js";

type Event = "ask" | "resolve" | "fail" | "reset" | "sleep";

function makeMachine() {
  const log: string[] = [];
  return {
    log,
    machine: createStateMachine<CommonBotState, Event>({
      initial: "idle",
      states: {
        idle: { id: "idle", onEnter: () => log.push("enter:idle") },
        thinking: { id: "thinking", onEnter: () => log.push("enter:thinking") },
        success: { id: "success", after: { ms: 1000, to: "idle" } },
        error: { id: "error", interruptibleBy: ["idle"] },
        loading: { id: "loading" },
        sleeping: { id: "sleeping" },
      },
      transitions: [
        { from: "idle", event: "ask", to: "thinking" },
        { from: "thinking", event: "resolve", to: "success" },
        { from: "thinking", event: "fail", to: "error" },
        { from: "error", event: "reset", to: "idle" },
        { from: "*", event: "sleep", to: "sleeping" },
      ],
    }),
  };
}

describe("createStateMachine", () => {
  it("starts in the initial state and runs its onEnter", () => {
    const { machine, log } = makeMachine();
    expect(machine.getState()).toBe("idle");
    expect(log).toContain("enter:idle");
  });

  it("transitions on matching events only", () => {
    const { machine } = makeMachine();
    expect(machine.send("resolve")).toBe(false); // no idle->success transition
    expect(machine.getState()).toBe("idle");
    expect(machine.send("ask")).toBe(true);
    expect(machine.getState()).toBe("thinking");
  });

  it("supports wildcard `from: '*'` transitions", () => {
    const { machine } = makeMachine();
    machine.send("ask");
    expect(machine.send("sleep")).toBe(true);
    expect(machine.getState()).toBe("sleeping");
  });

  it("auto-transitions after the configured timer", () => {
    const { machine } = makeMachine();
    machine.send("ask");
    machine.send("resolve");
    expect(machine.getState()).toBe("success");
    machine.tick(999);
    expect(machine.getState()).toBe("success");
    machine.tick(2);
    expect(machine.getState()).toBe("idle");
  });

  it("notifies subscribers with (state, previous)", () => {
    const { machine } = makeMachine();
    const seen: Array<[string, string]> = [];
    const unsubscribe = machine.subscribe((s, prev) => seen.push([s, prev]));
    machine.send("ask");
    unsubscribe();
    machine.send("fail");
    expect(seen).toEqual([["thinking", "idle"]]);
  });

  it("respects interruptibleBy, blocking transitions it does not list", () => {
    const { machine } = makeMachine();
    machine.send("ask");
    machine.send("fail");
    expect(machine.getState()).toBe("error");
    // "sleep" is a wildcard transition but error only allows "idle" to interrupt it.
    expect(machine.send("sleep")).toBe(false);
    expect(machine.getState()).toBe("error");
    expect(machine.send("reset")).toBe(true);
    expect(machine.getState()).toBe("idle");
  });

  it("goto() forces a transition even with no matching transition def", () => {
    const { machine } = makeMachine();
    machine.goto("loading");
    expect(machine.getState()).toBe("loading");
  });
});
