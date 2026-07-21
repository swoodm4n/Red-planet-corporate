import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireApproved } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/games/:gameId/announcements — public colony announcements.
export const GET = handle(async (req, ctx) => {
  await requireApproved(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const announcements = await prisma.announcement.findMany({
    where: { gameId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, createdAt: true },
  });
  return json({ gameId: id, announcements });
});
