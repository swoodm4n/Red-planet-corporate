import { handle, json, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { buildPrivateReport } from "@/server/reports";

export const runtime = "nodejs";

// GET /api/admin/games/:gameId/subdivisions/:sid/report — admin views ANY private report.
export const GET = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { gameId, sid } = await ctx.params;
  const id = Number(gameId);
  const subdivisionId = Number(sid);
  if (!Number.isInteger(id) || !Number.isInteger(subdivisionId)) throw errors.badRequest("Invalid params");

  const { game } = await loadGame(id);
  const report = buildPrivateReport(game, subdivisionId);
  if (!report) throw errors.notFound("Subdivision not found");
  return json(report);
});
