import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireApproved } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/games/:gameId/turns — index of resolved turns (public metadata + event).
export const GET = handle(async (req, ctx) => {
  await requireApproved(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const turns = await prisma.turnLog.findMany({
    where: { gameId: id },
    orderBy: { turnNumber: "asc" },
    select: { turnNumber: true, eventJson: true, scoreboardJson: true, createdAt: true },
  });
  return json({ gameId: id, turns });
});
