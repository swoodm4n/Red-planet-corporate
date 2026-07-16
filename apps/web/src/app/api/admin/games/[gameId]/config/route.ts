import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// PATCH /api/admin/games/:gameId/config — adjust the turn timer / deadline.
// Body: { turnLengthHours?, turnDeadline? (ISO), resetDeadline? }
export const PATCH = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const body = (await readJson<{ turnLengthHours?: number; turnDeadline?: string; resetDeadline?: boolean }>(req)) ?? {};
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) throw errors.notFound("Game not found");

  const data: { turnLengthHours?: number; turnDeadline?: Date } = {};
  if (body.turnLengthHours != null) {
    if (!Number.isInteger(body.turnLengthHours) || body.turnLengthHours < 1 || body.turnLengthHours > 24 * 30) {
      throw errors.badRequest("turnLengthHours must be an integer between 1 and 720");
    }
    data.turnLengthHours = body.turnLengthHours;
  }
  const length = data.turnLengthHours ?? game.turnLengthHours;
  if (body.turnDeadline) {
    const d = new Date(body.turnDeadline);
    if (Number.isNaN(d.getTime())) throw errors.badRequest("Invalid turnDeadline");
    data.turnDeadline = d;
  } else if (body.resetDeadline) {
    data.turnDeadline = new Date(Date.now() + length * 3600 * 1000);
  }
  if (Object.keys(data).length === 0) throw errors.badRequest("No config fields provided");

  const updated = await prisma.game.update({ where: { id }, data });
  await writeAudit({
    gameId: id,
    adminUserId: admin.id,
    action: "UPDATE_CONFIG",
    targetType: "GAME",
    targetId: String(id),
    before: { turnLengthHours: game.turnLengthHours, turnDeadline: game.turnDeadline },
    after: { turnLengthHours: updated.turnLengthHours, turnDeadline: updated.turnDeadline },
  });
  return json({ ok: true, turnLengthHours: updated.turnLengthHours, turnDeadline: updated.turnDeadline });
});
