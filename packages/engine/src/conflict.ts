/**
 * Conflict resolution formula. GAME_SPEC §14 / [D-017].
 *
 *   if A == 0: fail
 *   if |A-D| >= 0.5*max(A,D): deterministic, success = (A > D)
 *   else (close): success = rng.nextFloat() < A/(A+D)
 *   Lockdown / Counter-Intel / Security Sweep on defender => attacker auto-fails.
 */

import type { Rng } from "./rng.js";

export interface ConflictInput {
  attackerInvestment: number;
  defenderInvestment: number;
  /** Defender has an auto-defend effect active (Lockdown / Counter-Intel / Sweep). */
  defenderAutoDefend?: boolean;
}

export interface ConflictResult {
  success: boolean;
  /** true if resolved deterministically (large differential or auto-defend). */
  deterministic: boolean;
  ratio: number;
}

export function resolveConflict(rng: Rng, input: ConflictInput): ConflictResult {
  const { attackerInvestment: A, defenderInvestment: D } = input;

  if (input.defenderAutoDefend) {
    return { success: false, deterministic: true, ratio: 0 };
  }
  if (A <= 0) {
    return { success: false, deterministic: true, ratio: 0 };
  }

  const ratio = D <= 0 ? 1 : A / (A + D);
  const maxAD = Math.max(A, D);
  const largeDifferential = Math.abs(A - D) >= 0.5 * maxAD;

  if (D <= 0) {
    // No defense -> ratio 1, always a large differential success.
    return { success: true, deterministic: true, ratio: 1 };
  }

  if (largeDifferential) {
    return { success: A > D, deterministic: true, ratio };
  }

  // Close case: seeded draw. Ties (A==D) -> ratio 0.5.
  const roll = rng.nextFloat();
  return { success: roll < ratio, deterministic: false, ratio };
}
