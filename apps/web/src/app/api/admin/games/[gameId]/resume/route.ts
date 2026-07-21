import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/resume — resume auto-resolution; optionally reset the deadline.
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  const body = (await readJson<{ resetDeadline?: boolean }>(req)) ?? {};

  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) throw errors.notFound("Game not found");
  if (game.status === "COMPLETED") throw errors.conflict("Game is completed");

  const data: { status: "ACTIVE"; turnDeadline?: Date } = { status: "ACTIVE" };
  if (body.resetDeadline) data.turnDeadline = new Date(Date.now() + game.turnLengthHours * 3600 * 1000);

  await prisma.game.update({ where: { id }, data });
  await writeAudit({ gameId: id, adminUserId: admin.id, action: "RESUME_GAME", targetType: "GAME", targetId: String(id) });
  return json({ ok: true, status: "ACTIVE", deadlineReset: !!body.resetDeadline });
});
