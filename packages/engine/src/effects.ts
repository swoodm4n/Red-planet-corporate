/**
 * Durational status effects (§17 multi-turn event modifiers). [D-042]
 *
 * A single generic list lives on `game.activeEffects`. Effects are registered
 * (usually by Phase 7 events) with a `turnsRemaining` count and are read by the
 * phases that must enforce them:
 *   - Phase 3 production reads OUTPUT_DELTA / MODULE_HALF_EFFECT / TERRAIN suspend.
 *   - Phase 5 unit actions read NO_INTELLIGENCE.
 * Effects are ticked/expired in Phase 8 (before the turn increments) via
 * {@link tickEffects}; an effect is never ticked on the turn it was registered,
 * so a duration-N effect applies to the next N production phases. [D-042]
 */

import { hasActiveModule } from "./helpers.js";
import { sameCoord } from "./map.js";
import type { ActiveEffect, Building, Game, ModuleType } from "./types.js";

export function addEffect(game: Game, effect: Omit<ActiveEffect, "id">): ActiveEffect {
  const e: ActiveEffect = { id: game.nextIds.effect++, ...effect };
  game.activeEffects.push(e);
  return e;
}

function effectAppliesToBuilding(
  e: ActiveEffect,
  b: Building,
  subId: number,
): boolean {
  if (e.turnsRemaining <= 0) return false;
  switch (e.scope) {
    case "COLONY":
      break;
    case "SUBDIVISION":
      if (e.subdivisionId !== subId) return false;
      break;
    case "BUILDING":
      if (e.buildingId !== b.id) return false;
      break;
    case "REGION":
      if (!(e.hexes ?? []).some((h) => sameCoord(h, b.hex))) return false;
      break;
  }
  if (e.requiresUnshielded && hasActiveModule(b, "HAZARD_SHIELD")) return false;
  if (e.requiresNoRedundant && hasActiveModule(b, "REDUNDANT_SYSTEMS")) return false;
  return true;
}

/** Sum of OUTPUT_DELTA magnitudes affecting this building this turn. */
export function outputDeltaFor(game: Game, b: Building, subId: number): number {
  let delta = 0;
  for (const e of game.activeEffects) {
    if (e.type !== "OUTPUT_DELTA") continue;
    if (effectAppliesToBuilding(e, b, subId)) delta += e.magnitude ?? 0;
  }
  return delta;
}

/** True if a MODULE_HALF_EFFECT effect halves `moduleType` on this building. */
export function moduleHalved(
  game: Game,
  b: Building,
  subId: number,
  moduleType: ModuleType,
): boolean {
  for (const e of game.activeEffects) {
    if (e.type !== "MODULE_HALF_EFFECT" || e.moduleType !== moduleType) continue;
    if (effectAppliesToBuilding(e, b, subId)) return true;
  }
  return false;
}

/** True if this building's terrain exploit is suspended (Ice Deposit Shift). */
export function terrainExploitSuspended(game: Game, b: Building, subId: number): boolean {
  for (const e of game.activeEffects) {
    if (e.type !== "TERRAIN_EXPLOIT_SUSPEND") continue;
    if (effectAppliesToBuilding(e, b, subId)) return true;
  }
  return false;
}

/** True if Intelligence unit actions are blocked for this subdivision (Solar Flare). */
export function noIntelligenceActive(game: Game, subId: number): boolean {
  for (const e of game.activeEffects) {
    if (e.type !== "NO_INTELLIGENCE" || e.turnsRemaining <= 0) continue;
    if (e.scope === "COLONY") return true;
    if (e.scope === "SUBDIVISION" && e.subdivisionId === subId) return true;
  }
  return false;
}

/**
 * Decrement and expire durational effects. Called in Phase 8 while
 * `game.turnNumber` is still the turn just processed; effects registered this
 * turn (registeredTurn === turnNumber) are not ticked, so a duration-N effect
 * applies to the next N production phases. [D-042]
 */
export function tickEffects(game: Game): void {
  for (const e of game.activeEffects) {
    if (e.registeredTurn < game.turnNumber) e.turnsRemaining -= 1;
  }
  game.activeEffects = game.activeEffects.filter((e) => e.turnsRemaining > 0);
}
