import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { announcementSchema, parseOr400 } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/announcements — post a colony-wide announcement.
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const game = await prisma.game.findUnique({ where: { id }, select: { id: true } });
  if (!game) throw errors.notFound("Game not found");

  const body = parseOr400(announcementSchema, await readJson(req));
  const announcement = await prisma.announcement.create({
    data: { gameId: id, authorUserId: admin.id, title: body.title, body: body.body },
    select: { id: true, title: true, body: true, createdAt: true },
  });
  return json({ ok: true, announcement }, { status: 201 });
});
