import { handle, json, errors } from "@/lib/http";
import { requireApproved } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { equityView } from "@/server/reports";

export const runtime = "nodejs";

// GET /api/games/:gameId/equity — subdivision equity market (public: prices + ownership ledger).
export const GET = handle(async (req, ctx) => {
  await requireApproved(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  const { game } = await loadGame(id);
  return json({ gameId: id, turnNumber: game.turnNumber, equity: equityView(game) });
});
