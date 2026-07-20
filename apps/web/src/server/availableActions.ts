/**
 * §22.9 building available-action derivation for the orders composer. [D-056]–[D-064]
 *
 * The frontend must never guess whether an action is valid — the engine's
 * `availableActions(building, sub, game)` is the single source of truth ([D-061]).
 * This module wraps it so the composer can also see the *live* effect of the
 * orders it has queued client-side but not yet submitted: it clones turn-start
 * state, tentatively marks the units each draft order would commit as
 * attention-spent (the same lowest-id selection Phase 2 reserves via its `claimed`
 * set, §22.4), then re-queries per building. All selection/gating is delegated to
 * the engine — nothing here re-implements a rule.
 */

import {
  type BuildingActionOrder,
  type BuildingActionType,
  type Game,
  type UnitActionOrder,
  availableActions,
  buildingActionOffered,
  cloneGame,
  pickBuildingActionAttention,
  pickUnitActionAttention,
  spendAttention,
} from "@rpc/engine";

/**
 * The subset of a draft `Submission` that affects attention availability. Garrison
 * assignments, political and corporate actions spend no attention ([D-058]/[D-059])
 * and are ignored here; only building + unit actions commit unit attention.
 */
export interface DraftOrders {
  buildingActions?: BuildingActionOrder[];
  unitActions?: UnitActionOrder[];
}

export interface AvailableActionsResult {
  /** buildingId -> the currently-valid action set for that building. */
  buildings: Record<number, BuildingActionType[]>;
  /**
   * personnelId -> whether that unit's attention is spent given the draft so far.
   * `true` = spent (frontend badge ASSIGNED); `false`/absent = unspent (AVAILABLE).
   */
  unitAttention: Record<number, boolean>;
}

/**
 * Compute per-building available actions and per-unit attention state for
 * `subdivisionId`, reflecting the tentative attention spend of `draft` orders.
 *
 * `game` is the current (turn-start) authoritative state; it is cloned, never
 * mutated. Draft building actions are walked before unit actions, matching the
 * engine's Phase-2 declaration order (§22.4): the spent flag itself acts as the
 * claim, so a later draft order cannot reuse a unit an earlier one already spent.
 * A draft building action only spends when it is actually offered (operational,
 * not built-this-turn, set/module gated, attention available) — the identical
 * predicate the validator accepts on — so an unofferable queued action never
 * "leaks" attention.
 */
export function computeAvailableActions(
  game: Game,
  subdivisionId: number,
  draft: DraftOrders,
): AvailableActionsResult {
  const clone = cloneGame(game);
  const sub = clone.subdivisions.find((s) => s.id === subdivisionId);
  if (!sub) {
    // Caller resolves subdivisionId from the session, so this should never happen.
    return { buildings: {}, unitAttention: {} };
  }
  const turnNumber = clone.turnNumber;
  const noClaim: ReadonlySet<number> = new Set();

  for (const a of draft.buildingActions ?? []) {
    const b = sub.buildings.find((x) => x.id === a.buildingId);
    if (!b) continue;
    // Only an offered action spends attention (mirrors Phase-2 accept → reserve).
    if (!buildingActionOffered(sub, b, a.action, turnNumber, noClaim)) continue;
    const picks = pickBuildingActionAttention(sub, b, a.action, turnNumber, noClaim);
    if (picks) spendAttention(sub, picks);
  }

  for (const a of draft.unitActions ?? []) {
    const picks = pickUnitActionAttention(sub, a, turnNumber, noClaim);
    if (picks) spendAttention(sub, picks);
  }

  const buildings: Record<number, BuildingActionType[]> = {};
  for (const b of sub.buildings) {
    buildings[b.id] = availableActions(b, sub, clone);
  }

  const unitAttention: Record<number, boolean> = {};
  for (const p of sub.personnel) {
    unitAttention[p.id] = p.attentionSpentThisTurn === true;
  }

  return { buildings, unitAttention };
}
