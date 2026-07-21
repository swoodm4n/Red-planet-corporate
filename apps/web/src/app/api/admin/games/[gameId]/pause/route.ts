import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/pause — pause auto-resolution.
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) throw errors.notFound("Game not found");
  if (game.status === "COMPLETED") throw errors.conflict("Game is completed");

  await prisma.game.update({ where: { id }, data: { status: "PAUSED" } });
  await writeAudit({ gameId: id, adminUserId: admin.id, action: "PAUSE_GAME", targetType: "GAME", targetId: String(id) });
  return json({ ok: true, status: "PAUSED" });
});
