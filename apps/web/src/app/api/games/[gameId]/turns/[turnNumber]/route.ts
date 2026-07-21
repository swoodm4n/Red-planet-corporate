import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireApproved } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/games/:gameId/turns/:turnNumber — a resolved turn log.
// Players receive only the PUBLIC portions (event + scoreboard + category leaders);
// the full per-order log (which can reference other subdivisions) is admin-only.
export const GET = handle(async (req, ctx) => {
  const user = await requireApproved(req);
  const { gameId, turnNumber } = await ctx.params;
  const id = Number(gameId);
  const turn = Number(turnNumber);
  if (!Number.isInteger(id) || !Number.isInteger(turn)) throw errors.badRequest("Invalid params");

  const row = await prisma.turnLog.findUnique({
    where: { gameId_turnNumber: { gameId: id, turnNumber: turn } },
  });
  if (!row) throw errors.notFound("Turn not found");

  if (user.role === "ADMIN") {
    return json({ gameId: id, turnNumber: turn, log: row.logJson, scoreboard: row.scoreboardJson, event: row.eventJson });
  }
  return json({
    gameId: id,
    turnNumber: turn,
    event: row.eventJson,
    scoreboard: row.scoreboardJson,
  });
});
