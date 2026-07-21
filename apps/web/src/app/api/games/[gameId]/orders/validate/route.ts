import { type Submission as EngineSubmission, validateSubmission } from "@rpc/engine";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireOwnedSubdivision } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { ordersSchema, parseOr400 } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/games/:gameId/orders/validate — dry-run engine validation, no save.
export const POST = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const { subdivisionId } = await requireOwnedSubdivision(req, id);
  const { game } = await loadGame(id);

  const body = parseOr400(ordersSchema, await readJson(req));
  const submission: EngineSubmission = {
    subdivisionId,
    turnNumber: game.turnNumber,
    garrison: body.garrison as EngineSubmission["garrison"],
    buildingActions: body.buildingActions as EngineSubmission["buildingActions"],
    unitActions: body.unitActions as EngineSubmission["unitActions"],
    politicalAction: (body.politicalAction ?? undefined) as EngineSubmission["politicalAction"],
    corporateActions: body.corporateActions as EngineSubmission["corporateActions"],
    notes: body.notes,
  };

  const invalidOrders = validateSubmission(game, submission);
  return json({ valid: invalidOrders.length === 0, invalidOrders });
});
