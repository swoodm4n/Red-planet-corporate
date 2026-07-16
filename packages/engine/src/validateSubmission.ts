/**
 * Submission-time validation helper. [D-043]
 *
 * The backend must validate a player's orders both at submission time and again
 * at resolution. Resolution uses `resolveTurn`; for the lightweight submission
 * check this reuses the engine's own Phase-2 validation passes against a clone of
 * the current state — never a reimplementation. It mirrors the exact start-of-turn
 * preparation (`prepareTurnStart`) so a building/module/vehicle that was built last
 * turn (still PENDING in stored state) is seen as ACTIVE, matching what resolution
 * will do. Returns the `InvalidOrder[]` the engine would drop for this submission.
 */

import { cloneGame } from "./clone.js";
import type { TurnContext } from "./context.js";
import { makeTurnRng } from "./rng.js";
import { applyGarrison } from "./phases/garrison.js";
import { prepareTurnStart } from "./resolveTurn.js";
import { validateActionsPhase, validateGarrisonPhase } from "./validation.js";
import type { InvalidOrder, Submission } from "./orders.js";
import type { Game, ResourceBundle } from "./types.js";

export function validateSubmission(state: Game, submission: Submission): InvalidOrder[] {
  const game = cloneGame(state);
  const rng = makeTurnRng(game.gameSeed, game.turnNumber);

  const ctx: TurnContext = {
    game,
    rng,
    turnNumber: game.turnNumber,
    log: [],
    invalidOrders: [],
    turnStartResources: new Map(),
    plan: [],
    scratch: {
      hubSalesThisTurn: new Map(),
      amplifyActive: new Set(),
      autoDefendBuildings: new Set(),
    },
  };

  prepareTurnStart(ctx);

  for (const sub of game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    ctx.turnStartResources.set(sub.id, { ...sub.resources } as ResourceBundle);
  }

  const subs: Submission[] = [submission];
  validateGarrisonPhase(ctx, subs);
  applyGarrison(ctx);
  validateActionsPhase(ctx, subs);

  return ctx.invalidOrders.filter((o) => o.subdivisionId === submission.subdivisionId);
}
