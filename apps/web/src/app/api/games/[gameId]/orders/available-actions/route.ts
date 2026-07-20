import type { BuildingActionOrder, UnitActionOrder } from "@rpc/engine";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireOwnedSubdivision } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { availableActionsSchema, parseOr400 } from "@/lib/validation";
import { computeAvailableActions } from "@/server/availableActions";

export const runtime = "nodejs";

// POST /api/games/:gameId/orders/available-actions
// Given the caller's in-progress draft orders, return per-building the currently
// engine-valid action set (§22.9 / [D-061]) plus per-unit attention state, both
// reflecting the tentative attention spent by the draft so far ([D-056]–[D-064]).
// Viewer is always the caller's own assigned subdivision (server-derived); a player
// can never query another subdivision's buildings.
export const POST = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const { subdivisionId } = await requireOwnedSubdivision(req, id);
  const { game } = await loadGame(id);

  const body = parseOr400(availableActionsSchema, await readJson(req));
  const draft = body.draftOrders ?? {};

  const result = computeAvailableActions(game, subdivisionId, {
    buildingActions: (draft.buildingActions ?? []) as BuildingActionOrder[],
    unitActions: (draft.unitActions ?? []) as UnitActionOrder[],
  });

  return json({
    gameId: id,
    turnNumber: game.turnNumber,
    subdivisionId,
    buildings: result.buildings,
    unitAttention: result.unitAttention,
  });
});
