import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { assignSchema, parseOr400 } from "@/lib/validation";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/subdivisions/:sid/assign — (re)assign a slot to a user.
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId, sid } = await ctx.params;
  const id = Number(gameId);
  const subdivisionId = Number(sid);
  if (!Number.isInteger(id) || !Number.isInteger(subdivisionId)) throw errors.badRequest("Invalid params");

  const body = parseOr400(assignSchema, await readJson(req));
  const user = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!user) throw errors.notFound("User not found");
  if (user.role !== "PLAYER") throw errors.badRequest("Only player accounts can hold a subdivision");

  const sub = await prisma.subdivisionState.findUnique({
    where: { gameId_subdivisionId: { gameId: id, subdivisionId } },
  });
  if (!sub) throw errors.notFound("Subdivision not found");

  await prisma.$transaction(async (tx) => {
    const prior = await tx.subdivisionAssignment.findUnique({
      where: { gameId_subdivisionId: { gameId: id, subdivisionId } },
    });
    // A subdivision has one holder and a user holds one subdivision.
    await tx.subdivisionAssignment.deleteMany({
      where: { OR: [{ gameId: id, subdivisionId }, { userId: body.userId }] },
    });
    await tx.subdivisionAssignment.create({ data: { gameId: id, subdivisionId, userId: body.userId } });
    await tx.user.update({ where: { id: body.userId }, data: { status: "APPROVED" } });
    await writeAudit(
      {
        gameId: id,
        adminUserId: admin.id,
        action: "ASSIGN_SUBDIVISION",
        targetType: "SUBDIVISION",
        targetId: String(subdivisionId),
        before: prior ? { previousUserId: prior.userId } : undefined,
        after: { userId: body.userId },
      },
      tx,
    );
  });

  return json({ ok: true, gameId: id, subdivisionId, userId: body.userId });
});
