/*
 * Persistent Studio state: one versioned localStorage key. Every read and write
 * is wrapped in try/catch, so the page works with storage blocked, and anything
 * stored is validated again on load (invalid entries are dropped, never fatal).
 */

import { parseAnimation, parseCharacter } from "./dist/index.js";

export const STORAGE_KEY = "pba-studio-v1";

const GAZE = ["pointer", "free", "focus"];
const EYE_STYLES = ["classic", "pumpy", "big"];
const THEMES = ["light", "dark", "system"];

/** Live state. `userCharacters` / `userAnimations` hold parsed entries; only definitions are stored. */
export const state = {
  character: "berry",
  /** Body colour per character id; missing means the character's own default. */
  colors: {},
  eyeLight: false,
  eyeStyle: "classic",
  gaze: "pointer",
  theme: "system",
  /** [{ id, definition, rig, warnings }] */
  userCharacters: [],
  /** [{ id, definition, compiled, warnings }] */
  userAnimations: [],
};

function readRaw() {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const isColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/**
 * Loads the saved state into `state`. `reserved` holds the ids a user entry may not take
 * (built-in and example characters and animations).
 */
export function loadState(reserved) {
  const saved = readRaw();
  if (!saved || typeof saved !== "object" || saved.v !== 1) return state;

  if (typeof saved.character === "string") state.character = saved.character.slice(0, 40);
  if (saved.colors && typeof saved.colors === "object") {
    for (const [id, c] of Object.entries(saved.colors)) if (isColor(c)) state.colors[id] = c;
  }
  state.eyeLight = saved.eyeLight === true;
  if (EYE_STYLES.includes(saved.eyeStyle)) state.eyeStyle = saved.eyeStyle;
  if (GAZE.includes(saved.gaze)) state.gaze = saved.gaze;
  if (THEMES.includes(saved.theme)) state.theme = saved.theme;

  const seen = new Set();
  for (const def of Array.isArray(saved.userCharacters) ? saved.userCharacters : []) {
    const r = parseCharacter(JSON.stringify(def));
    const id = r.ok ? r.value.definition.id : null;
    if (!r.ok || reserved.characters.has(id) || seen.has(id)) {
      console.warn(`[studio] dropped a stored character: ${r.ok ? `id "${id}" is taken` : r.errors[0]}`);
      continue;
    }
    seen.add(id);
    state.userCharacters.push({ id, definition: r.value.definition, rig: r.value.rig, warnings: r.warnings });
  }

  seen.clear();
  for (const def of Array.isArray(saved.userAnimations) ? saved.userAnimations : []) {
    const r = parseAnimation(JSON.stringify(def));
    const id = r.ok ? r.value.definition.id : null;
    if (!r.ok || reserved.animations.has(id) || seen.has(id)) {
      console.warn(`[studio] dropped a stored animation: ${r.ok ? `id "${id}" is taken` : r.errors[0]}`);
      continue;
    }
    seen.add(id);
    state.userAnimations.push({ id, definition: r.value.definition, compiled: r.value.compiled, warnings: r.warnings });
  }
  return state;
}

export function persist() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        character: state.character,
        colors: state.colors,
        eyeLight: state.eyeLight,
        eyeStyle: state.eyeStyle,
        gaze: state.gaze,
        theme: state.theme,
        userCharacters: state.userCharacters.map((c) => c.definition),
        userAnimations: state.userAnimations.map((a) => a.definition),
      }),
    );
  } catch (err) {
    console.warn("[studio] could not save to localStorage:", err instanceof Error ? err.message : err);
  }
}
