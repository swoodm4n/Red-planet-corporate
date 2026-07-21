import { handle, json, errors } from "@/lib/http";
import { requireOwnedSubdivision } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { buildPrivateReport } from "@/server/reports";

export const runtime = "nodejs";

// GET /api/games/:gameId/report — the caller's OWN private subdivision report.
// Authorization: requireOwnedSubdivision resolves the caller's assigned
// subdivision for this game; there is no way to request another subdivision here.
export const GET = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const { subdivisionId } = await requireOwnedSubdivision(req, id);
  const { game } = await loadGame(id);
  const report = buildPrivateReport(game, subdivisionId);
  if (!report) throw errors.notFound("Subdivision not found");
  return json(report);
});
