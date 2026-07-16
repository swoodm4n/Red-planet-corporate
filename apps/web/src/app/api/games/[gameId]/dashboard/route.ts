import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireApproved } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { buildPublicDashboard } from "@/server/reports";

export const runtime = "nodejs";

// GET /api/games/:gameId/dashboard — public dashboard (standings/market/map/events).
export const GET = handle(async (req, ctx) => {
  await requireApproved(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const { game } = await loadGame(id);
  const dashboard = buildPublicDashboard(game);

  const [announcements, recentEvents] = await Promise.all([
    prisma.announcement.findMany({
      where: { gameId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, createdAt: true },
    }),
    prisma.turnLog.findMany({
      where: { gameId: id },
      orderBy: { turnNumber: "desc" },
      take: 10,
      select: { turnNumber: true, eventJson: true, createdAt: true },
    }),
  ]);

  return json({
    ...dashboard,
    announcements,
    colonyEvents: recentEvents
      .filter((e) => e.eventJson)
      .map((e) => ({ turnNumber: e.turnNumber, event: e.eventJson, at: e.createdAt })),
  });
});
