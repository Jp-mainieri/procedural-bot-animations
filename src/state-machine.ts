export interface StateDef<S extends string, Ctx> {
  id: S;
  /** Called once when the machine enters this state. */
  onEnter?(ctx: Ctx): void;
  /** Called once when the machine leaves this state. */
  onExit?(ctx: Ctx): void;
  /** Transition to `to` automatically after `ms` of being in this state, unless interrupted. */
  after?: { ms: number; to: S };
  /** States that may interrupt this one even mid-timer/mid-animation. Default: all. */
  interruptibleBy?: S[] | "*";
  /** Arbitrary data a binder (e.g. an avatar renderer) reads to decide mood/motion for this state. */
  data?: Record<string, unknown>;
}

export interface TransitionDef<S extends string, E extends string, Ctx> {
  from: S | "*";
  event: E;
  to: S;
  guard?(ctx: Ctx): boolean;
}

export interface StateMachineConfig<S extends string, E extends string, Ctx> {
  initial: S;
  states: Record<S, StateDef<S, Ctx>>;
  transitions: TransitionDef<S, E, Ctx>[];
  context?: Ctx;
}

export interface BotStateMachine<S extends string, E extends string, Ctx> {
  getState(): S;
  getContext(): Ctx;
  /** Fires `event`; returns true if a transition matched and ran. */
  send(event: E): boolean;
  /** Force a transition, bypassing `transitions` (still runs onExit/onEnter and schedules `after`). */
  goto(state: S): void;
  /** Advance internal timers (the `after` auto-transitions). Call every frame with a delta in ms. */
  tick(dtMs: number): void;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(fn: (state: S, previous: S) => void): () => void;
}

/**
 * A small typed finite state machine for bot/mascot behavior (idle,
 * thinking, success, error, loading, sleeping, or any custom set). Framework-
 * and renderer-agnostic: it only tracks state and timers, you decide in
 * `onEnter`/`onExit` or in a `bind*` helper what that means visually.
 */
export function createStateMachine<S extends string, E extends string, Ctx = Record<string, never>>(
  config: StateMachineConfig<S, E, Ctx>,
): BotStateMachine<S, E, Ctx> {
  let current = config.initial;
  let timerMs: number | null = null;
  let timerTarget: S | null = null;
  const context = (config.context ?? ({} as Ctx)) as Ctx;
  const listeners = new Set<(state: S, previous: S) => void>();

  function enter(state: S) {
    const def = config.states[state];
    timerMs = def.after ? def.after.ms : null;
    timerTarget = def.after ? def.after.to : null;
  }

  function transitionTo(next: S) {
    if (next === current) return;
    const previous = current;
    const prevDef = config.states[previous];
    prevDef.onExit?.(context);
    current = next;
    enter(next);
    config.states[next].onEnter?.(context);
    for (const fn of listeners) fn(current, previous);
  }

  enter(current);
  config.states[current].onEnter?.(context);

  return {
    getState: () => current,
    getContext: () => context,
    send(event) {
      const currentDef = config.states[current];
      for (const t of config.transitions) {
        if ((t.from === "*" || t.from === current) && t.event === event) {
          if (t.guard && !t.guard(context)) continue;
          if (
            currentDef.interruptibleBy &&
            currentDef.interruptibleBy !== "*" &&
            !currentDef.interruptibleBy.includes(t.to)
          ) {
            continue;
          }
          transitionTo(t.to);
          return true;
        }
      }
      return false;
    },
    goto(state) {
      transitionTo(state);
    },
    tick(dtMs) {
      if (timerMs === null || timerTarget === null) return;
      timerMs -= dtMs;
      if (timerMs <= 0) {
        transitionTo(timerTarget);
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Common bot states, free to use as-is or as a starting point for your own `S` union. */
export type CommonBotState =
  | "idle"
  | "thinking"
  | "success"
  | "error"
  | "loading"
  | "sleeping";
