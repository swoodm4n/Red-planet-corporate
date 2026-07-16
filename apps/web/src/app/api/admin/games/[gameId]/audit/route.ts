import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/admin/games/:gameId/audit — the admin audit trail for a game.
export const GET = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? 100), 500);

  const entries = await prisma.auditLog.findMany({
    where: { gameId: id },
    orderBy: { createdAt: "desc" },
    take,
    include: { admin: { select: { id: true, email: true } } },
  });
  return json({ gameId: id, entries });
});
