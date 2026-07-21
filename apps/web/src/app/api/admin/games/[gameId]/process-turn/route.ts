import { handle, json, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { resolveGameTurn } from "@/server/turn";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/process-turn — force-resolve the current turn now.
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const result = await resolveGameTurn(id, { force: true });
  await writeAudit({
    gameId: id,
    adminUserId: admin.id,
    action: "PROCESS_TURN",
    targetType: "GAME",
    targetId: String(id),
    after: { resolvedTurn: result.resolvedTurn, nextTurn: result.nextTurn },
  });

  return json({
    ok: true,
    resolvedTurn: result.resolvedTurn,
    nextTurn: result.nextTurn,
    event: result.turnLog.event ?? null,
    invalidOrders: result.turnLog.invalidOrders,
    scoreboard: result.turnLog.scoreboard,
  });
});
