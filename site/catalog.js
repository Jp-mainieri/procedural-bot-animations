/*
 * What the Studio can show: characters (built-in, example, yours) and animations
 * (built-in, example, yours), plus the working library the stage plays from.
 */

import {
  DEFAULT_LIBRARY,
  EXAMPLE_ANIMATIONS,
  EXAMPLE_CHARACTERS,
  INTERACTIONS,
  RIG_BERRY,
  RIG_FLAME,
  addToLibrary,
  createLibrary,
  parseAnimation,
  parseCharacter,
} from "./dist/index.js";

/** Eight body colours that read well on both the light and the dark stage. */
export const SWATCHES = [
  { name: "Red", value: "#e11d2e" },
  { name: "Orange", value: "#ff7a1a" },
  { name: "Amber", value: "#e0a100" },
  { name: "Green", value: "#2f9e5f" },
  { name: "Teal", value: "#12a3a3" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pink", value: "#e0529c" },
];

const EXAMPLE_FALLBACK_COLORS = ["#ff8fb1", "#4fae6a", "#6c8cff", "#e0a100", "#12a3a3", "#8b5cf6"];

/* ---------- characters ---------- */

const BUILTIN = [
  { id: "berry", name: "Berry", rig: RIG_BERRY, color: "#e11d2e", source: "built-in", definition: null },
  { id: "flame", name: "Flame", rig: RIG_FLAME, color: "#ff7a1a", source: "built-in", definition: null },
];

const EXAMPLES = EXAMPLE_CHARACTERS.map((def, i) => {
  const r = parseCharacter(JSON.stringify(def));
  if (!r.ok) {
    console.warn(`[studio] example character "${def.id}" did not validate: ${r.errors[0]}`);
    return null;
  }
  return {
    id: def.id,
    name: def.name,
    rig: r.value.rig,
    color: def.rig?.color ?? EXAMPLE_FALLBACK_COLORS[i % EXAMPLE_FALLBACK_COLORS.length],
    source: "example",
    definition: def,
  };
}).filter(Boolean);

export const BUILTIN_IDS = new Set(BUILTIN.map((c) => c.id));
export const EXAMPLE_IDS = new Set(EXAMPLES.map((c) => c.id));

/** Every character, in gallery order. */
export function allCharacters(state) {
  const mine = state.userCharacters.map((u) => ({
    id: u.id,
    name: u.definition.name,
    rig: u.rig,
    color: u.definition.rig?.color ?? "#6c8cff",
    source: "yours",
    definition: u.definition,
  }));
  return [...BUILTIN, ...EXAMPLES, ...mine];
}

export function findCharacter(state, id) {
  return allCharacters(state).find((c) => c.id === id) ?? null;
}

/** A rig that flickers like fire gets the flame's hover and click behaviour. */
export function interactionsFor(rig) {
  return rig.flicker > 0 && rig.id !== "flame" ? INTERACTIONS.flame : undefined;
}

/* ---------- animations ---------- */

/**
 * Builds the working library: built-ins, then the examples, then the user's animations.
 * `entries` lists everything with its origin (the key is `kind:id`).
 */
export function buildAnimations(state) {
  const library = createLibrary();
  const entries = [];
  const push = (kind, id, name, origin, extra = {}) =>
    entries.push({ key: `${kind}:${id}`, kind, id, name, origin, definition: null, ...extra });

  for (const id of Object.keys(DEFAULT_LIBRARY.reactions)) push("reaction", id, id, "built-in");
  for (const id of Object.keys(DEFAULT_LIBRARY.activities)) push("activity", id, id, "built-in");
  for (const id of Object.keys(DEFAULT_LIBRARY.moods)) push("mood", id, id, "built-in");

  for (const def of EXAMPLE_ANIMATIONS) {
    const r = parseAnimation(JSON.stringify(def));
    if (!r.ok) {
      console.warn(`[studio] example animation "${def.id}" did not validate: ${r.errors[0]}`);
      continue;
    }
    addToLibrary(library, r.value.compiled);
    push(def.kind, def.id, def.name, "example", { definition: r.value.definition });
  }
  for (const u of state.userAnimations) {
    addToLibrary(library, u.compiled);
    push(u.definition.kind, u.id, u.definition.name, "yours", { definition: u.definition });
  }
  return { library, entries };
}

/** Ids a user animation may not take: everything built-in or from the examples (any kind). */
export function reservedAnimationIds() {
  const ids = new Set([
    ...Object.keys(DEFAULT_LIBRARY.reactions),
    ...Object.keys(DEFAULT_LIBRARY.activities),
    ...Object.keys(DEFAULT_LIBRARY.moods),
  ]);
  for (const def of EXAMPLE_ANIMATIONS) ids.add(def.id);
  return ids;
}

export function reservedCharacterIds() {
  return new Set([...BUILTIN_IDS, ...EXAMPLE_IDS]);
}

/** A copy of a library that is safe to extend without touching the working one. */
export function scratchLibrary(library) {
  return {
    reactions: { ...library.reactions },
    activities: { ...library.activities },
    moods: { ...library.moods },
    exclusive: new Set(library.exclusive),
  };
}

export { EXAMPLE_ANIMATIONS, EXAMPLE_CHARACTERS };
