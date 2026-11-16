import { EXCLUSIVE } from "./transformations.js";
import { ACTIVITIES, REACTIONS, type ActivityDef, type ReactionDef } from "./reactions.js";
import { MOODS } from "./moods.js";
import type { PartialDelta } from "./delta.js";

/**
 * Everything a brain can play, looked up by name. Add your own entries to a
 * library made with `createLibrary()` and pass it to the brain or to
 * `mountCharacter`.
 */
export type Library = {
  reactions: Record<string, ReactionDef>;
  activities: Record<string, ActivityDef>;
  moods: Record<string, PartialDelta>;
  /** Reactions that cannot be interrupted (object morphs). */
  exclusive: Set<string>;
};

/** A fresh library (shallow copies of the built-in tables) that is safe to extend. */
export function createLibrary(): Library {
  return {
    reactions: { ...REACTIONS },
    activities: { ...ACTIVITIES },
    moods: { ...MOODS },
    exclusive: new Set(EXCLUSIVE),
  };
}

/** The built-in library. Treat it as read-only; use `createLibrary()` to customise. */
export const DEFAULT_LIBRARY: Library = createLibrary();
