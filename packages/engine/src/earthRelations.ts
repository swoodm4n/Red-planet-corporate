/**
 * Earth Relations track & thresholds. GAME_SPEC §13 / [D-024], [D-025].
 * Start 10, clamp [0,30]. ER is NOT part of scoring.
 */

import { ER_MAX, ER_MIN } from "./constants.js";
import type { Subdivision } from "./types.js";

/** Adjust ER, clamped to [0,30]. Returns the actual delta applied. */
export function adjustEr(sub: Subdivision, delta: number): number {
  const before = sub.earthRelations;
  sub.earthRelations = Math.max(ER_MIN, Math.min(ER_MAX, before + delta));
  return sub.earthRelations - before;
}

// ---- Threshold predicates (§13.2) -----------------------------------------

/** <5: colonist ETA 4 turns, Emergency Resupply unavailable. */
export function colonistEta(sub: Subdivision): number {
  return sub.earthRelations < 5 ? 4 : 3;
}

export function emergencyResupplyAvailable(sub: Subdivision): boolean {
  return sub.earthRelations >= 5;
}

/** =0: Appeal unavailable, Requisition +50% Cr. */
export function appealAvailable(sub: Subdivision): boolean {
  return sub.earthRelations > 0;
}

/** Requisition Cr multiplier: =0 -> +50%, >20 -> -25%, else 1.0. */
export function requisitionCostMultiplier(sub: Subdivision): number {
  if (sub.earthRelations === 0) return 1.5;
  if (sub.earthRelations > 20) return 0.75;
  return 1.0;
}

/** >20: Expedited Delivery free. */
export function expeditedDeliveryFree(sub: Subdivision): boolean {
  return sub.earthRelations > 20;
}

/** >25: parent bonus action unlocked. */
export function parentBonusActionUnlocked(sub: Subdivision): boolean {
  return sub.earthRelations > 25;
}

/** =30: +1 Corporate Action slot (suspended if it drops below 30). */
export function universalBonusActive(sub: Subdivision): boolean {
  return sub.earthRelations === ER_MAX;
}

/**
 * Phase 8 Resource Export accrual: +1 ER per cumulative 20 units sold, credited
 * when crossing each multiple of 20. [D-024]. Mutates cum.resourceExportCredited.
 * Returns ER delta granted.
 */
export function accrueResourceExport(sub: Subdivision): number {
  const milestonesReached = Math.floor(sub.cum.resourcesSoldUnits / 20);
  const alreadyCredited = sub.cum.resourceExportCredited;
  if (milestonesReached > alreadyCredited) {
    const grant = milestonesReached - alreadyCredited;
    sub.cum.resourceExportCredited = milestonesReached;
    return adjustEr(sub, grant);
  }
  return 0;
}
