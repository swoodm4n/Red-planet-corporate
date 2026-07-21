import { handle, json, errors } from "@/lib/http";
import { requireApproved } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { marketView, standingsView } from "@/server/reports";

export const runtime = "nodejs";

// GET /api/games/:gameId/market — live dynamic-market prices (public).
export const GET = handle(async (req, ctx) => {
  await requireApproved(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  const { game } = await loadGame(id);
  return json({ gameId: id, turnNumber: game.turnNumber, market: marketView(game), standings: standingsView(game) });
});
