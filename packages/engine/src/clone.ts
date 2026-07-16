/**
 * Deep clone of Game state. Handles bigint, Set, and plain objects/arrays.
 * resolveTurn clones the input so callers' state is never mutated.
 */

import type { Game } from "./types.js";

export function deepClone<T>(value: T): T {
  return cloneValue(value) as T;
}

function cloneValue(v: unknown): unknown {
  if (v === null || typeof v !== "object") {
    // primitives incl. bigint, number, string, boolean, undefined
    return v;
  }
  if (v instanceof Set) {
    const s = new Set();
    for (const item of v) s.add(cloneValue(item));
    return s;
  }
  if (v instanceof Map) {
    const m = new Map();
    for (const [k, val] of v) m.set(cloneValue(k), cloneValue(val));
    return m;
  }
  if (Array.isArray(v)) {
    return v.map(cloneValue);
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(v)) {
    out[key] = cloneValue((v as Record<string, unknown>)[key]);
  }
  return out;
}

export function cloneGame(game: Game): Game {
  return deepClone(game);
}
